import { Request, Response, NextFunction } from 'express';
import { createHash } from 'crypto';
import { agentDb, activityDb } from '../services/supabase';
import { Agent } from '../types';
import { LIMITS } from '../utils/config';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      agent?: Agent;
      user?: { id: string; email: string };
    }
  }
}

// Hash API key for secure storage/comparison
export function hashApiKey(apiKey: string): string {
  return createHash('sha256').update(apiKey).digest('hex');
}

// Generate new API key
export function generateApiKey(): string {
  const prefix = 'aidh';
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let key = '';
  for (let i = 0; i < 48; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${prefix}_${key}`;
}

// Authenticate agent via API key
export async function authenticateAgent(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Missing or invalid Authorization header. Use: Bearer <api_key>',
      });
      return;
    }

    const apiKey = authHeader.slice(7);
    
    if (!apiKey.startsWith('aidh_')) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid API key format',
      });
      return;
    }

    const apiKeyHash = hashApiKey(apiKey);
    const agent = await agentDb.findByApiKeyHash(apiKeyHash);

    if (!agent) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid API key',
      });
      return;
    }

    if (agent.status !== 'active') {
      res.status(403).json({
        error: 'Forbidden',
        message: `Agent is ${agent.status}`,
      });
      return;
    }

    // Update last active timestamp
    await agentDb.updateLastActive(agent.id);

    // Log activity
    await activityDb.log({
      agent_id: agent.id,
      action: `${req.method} ${req.path}`,
      ip_address: req.ip,
    });

    req.agent = agent;
    next();
  } catch (error: any) {
    console.error('Auth error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Authentication failed',
    });
  }
}

// Check quota limits
export async function checkQuota(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const agent = req.agent;
    if (!agent) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const quota = agent.quota;
    const permissions = agent.permissions;

    // Reset daily counters if needed
    const lastReset = new Date(quota.last_reset);
    const now = new Date();
    if (lastReset.toDateString() !== now.toDateString()) {
      quota.executions_today = 0;
      quota.last_reset = now;
      await agentDb.update(agent.id, { quota });
    }

    // Check execution limit for sandbox endpoints
    if (req.path.includes('/execute') || req.path.includes('/sandbox')) {
      if (!permissions.can_execute_code) {
        res.status(403).json({
          error: 'Forbidden',
          message: 'Agent does not have permission to execute code',
        });
        return;
      }

      if (quota.executions_today >= permissions.max_executions_per_day) {
        res.status(429).json({
          error: 'Rate Limit Exceeded',
          message: `Daily execution limit reached (${permissions.max_executions_per_day})`,
          retry_after: getSecondsUntilMidnight(),
        });
        return;
      }
    }

    // Check repo limit for repository creation
    if (req.path.includes('/repos') && req.method === 'POST') {
      if (!permissions.can_create_repos) {
        res.status(403).json({
          error: 'Forbidden',
          message: 'Agent does not have permission to create repositories',
        });
        return;
      }

      if (quota.repos_used >= permissions.max_repos) {
        res.status(429).json({
          error: 'Limit Exceeded',
          message: `Repository limit reached (${permissions.max_repos})`,
        });
        return;
      }
    }

    // Check storage limit
    if (quota.storage_used_mb >= quota.storage_limit_mb) {
      res.status(429).json({
        error: 'Storage Limit Exceeded',
        message: `Storage limit reached (${quota.storage_limit_mb} MB)`,
      });
      return;
    }

    next();
  } catch (error: any) {
    console.error('Quota check error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Quota check failed',
    });
  }
}

// Rate limiting middleware (simple in-memory implementation)
const requestCounts = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(
  maxRequests: number = 100,
  windowMs: number = 60000
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const key = req.agent?.id || req.ip || 'anonymous';
    const now = Date.now();

    let record = requestCounts.get(key);
    
    if (!record || now > record.resetAt) {
      record = { count: 0, resetAt: now + windowMs };
      requestCounts.set(key, record);
    }

    record.count++;

    if (record.count > maxRequests) {
      res.status(429).json({
        error: 'Too Many Requests',
        message: `Rate limit exceeded. Max ${maxRequests} requests per ${windowMs / 1000} seconds`,
        retry_after: Math.ceil((record.resetAt - now) / 1000),
      });
      return;
    }

    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - record.count));
    res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetAt / 1000));

    next();
  };
}

function getSecondsUntilMidnight(): number {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return Math.ceil((midnight.getTime() - now.getTime()) / 1000);
}

// Cleanup old rate limit records periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of requestCounts.entries()) {
    if (now > record.resetAt) {
      requestCounts.delete(key);
    }
  }
}, 60000);
