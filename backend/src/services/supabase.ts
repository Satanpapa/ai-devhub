import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../utils/config';

let supabase: SupabaseClient | null = null;
let supabaseAdmin: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!supabase) {
    supabase = createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);
  }
  return supabase;
}

export function getSupabaseAdmin(): SupabaseClient {
  if (!supabaseAdmin) {
    supabaseAdmin = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  }
  return supabaseAdmin;
}

// Database operations for agents
export const agentDb = {
  async create(data: {
    user_id: string;
    name: string;
    description?: string;
    api_key_hash: string;
    permissions: Record<string, any>;
    quota: Record<string, any>;
  }) {
    const { data: agent, error } = await getSupabaseAdmin()
      .from('agents')
      .insert({
        ...data,
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();
    
    if (error) throw error;
    return agent;
  },

  async findById(id: string) {
    const { data, error } = await getSupabaseAdmin()
      .from('agents')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  async findByApiKeyHash(hash: string) {
    const { data, error } = await getSupabaseAdmin()
      .from('agents')
      .select('*')
      .eq('api_key_hash', hash)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  async findByUserId(userId: string) {
    const { data, error } = await getSupabaseAdmin()
      .from('agents')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  },

  async update(id: string, data: Partial<Record<string, any>>) {
    const { data: agent, error } = await getSupabaseAdmin()
      .from('agents')
      .update({
        ...data,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return agent;
  },

  async updateLastActive(id: string) {
    return this.update(id, { last_active_at: new Date().toISOString() });
  },

  async incrementQuota(id: string, field: 'repos_used' | 'executions_today') {
    const agent = await this.findById(id);
    if (!agent) throw new Error('Agent not found');
    
    const quota = agent.quota;
    quota[field] = (quota[field] || 0) + 1;
    
    return this.update(id, { quota });
  }
};

// Database operations for repositories
export const repoDb = {
  async create(data: {
    agent_id: string;
    name: string;
    description?: string;
    is_public?: boolean;
    gitea_repo_id?: number;
    clone_url?: string;
  }) {
    const { data: repo, error } = await getSupabaseAdmin()
      .from('repositories')
      .insert({
        ...data,
        is_public: data.is_public ?? false,
        default_branch: 'main',
        size_mb: 0,
        commits_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();
    
    if (error) throw error;
    return repo;
  },

  async findById(id: string) {
    const { data, error } = await getSupabaseAdmin()
      .from('repositories')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  async findByAgentId(agentId: string) {
    const { data, error } = await getSupabaseAdmin()
      .from('repositories')
      .select('*')
      .eq('agent_id', agentId)
      .order('updated_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  },

  async update(id: string, data: Partial<Record<string, any>>) {
    const { data: repo, error } = await getSupabaseAdmin()
      .from('repositories')
      .update({
        ...data,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return repo;
  },

  async delete(id: string) {
    const { error } = await getSupabaseAdmin()
      .from('repositories')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  }
};

// Database operations for executions
export const executionDb = {
  async create(data: {
    agent_id: string;
    repository_id?: string;
    language: string;
    code: string;
  }) {
    const { data: execution, error } = await getSupabaseAdmin()
      .from('executions')
      .insert({
        ...data,
        status: 'queued',
        created_at: new Date().toISOString(),
      })
      .select()
      .single();
    
    if (error) throw error;
    return execution;
  },

  async findById(id: string) {
    const { data, error } = await getSupabaseAdmin()
      .from('executions')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  async findByAgentId(agentId: string, limit = 50) {
    const { data, error } = await getSupabaseAdmin()
      .from('executions')
      .select('*')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) throw error;
    return data || [];
  },

  async update(id: string, data: Partial<Record<string, any>>) {
    const { data: execution, error } = await getSupabaseAdmin()
      .from('executions')
      .update(data)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return execution;
  }
};

// Activity logging
export const activityDb = {
  async log(data: {
    agent_id: string;
    action: string;
    details?: Record<string, any>;
    ip_address?: string;
  }) {
    const { error } = await getSupabaseAdmin()
      .from('activity_logs')
      .insert({
        ...data,
        details: data.details || {},
        created_at: new Date().toISOString(),
      });
    
    if (error) console.error('Failed to log activity:', error);
  },

  async findByAgentId(agentId: string, limit = 100) {
    const { data, error } = await getSupabaseAdmin()
      .from('activity_logs')
      .select('*')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) throw error;
    return data || [];
  }
};
