import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { executionDb, agentDb, activityDb } from '../services/supabase';
import { sandboxService } from '../services/sandbox';
import { authenticateAgent, checkQuota } from '../middleware/auth';
import { SUPPORTED_LANGUAGES } from '../types';
import { LIMITS } from '../utils/config';

const router = Router();

// Validation schemas
const executeCodeSchema = z.object({
  language: z.enum(['python', 'javascript', 'typescript', 'go', 'rust']),
  code: z.string().min(1).max(LIMITS.MAX_CODE_SIZE_KB * 1024),
  timeout_ms: z.number().min(1000).max(LIMITS.MAX_TIMEOUT_MS).optional().default(LIMITS.MAX_TIMEOUT_MS),
  repository_id: z.string().uuid().optional(),
});

// Apply auth to all routes
router.use(authenticateAgent);

// Get supported languages
router.get('/languages', (_req: Request, res: Response) => {
  const languages = Object.entries(SUPPORTED_LANGUAGES).map(([name, config]) => ({
    name,
    image: config.image,
    timeout_ms: config.timeout_ms,
    memory_limit_mb: config.memory_limit_mb,
  }));

  res.json({ languages });
});

// Execute code in sandbox
router.post('/execute', checkQuota, async (req: Request, res: Response) => {
  try {
    const agent = req.agent!;
    const body = executeCodeSchema.parse(req.body);

    // Create execution record
    const execution = await executionDb.create({
      agent_id: agent.id,
      repository_id: body.repository_id,
      language: body.language,
      code: body.code,
    });

    // Update quota
    await agentDb.incrementQuota(agent.id, 'executions_today');

    // Log activity
    await activityDb.log({
      agent_id: agent.id,
      action: 'sandbox.execute',
      details: {
        execution_id: execution.id,
        language: body.language,
        code_length: body.code.length,
      },
    });

    // Execute asynchronously and return immediately
    // In production, this would be handled by a job queue
    sandboxService
      .executeCode(execution.id, body.language, body.code, body.timeout_ms)
      .then((result) => {
        console.log(`Execution ${execution.id} completed:`, {
          exitCode: result.exitCode,
          durationMs: result.durationMs,
          timedOut: result.timedOut,
        });
      })
      .catch((error) => {
        console.error(`Execution ${execution.id} failed:`, error);
      });

    res.status(202).json({
      execution_id: execution.id,
      status: 'queued',
      message: 'Code execution started. Poll /sandbox/executions/:id for results.',
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Validation Error',
        details: error.errors,
      });
      return;
    }
    console.error('Execute code error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to execute code',
    });
  }
});

// Execute code synchronously (waits for completion)
router.post('/execute/sync', checkQuota, async (req: Request, res: Response) => {
  try {
    const agent = req.agent!;
    const body = executeCodeSchema.parse(req.body);

    // Create execution record
    const execution = await executionDb.create({
      agent_id: agent.id,
      repository_id: body.repository_id,
      language: body.language,
      code: body.code,
    });

    // Update quota
    await agentDb.incrementQuota(agent.id, 'executions_today');

    // Log activity
    await activityDb.log({
      agent_id: agent.id,
      action: 'sandbox.execute_sync',
      details: {
        execution_id: execution.id,
        language: body.language,
        code_length: body.code.length,
      },
    });

    // Execute and wait for result
    const result = await sandboxService.executeCode(
      execution.id,
      body.language,
      body.code,
      body.timeout_ms
    );

    // Get updated execution record
    const updatedExecution = await executionDb.findById(execution.id);

    res.json({
      execution_id: execution.id,
      status: updatedExecution?.status || 'completed',
      language: body.language,
      stdout: result.stdout,
      stderr: result.stderr,
      exit_code: result.exitCode,
      duration_ms: result.durationMs,
      memory_used_mb: result.memoryUsedMb,
      timed_out: result.timedOut,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Validation Error',
        details: error.errors,
      });
      return;
    }
    console.error('Execute code sync error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to execute code',
    });
  }
});

// Get execution status/result
router.get('/executions/:executionId', async (req: Request, res: Response) => {
  try {
    const agent = req.agent!;
    const { executionId } = req.params;

    const execution = await executionDb.findById(executionId);

    if (!execution || execution.agent_id !== agent.id) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Execution not found',
      });
      return;
    }

    res.json({
      id: execution.id,
      status: execution.status,
      language: execution.language,
      code: execution.code,
      stdout: execution.stdout,
      stderr: execution.stderr,
      exit_code: execution.exit_code,
      duration_ms: execution.duration_ms,
      memory_used_mb: execution.memory_used_mb,
      created_at: execution.created_at,
      started_at: execution.started_at,
      completed_at: execution.completed_at,
    });
  } catch (error: any) {
    console.error('Get execution error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get execution',
    });
  }
});

// List agent's executions
router.get('/executions', async (req: Request, res: Response) => {
  try {
    const agent = req.agent!;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);

    const executions = await executionDb.findByAgentId(agent.id, limit);

    res.json({
      executions: executions.map((e) => ({
        id: e.id,
        status: e.status,
        language: e.language,
        exit_code: e.exit_code,
        duration_ms: e.duration_ms,
        created_at: e.created_at,
        completed_at: e.completed_at,
      })),
      count: executions.length,
    });
  } catch (error: any) {
    console.error('List executions error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to list executions',
    });
  }
});

// Health check for sandbox
router.get('/health', async (_req: Request, res: Response) => {
  try {
    const dockerHealthy = await sandboxService.healthCheck();

    if (!dockerHealthy) {
      res.status(503).json({
        status: 'unhealthy',
        message: 'Docker daemon not available',
      });
      return;
    }

    res.json({
      status: 'healthy',
      supported_languages: Object.keys(SUPPORTED_LANGUAGES),
      limits: {
        max_timeout_ms: LIMITS.MAX_TIMEOUT_MS,
        max_memory_mb: LIMITS.MAX_MEMORY_MB,
        max_code_size_kb: LIMITS.MAX_CODE_SIZE_KB,
      },
    });
  } catch (error: any) {
    console.error('Sandbox health check error:', error);
    res.status(503).json({
      status: 'unhealthy',
      message: 'Health check failed',
    });
  }
});

export default router;
