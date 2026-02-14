// AI-DevHub Type Definitions

export interface User {
  id: string;
  email: string;
  name: string;
  created_at: Date;
  updated_at: Date;
}

export interface Agent {
  id: string;
  user_id: string;
  name: string;
  description: string;
  api_key_hash: string;
  status: AgentStatus;
  permissions: AgentPermissions;
  quota: AgentQuota;
  gitea_username?: string;
  gitea_token?: string;
  created_at: Date;
  updated_at: Date;
  last_active_at: Date | null;
}

export type AgentStatus = 'active' | 'paused' | 'suspended' | 'deleted';

export interface AgentPermissions {
  can_create_repos: boolean;
  can_execute_code: boolean;
  can_read_external: boolean;
  max_repos: number;
  max_executions_per_day: number;
}

export interface AgentQuota {
  repos_used: number;
  repos_limit: number;
  storage_used_mb: number;
  storage_limit_mb: number;
  executions_today: number;
  executions_limit: number;
  last_reset: Date;
}

export interface Repository {
  id: string;
  agent_id: string;
  name: string;
  description: string;
  is_public: boolean;
  gitea_repo_id: number | null;
  clone_url: string | null;
  default_branch: string;
  size_mb: number;
  commits_count: number;
  created_at: Date;
  updated_at: Date;
}

export interface Execution {
  id: string;
  agent_id: string;
  repository_id: string | null;
  status: ExecutionStatus;
  language: string;
  code: string;
  stdout: string | null;
  stderr: string | null;
  exit_code: number | null;
  duration_ms: number | null;
  memory_used_mb: number | null;
  created_at: Date;
  started_at: Date | null;
  completed_at: Date | null;
}

export type ExecutionStatus = 'queued' | 'running' | 'completed' | 'failed' | 'timeout' | 'killed';

export interface ExternalRepoAccess {
  id: string;
  agent_id: string;
  provider: 'github' | 'gitlab';
  repo_url: string;
  last_accessed_at: Date;
  access_count: number;
  created_at: Date;
}

export interface ActivityLog {
  id: string;
  agent_id: string;
  action: string;
  details: Record<string, any>;
  ip_address: string | null;
  created_at: Date;
}

// API Request/Response types
export interface CreateAgentRequest {
  name: string;
  description?: string;
  permissions?: Partial<AgentPermissions>;
}

export interface CreateAgentResponse {
  agent: Agent;
  api_key: string; // Only returned once on creation
}

export interface CreateRepositoryRequest {
  name: string;
  description?: string;
  is_public?: boolean;
  init_readme?: boolean;
}

export interface ExecuteCodeRequest {
  language: string;
  code: string;
  timeout_ms?: number; // max 30000
  repository_id?: string;
}

export interface ExecuteCodeResponse {
  execution_id: string;
  status: ExecutionStatus;
}

export interface ExternalRepoRequest {
  provider: 'github' | 'gitlab';
  owner: string;
  repo: string;
  path?: string;
  branch?: string;
}

// Sandbox configuration
export interface SandboxConfig {
  language: string;
  image: string;
  timeout_ms: number;
  memory_limit_mb: number;
  cpu_limit: number;
  network_disabled: boolean;
}

export const SUPPORTED_LANGUAGES: Record<string, SandboxConfig> = {
  python: {
    language: 'python',
    image: 'python:3.11-slim',
    timeout_ms: 30000,
    memory_limit_mb: 512,
    cpu_limit: 1,
    network_disabled: true
  },
  javascript: {
    language: 'javascript',
    image: 'node:20-slim',
    timeout_ms: 30000,
    memory_limit_mb: 512,
    cpu_limit: 1,
    network_disabled: true
  },
  typescript: {
    language: 'typescript',
    image: 'node:20-slim',
    timeout_ms: 30000,
    memory_limit_mb: 512,
    cpu_limit: 1,
    network_disabled: true
  },
  go: {
    language: 'go',
    image: 'golang:1.21-alpine',
    timeout_ms: 30000,
    memory_limit_mb: 512,
    cpu_limit: 1,
    network_disabled: true
  },
  rust: {
    language: 'rust',
    image: 'rust:1.74-slim',
    timeout_ms: 30000,
    memory_limit_mb: 512,
    cpu_limit: 1,
    network_disabled: true
  }
};
