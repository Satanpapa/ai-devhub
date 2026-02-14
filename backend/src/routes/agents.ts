import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { v4 as uuid } from 'uuid';
import { agentDb, activityDb } from '../services/supabase';
import { giteaService } from '../services/gitea';
import { generateApiKey, hashApiKey, authenticateAgent } from '../middleware/auth';
import { LIMITS } from '../utils/config';

const router = Router();

// Validation schemas
const createAgentSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  permissions: z.object({
    can_create_repos: z.boolean().optional(),
    can_execute_code: z.boolean().optional(),
    can_read_external: z.boolean().optional(),
    max_repos: z.number().min(1).max(100).optional(),
    max_executions_per_day: z.number().min(1).max(1000).optional(),
  }).optional(),
});

const updateAgentSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  status: z.enum(['active', 'paused']).optional(),
});

// Create new agent (requires user authentication - simplified for demo)
router.post('/', async (req: Request, res: Response) => {
  try {
    const body = createAgentSchema.parse(req.body);
    
    // For demo, use a placeholder user_id (in production, get from auth)
    const userId = req.headers['x-user-id'] as string || uuid();

    // Generate API key
    const apiKey = generateApiKey();
    const apiKeyHash = hashApiKey(apiKey);

    // Default permissions
    const defaultPermissions = {
      can_create_repos: true,
      can_execute_code: true,
      can_read_external: true,
      max_repos: LIMITS.MAX_REPOS_FREE,
      max_executions_per_day: LIMITS.MAX_EXECUTIONS_PER_DAY_FREE,
    };

    // Default quota
    const defaultQuota = {
      repos_used: 0,
      repos_limit: LIMITS.MAX_REPOS_FREE,
      storage_used_mb: 0,
      storage_limit_mb: LIMITS.MAX_STORAGE_MB_FREE,
      executions_today: 0,
      executions_limit: LIMITS.MAX_EXECUTIONS_PER_DAY_FREE,
      last_reset: new Date().toISOString(),
    };

    // Create agent in database
    const agent = await agentDb.create({
      user_id: userId,
      name: body.name,
      description: body.description,
      api_key_hash: apiKeyHash,
      permissions: { ...defaultPermissions, ...body.permissions },
      quota: defaultQuota,
    });

    // Try to create Gitea user for the agent
    try {
      const giteaUser = await giteaService.createAgentUser(agent.id, body.name);
      const giteaToken = await giteaService.createAgentToken(giteaUser.login, 'api-access');
      
      // Store Gitea credentials (encrypted in production)
      await agentDb.update(agent.id, {
        gitea_username: giteaUser.login,
        gitea_token: giteaToken, // Should be encrypted
      });
    } catch (error) {
      console.warn('Failed to create Gitea user:', error);
      // Continue without Gitea integration
    }

    // Log activity
    await activityDb.log({
      agent_id: agent.id,
      action: 'agent.created',
      details: { name: body.name },
    });

    // Return agent with API key (only shown once!)
    res.status(201).json({
      agent: {
        id: agent.id,
        name: agent.name,
        description: agent.description,
        status: agent.status,
        permissions: agent.permissions,
        quota: agent.quota,
        created_at: agent.created_at,
      },
      api_key: apiKey,
      warning: 'Save this API key! It will not be shown again.',
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Validation Error',
        details: error.errors,
      });
      return;
    }
    console.error('Create agent error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create agent',
    });
  }
});

// Get current agent info (authenticated)
router.get('/me', authenticateAgent, async (req: Request, res: Response) => {
  try {
    const agent = req.agent!;
    
    res.json({
      id: agent.id,
      name: agent.name,
      description: agent.description,
      status: agent.status,
      permissions: agent.permissions,
      quota: agent.quota,
      created_at: agent.created_at,
      last_active_at: agent.last_active_at,
    });
  } catch (error: any) {
    console.error('Get agent error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get agent info',
    });
  }
});

// Update agent (authenticated)
router.patch('/me', authenticateAgent, async (req: Request, res: Response) => {
  try {
    const agent = req.agent!;
    const body = updateAgentSchema.parse(req.body);

    const updated = await agentDb.update(agent.id, body);

    await activityDb.log({
      agent_id: agent.id,
      action: 'agent.updated',
      details: body,
    });

    res.json({
      id: updated.id,
      name: updated.name,
      description: updated.description,
      status: updated.status,
      permissions: updated.permissions,
      quota: updated.quota,
      updated_at: updated.updated_at,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Validation Error',
        details: error.errors,
      });
      return;
    }
    console.error('Update agent error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update agent',
    });
  }
});

// Get agent activity logs
router.get('/me/activity', authenticateAgent, async (req: Request, res: Response) => {
  try {
    const agent = req.agent!;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    
    const logs = await activityDb.findByAgentId(agent.id, limit);
    
    res.json({
      logs,
      count: logs.length,
    });
  } catch (error: any) {
    console.error('Get activity error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get activity logs',
    });
  }
});

// Regenerate API key
router.post('/me/regenerate-key', authenticateAgent, async (req: Request, res: Response) => {
  try {
    const agent = req.agent!;
    
    // Generate new API key
    const apiKey = generateApiKey();
    const apiKeyHash = hashApiKey(apiKey);

    await agentDb.update(agent.id, { api_key_hash: apiKeyHash });

    await activityDb.log({
      agent_id: agent.id,
      action: 'agent.key_regenerated',
    });

    res.json({
      api_key: apiKey,
      warning: 'Save this API key! It will not be shown again.',
    });
  } catch (error: any) {
    console.error('Regenerate key error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to regenerate API key',
    });
  }
});

// Get quota status
router.get('/me/quota', authenticateAgent, async (req: Request, res: Response) => {
  try {
    const agent = req.agent!;
    const quota = agent.quota;
    const permissions = agent.permissions;

    res.json({
      repositories: {
        used: quota.repos_used,
        limit: permissions.max_repos,
        remaining: permissions.max_repos - quota.repos_used,
      },
      storage: {
        used_mb: quota.storage_used_mb,
        limit_mb: quota.storage_limit_mb,
        remaining_mb: quota.storage_limit_mb - quota.storage_used_mb,
      },
      executions: {
        today: quota.executions_today,
        limit: permissions.max_executions_per_day,
        remaining: permissions.max_executions_per_day - quota.executions_today,
        resets_at: getNextMidnight(),
      },
    });
  } catch (error: any) {
    console.error('Get quota error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get quota info',
    });
  }
});

function getNextMidnight(): string {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return midnight.toISOString();
}

export default router;
