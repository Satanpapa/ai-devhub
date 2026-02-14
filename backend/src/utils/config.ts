// Environment configuration
import { z } from 'zod';

const envSchema = z.object({
  // Server
  PORT: z.string().default('3001'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  
  // Supabase
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_KEY: z.string().min(1),
  
  // Gitea
  GITEA_URL: z.string().url().default('http://localhost:3000'),
  GITEA_ADMIN_TOKEN: z.string().min(1).optional(),
  
  // Redis (for job queue)
  REDIS_URL: z.string().default('redis://localhost:6379'),
  
  // External APIs
  GITHUB_TOKEN: z.string().optional(),
  GITLAB_TOKEN: z.string().optional(),
  
  // Sandbox limits
  SANDBOX_TIMEOUT_MS: z.string().transform(Number).default('30000'),
  SANDBOX_MEMORY_MB: z.string().transform(Number).default('512'),
  
  // JWT
  JWT_SECRET: z.string().min(32).default('ai-devhub-secret-key-change-in-production-32chars'),
});

function loadConfig() {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missing = error.errors.map(e => e.path.join('.')).join(', ');
      console.warn(`⚠️ Missing or invalid env vars: ${missing}`);
      console.warn('Using defaults where available...');
    }
    // Return defaults for development
    return {
      PORT: '3001',
      NODE_ENV: 'development' as const,
      SUPABASE_URL: process.env.SUPABASE_URL || 'https://placeholder.supabase.co',
      SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || 'placeholder-anon-key',
      SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY || 'placeholder-service-key',
      GITEA_URL: process.env.GITEA_URL || 'http://localhost:3000',
      GITEA_ADMIN_TOKEN: process.env.GITEA_ADMIN_TOKEN,
      REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
      GITHUB_TOKEN: process.env.GITHUB_TOKEN,
      GITLAB_TOKEN: process.env.GITLAB_TOKEN,
      SANDBOX_TIMEOUT_MS: 30000,
      SANDBOX_MEMORY_MB: 512,
      JWT_SECRET: process.env.JWT_SECRET || 'ai-devhub-secret-key-change-in-production-32chars',
    };
  }
}

export const config = loadConfig();

export const LIMITS = {
  MAX_TIMEOUT_MS: 30000,
  MAX_MEMORY_MB: 512,
  MAX_CODE_SIZE_KB: 100,
  MAX_REPOS_FREE: 10,
  MAX_EXECUTIONS_PER_DAY_FREE: 100,
  MAX_STORAGE_MB_FREE: 500,
};
