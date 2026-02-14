import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import { config } from './utils/config';
import { rateLimit } from './middleware/auth';
import { sandboxService } from './services/sandbox';
import { giteaService } from './services/gitea';

// Import routes
import agentsRouter from './routes/agents';
import repositoriesRouter from './routes/repositories';
import sandboxRouter from './routes/sandbox';
import externalRouter from './routes/external';

const app = express();

// Middleware
app.use(helmet());
app.use(cors({
  origin: config.NODE_ENV === 'production' 
    ? ['https://ai-devhub.vercel.app', 'https://ai-devhub.netlify.app']
    : '*',
  credentials: true,
}));
app.use(morgan(config.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Global rate limiting
app.use(rateLimit(1000, 60000)); // 1000 requests per minute

// Health check
app.get('/health', async (_req: Request, res: Response) => {
  const checks = {
    server: 'healthy',
    docker: 'unknown',
    gitea: 'unknown',
  };

  try {
    checks.docker = await sandboxService.healthCheck() ? 'healthy' : 'unhealthy';
  } catch {
    checks.docker = 'unhealthy';
  }

  try {
    checks.gitea = await giteaService.healthCheck() ? 'healthy' : 'unhealthy';
  } catch {
    checks.gitea = 'unhealthy';
  }

  const allHealthy = Object.values(checks).every(v => v === 'healthy' || v === 'unknown');
  
  res.status(allHealthy ? 200 : 503).json({
    status: allHealthy ? 'healthy' : 'degraded',
    checks,
    timestamp: new Date().toISOString(),
  });
});

// API info
app.get('/', (_req: Request, res: Response) => {
  res.json({
    name: 'AI-DevHub API',
    version: '1.0.0',
    description: 'GitHub for autonomous AI agents',
    documentation: '/docs',
    endpoints: {
      health: 'GET /health',
      agents: {
        create: 'POST /api/agents',
        me: 'GET /api/agents/me',
        update: 'PATCH /api/agents/me',
        quota: 'GET /api/agents/me/quota',
        activity: 'GET /api/agents/me/activity',
        regenerateKey: 'POST /api/agents/me/regenerate-key',
      },
      repositories: {
        list: 'GET /api/repos',
        create: 'POST /api/repos',
        get: 'GET /api/repos/:id',
        delete: 'DELETE /api/repos/:id',
        listFiles: 'GET /api/repos/:id/files',
        getFile: 'GET /api/repos/:id/files/*',
        createFile: 'POST /api/repos/:id/files',
        updateFile: 'PUT /api/repos/:id/files/*',
      },
      sandbox: {
        languages: 'GET /api/sandbox/languages',
        execute: 'POST /api/sandbox/execute',
        executeSync: 'POST /api/sandbox/execute/sync',
        executions: 'GET /api/sandbox/executions',
        execution: 'GET /api/sandbox/executions/:id',
        health: 'GET /api/sandbox/health',
      },
      external: {
        github: {
          repo: 'GET /api/external/github/repos/:owner/:repo',
          readme: 'GET /api/external/github/repos/:owner/:repo/readme',
          contents: 'GET /api/external/github/repos/:owner/:repo/contents',
          file: 'GET /api/external/github/repos/:owner/:repo/contents/*',
          branches: 'GET /api/external/github/repos/:owner/:repo/branches',
          languages: 'GET /api/external/github/repos/:owner/:repo/languages',
          search: 'GET /api/external/github/search/repositories',
          rateLimit: 'GET /api/external/github/rate_limit',
        },
        gitlab: {
          project: 'GET /api/external/gitlab/projects/:projectId',
          tree: 'GET /api/external/gitlab/projects/:projectId/tree',
          file: 'GET /api/external/gitlab/projects/:projectId/files/*',
          search: 'GET /api/external/gitlab/search/projects',
        },
      },
    },
  });
});

// API Routes
app.use('/api/agents', agentsRouter);
app.use('/api/repos', repositoriesRouter);
app.use('/api/sandbox', sandboxRouter);
app.use('/api/external', externalRouter);

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested endpoint does not exist',
  });
});

// Error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err);
  
  res.status(500).json({
    error: 'Internal Server Error',
    message: config.NODE_ENV === 'production' 
      ? 'An unexpected error occurred' 
      : err.message,
  });
});

// Start server
const PORT = parseInt(process.env.PORT || config.PORT);

async function start() {
  console.log('🚀 Starting AI-DevHub API...');
  console.log(`📋 Environment: ${config.NODE_ENV}`);

  // Check Docker availability
  try {
    const dockerHealthy = await sandboxService.healthCheck();
    if (dockerHealthy) {
      console.log('🐳 Docker: Connected');
      // Pre-pull images in background
      sandboxService.ensureImagesExist().catch(console.error);
    } else {
      console.warn('⚠️ Docker: Not available (sandbox features disabled)');
    }
  } catch {
    console.warn('⚠️ Docker: Not available (sandbox features disabled)');
  }

  // Check Gitea availability
  try {
    const giteaHealthy = await giteaService.healthCheck();
    if (giteaHealthy) {
      console.log(`📦 Gitea: Connected (${config.GITEA_URL})`);
    } else {
      console.warn('⚠️ Gitea: Not available (repository features limited)');
    }
  } catch {
    console.warn('⚠️ Gitea: Not available (repository features limited)');
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n✅ AI-DevHub API running on http://0.0.0.0:${PORT}`);
    console.log(`📚 API documentation: http://0.0.0.0:${PORT}/`);
  });
}

start().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

export default app;
