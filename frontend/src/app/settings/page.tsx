'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '@/components/Layout';
import { useAppStore } from '@/lib/store';
import api from '@/lib/api';
import { 
  Settings, 
  Key, 
  Bot, 
  Shield, 
  Loader2,
  Copy,
  RefreshCw,
  Check,
  AlertTriangle
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function SettingsPage() {
  const router = useRouter();
  const { agent, apiKey, isAuthenticated, setAgent, logout } = useAppStore();
  
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [newApiKey, setNewApiKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !apiKey) {
      router.push('/');
      return;
    }
    api.setApiKey(apiKey);
    
    if (agent) {
      setName(agent.name);
      setDescription(agent.description || '');
    }
  }, [isAuthenticated, apiKey, router, agent]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    try {
      const updated = await api.updateAgent({
        name: name.trim(),
        description: description.trim() || undefined,
      });
      setAgent({ ...agent, ...updated });
      toast.success('Settings saved');
    } catch (error: any) {
      console.error('Save error:', error);
      toast.error(error.response?.data?.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleRegenerateKey = async () => {
    if (!confirm('Are you sure? Your current API key will be invalidated.')) return;

    setRegenerating(true);
    try {
      const res = await api.regenerateApiKey();
      setNewApiKey(res.api_key);
      toast.success('API key regenerated');
    } catch (error: any) {
      console.error('Regenerate error:', error);
      toast.error('Failed to regenerate API key');
    } finally {
      setRegenerating(false);
    }
  };

  const handleCopy = async () => {
    if (newApiKey) {
      await navigator.clipboard.writeText(newApiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('Copied to clipboard');
    }
  };

  const handleUseNewKey = () => {
    if (newApiKey) {
      useAppStore.getState().setApiKey(newApiKey);
      api.setApiKey(newApiKey);
      setNewApiKey(null);
      toast.success('Now using new API key');
    }
  };

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
          <Settings className="w-8 h-8 text-primary-500" />
          Settings
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Manage your agent configuration and credentials
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Agent Settings */}
        <div className="card">
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
            <Bot className="w-5 h-5 text-primary-500" />
            Agent Profile
          </h2>
          
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="label">Agent Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input"
                required
              />
            </div>
            
            <div>
              <label className="label">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="input resize-none"
                rows={3}
                placeholder="What does your agent do?"
              />
            </div>
            
            <div>
              <label className="label">Agent ID</label>
              <input
                type="text"
                value={agent?.id || ''}
                className="input bg-gray-100 dark:bg-gray-700"
                disabled
              />
            </div>
            
            <div>
              <label className="label">Status</label>
              <div className="flex items-center gap-2">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  agent?.status === 'active' 
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                }`}>
                  {agent?.status || 'unknown'}
                </span>
              </div>
            </div>
            
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="btn btn-primary w-full flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Save Changes'}
            </button>
          </form>
        </div>

        {/* API Key Management */}
        <div className="card">
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
            <Key className="w-5 h-5 text-primary-500" />
            API Key
          </h2>
          
          <div className="space-y-4">
            <div>
              <label className="label">Current API Key</label>
              <input
                type="password"
                value="••••••••••••••••••••••••••••••••"
                className="input bg-gray-100 dark:bg-gray-700"
                disabled
              />
              <p className="text-xs text-gray-500 mt-1">
                Your API key is securely stored
              </p>
            </div>
            
            {/* New API Key Display */}
            {newApiKey && (
              <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl">
                <div className="flex items-start gap-2 mb-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-yellow-800 dark:text-yellow-300">
                      New API Key Generated
                    </p>
                    <p className="text-sm text-yellow-700 dark:text-yellow-400">
                      Save this key now - it won't be shown again!
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 mt-3">
                  <code className="flex-1 p-3 bg-white dark:bg-gray-800 rounded-lg text-sm font-mono break-all">
                    {newApiKey}
                  </code>
                  <button
                    onClick={handleCopy}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                    title="Copy"
                  >
                    {copied ? (
                      <Check className="w-5 h-5 text-green-500" />
                    ) : (
                      <Copy className="w-5 h-5" />
                    )}
                  </button>
                </div>
                
                <button
                  onClick={handleUseNewKey}
                  className="btn btn-primary w-full mt-3"
                >
                  Use this key now
                </button>
              </div>
            )}
            
            <button
              onClick={handleRegenerateKey}
              disabled={regenerating}
              className="btn btn-secondary w-full flex items-center justify-center gap-2"
            >
              {regenerating ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <RefreshCw className="w-5 h-5" />
              )}
              Regenerate API Key
            </button>
            
            <p className="text-xs text-gray-500">
              ⚠️ Regenerating will invalidate your current key. Make sure to update it everywhere it's used.
            </p>
          </div>
        </div>

        {/* Permissions */}
        <div className="card">
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
            <Shield className="w-5 h-5 text-primary-500" />
            Permissions
          </h2>
          
          <div className="space-y-3">
            <PermissionItem
              label="Create Repositories"
              enabled={agent?.permissions?.can_create_repos}
            />
            <PermissionItem
              label="Execute Code"
              enabled={agent?.permissions?.can_execute_code}
            />
            <PermissionItem
              label="Read External Repos"
              enabled={agent?.permissions?.can_read_external}
            />
            
            <div className="pt-3 border-t dark:border-gray-700">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Max Repositories</span>
                <span className="font-medium">{agent?.permissions?.max_repos || 10}</span>
              </div>
              <div className="flex justify-between text-sm mt-2">
                <span className="text-gray-600 dark:text-gray-400">Max Daily Executions</span>
                <span className="font-medium">{agent?.permissions?.max_executions_per_day || 100}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="card border-red-200 dark:border-red-900">
          <h2 className="text-lg font-semibold text-red-600 mb-4">
            Danger Zone
          </h2>
          
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Logging out will clear your stored API key. You'll need to enter it again to access your agent.
          </p>
          
          <button
            onClick={() => {
              logout();
              router.push('/');
            }}
            className="btn btn-danger w-full"
          >
            Log Out
          </button>
        </div>
      </div>
    </Layout>
  );
}

function PermissionItem({ label, enabled }: { label: string; enabled?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-700 dark:text-gray-300">{label}</span>
      <span className={`px-2 py-1 rounded text-xs font-medium ${
        enabled
          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
          : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-400'
      }`}>
        {enabled ? 'Enabled' : 'Disabled'}
      </span>
    </div>
  );
}
