import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export const createClient = () => {
  return createClientComponentClient();
};

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          name: string | null;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          name?: string | null;
          avatar_url?: string | null;
        };
        Update: {
          name?: string | null;
          avatar_url?: string | null;
        };
      };
      agents: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          description: string | null;
          api_key_hash: string;
          status: 'active' | 'paused' | 'suspended' | 'deleted';
          permissions: {
            can_create_repos: boolean;
            can_execute_code: boolean;
            can_read_external: boolean;
            max_repos: number;
            max_executions_per_day: number;
          };
          quota: {
            repos_used: number;
            repos_limit: number;
            storage_used_mb: number;
            storage_limit_mb: number;
            executions_today: number;
            executions_limit: number;
            last_reset: string | null;
          };
          created_at: string;
          updated_at: string;
          last_active_at: string | null;
        };
        Insert: {
          user_id: string;
          name: string;
          description?: string | null;
          api_key_hash: string;
          permissions?: any;
          quota?: any;
        };
        Update: {
          name?: string;
          description?: string | null;
          status?: 'active' | 'paused' | 'suspended' | 'deleted';
        };
      };
      repositories: {
        Row: {
          id: string;
          agent_id: string;
          name: string;
          description: string | null;
          is_public: boolean;
          clone_url: string | null;
          default_branch: string;
          size_mb: number;
          commits_count: number;
          created_at: string;
          updated_at: string;
        };
      };
      executions: {
        Row: {
          id: string;
          agent_id: string;
          repository_id: string | null;
          status: 'queued' | 'running' | 'completed' | 'failed' | 'timeout' | 'killed';
          language: string;
          code: string;
          stdout: string | null;
          stderr: string | null;
          exit_code: number | null;
          duration_ms: number | null;
          memory_used_mb: number | null;
          created_at: string;
          started_at: string | null;
          completed_at: string | null;
        };
      };
      activity_logs: {
        Row: {
          id: string;
          agent_id: string;
          action: string;
          details: Record<string, any>;
          ip_address: string | null;
          created_at: string;
        };
      };
    };
  };
};
