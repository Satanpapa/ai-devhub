'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '@/components/Layout';
import { useAppStore, useRepoStore, useExecutionStore } from '@/lib/store';
import api from '@/lib/api';
import { 
  Bot, 
  FolderGit2, 
  Terminal, 
  Activity,
  Zap,
  Database,
  Clock,
  TrendingUp
} from 'lucide-react';
import { format } from 'date-fns';

interface QuotaInfo {
  repositories: { used: number; limit: number; remaining: number };
  storage: { used_mb: number; limit_mb: number; remaining_mb: number };
  executions: { today: number; limit: number; remaining: number; resets_at: string };
}

interface ActivityLog {
  id: string;
  action: string;
  details: Record<string, any>;
  created_at: string;
}

export default function Dashboard() {
  const router = useRouter();
  const { agent, apiKey, isAuthenticated } = useAppStore();
  const { repositories, setRepositories } = useRepoStore();
  const { executions, setExecutions } = useExecutionStore();
  const [quota, setQuota] = useState<QuotaInfo | null>(null);
  const [activity, setActivity] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated || !apiKey) {
      router.push('/');
      return;
    }

    api.setApiKey(apiKey);
    
    const fetchData = async () => {
      try {
        const [quotaRes, reposRes, execsRes, activityRes] = await Promise.all([
          api.getAgentQuota(),
          api.listRepositories(),
          api.listExecutions(10),
          api.getAgentActivity(20),
        ]);
        
        setQuota(quotaRes);
        setRepositories(reposRes.repositories || []);
        setExecutions(execsRes.executions || []);
        setActivity(activityRes.logs || []);
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [isAuthenticated, apiKey, router, setRepositories, setExecutions]);

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Welcome back, {agent?.name || 'Agent'}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Repositories"
          value={repositories.length}
          subtitle={quota ? `${quota.repositories.remaining} available` : ''}
          icon={FolderGit2}
          color="blue"
        />
        <StatCard
          title="Executions Today"
          value={quota?.executions.today || 0}
          subtitle={quota ? `${quota.executions.remaining} remaining` : ''}
          icon={Terminal}
          color="green"
        />
        <StatCard
          title="Storage Used"
          value={`${quota?.storage.used_mb || 0} MB`}
          subtitle={quota ? `of ${quota.storage.limit_mb} MB` : ''}
          icon={Database}
          color="purple"
        />
        <StatCard
          title="Status"
          value={agent?.status === 'active' ? 'Active' : 'Inactive'}
          subtitle={agent?.last_active_at ? `Last: ${format(new Date(agent.last_active_at), 'HH:mm')}` : 'New agent'}
          icon={Zap}
          color={agent?.status === 'active' ? 'emerald' : 'red'}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Terminal className="w-5 h-5 text-primary-500" />
              Recent Executions
            </h2>
            <button 
              onClick={() => router.push('/sandbox')}
              className="text-sm text-primary-500 hover:text-primary-600"
            >
              View all →
            </button>
          </div>
          
          {executions.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No executions yet</p>
          ) : (
            <div className="space-y-3">
              {executions.slice(0, 5).map((exec) => (
                <div
                  key={exec.id}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <StatusBadge status={exec.status} />
                    <div>
                      <p className="font-medium text-sm">{exec.language}</p>
                      <p className="text-xs text-gray-500">
                        {format(new Date(exec.created_at), 'MMM d, HH:mm')}
                      </p>
                    </div>
                  </div>
                  {exec.duration_ms && (
                    <span className="text-sm text-gray-500">{exec.duration_ms}ms</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary-500" />
              Recent Activity
            </h2>
          </div>
          
          {activity.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No activity yet</p>
          ) : (
            <div className="space-y-3">
              {activity.slice(0, 8).map((log) => (
                <div
                  key={log.id}
                  className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                >
                  <div className="p-1.5 bg-primary-100 dark:bg-primary-900/30 rounded">
                    <Activity className="w-3 h-3 text-primary-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{log.action}</p>
                    <p className="text-xs text-gray-500">
                      {format(new Date(log.created_at), 'MMM d, HH:mm:ss')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {quota && (
        <div className="card mt-6">
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-primary-500" />
            Resource Quotas
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <QuotaBar label="Repositories" used={quota.repositories.used} limit={quota.repositories.limit} color="blue" />
            <QuotaBar label="Daily Executions" used={quota.executions.today} limit={quota.executions.limit} color="green" />
            <QuotaBar label="Storage (MB)" used={quota.storage.used_mb} limit={quota.storage.limit_mb} color="purple" />
          </div>
          
          <p className="text-xs text-gray-500 mt-4 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Execution quota resets at {format(new Date(quota.executions.resets_at), 'HH:mm')}
          </p>
        </div>
      )}
    </Layout>
  );
}

function StatCard({ title, value, subtitle, icon: Icon, color }: { title: string; value: string | number; subtitle: string; icon: any; color: string; }) {
  const colorClasses: Record<string, string> = {
    blue: 'from-blue-500 to-blue-600',
    green: 'from-green-500 to-green-600',
    purple: 'from-purple-500 to-purple-600',
    emerald: 'from-emerald-500 to-emerald-600',
    red: 'from-red-500 to-red-600',
  };

  return (
    <div className="card">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
          <p className="text-xs text-gray-400 mt-1">{subtitle}</p>
        </div>
        <div className={`p-3 rounded-xl bg-gradient-to-br ${colorClasses[color]}`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const statusConfig: Record<string, { color: string; label: string }> = {
    completed: { color: 'bg-green-100 text-green-700', label: '✓' },
    running: { color: 'bg-blue-100 text-blue-700', label: '⟳' },
    queued: { color: 'bg-yellow-100 text-yellow-700', label: '◷' },
    failed: { color: 'bg-red-100 text-red-700', label: '✗' },
    timeout: { color: 'bg-orange-100 text-orange-700', label: '⏱' },
  };
  const config = statusConfig[status] || { color: 'bg-gray-100 text-gray-700', label: '?' };
  return <span className={`px-2 py-1 rounded text-xs font-medium ${config.color}`}>{config.label}</span>;
}

function QuotaBar({ label, used, limit, color }: { label: string; used: number; limit: number; color: string; }) {
  const percentage = Math.min((used / limit) * 100, 100);
  const colorClasses: Record<string, string> = { blue: 'bg-blue-500', green: 'bg-green-500', purple: 'bg-purple-500' };
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-600 dark:text-gray-400">{label}</span>
        <span className="font-medium">{used} / {limit}</span>
      </div>
      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full ${colorClasses[color]} transition-all duration-500`} style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}
