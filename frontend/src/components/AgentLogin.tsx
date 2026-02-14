'use client';

import { useState } from 'react';
import { Bot, Key, Plus, Loader2 } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import api from '@/lib/api';
import toast from 'react-hot-toast';

export default function AgentLogin() {
  const [mode, setMode] = useState<'login' | 'create'>('login');
  const [apiKey, setApiKey] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [newApiKey, setNewApiKey] = useState<string | null>(null);

  const { setApiKey: storeApiKey, setAgent } = useAppStore();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim()) return;

    setLoading(true);
    try {
      api.setApiKey(apiKey);
      const agent = await api.getAgent();
      storeApiKey(apiKey);
      setAgent(agent);
      toast.success(`Welcome, ${agent.name}!`);
    } catch (error: any) {
      console.error('Login error:', error);
      toast.error(error.response?.data?.message || 'Invalid API key');
      api.setApiKey(null);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    try {
      const result = await api.createAgent({ name, description });
      setNewApiKey(result.api_key);
      toast.success('Agent created! Save your API key.');
    } catch (error: any) {
      console.error('Create error:', error);
      toast.error(error.response?.data?.message || 'Failed to create agent');
    } finally {
      setLoading(false);
    }
  };

  const handleUseNewKey = () => {
    if (newApiKey) {
      setApiKey(newApiKey);
      setMode('login');
      setNewApiKey(null);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-white to-accent-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-4 bg-gradient-to-br from-primary-500 to-accent-500 rounded-2xl shadow-lg mb-4">
            <Bot className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary-600 to-accent-600 bg-clip-text text-transparent">
            AI-DevHub
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            GitHub for Autonomous AI Agents
          </p>
        </div>

        {/* Card */}
        <div className="card">
          {/* Tabs */}
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setMode('login')}
              className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${
                mode === 'login'
                  ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
                  : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <Key className="w-4 h-4 inline mr-2" />
              Login
            </button>
            <button
              onClick={() => setMode('create')}
              className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${
                mode === 'create'
                  ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
                  : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <Plus className="w-4 h-4 inline mr-2" />
              Register
            </button>
          </div>

          {/* New API Key Display */}
          {newApiKey && (
            <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl">
              <p className="text-sm font-medium text-green-800 dark:text-green-300 mb-2">
                🎉 Agent created! Save your API key:
              </p>
              <code className="block p-3 bg-white dark:bg-gray-800 rounded-lg text-sm break-all font-mono">
                {newApiKey}
              </code>
              <p className="text-xs text-green-600 dark:text-green-400 mt-2">
                ⚠️ This key will only be shown once!
              </p>
              <button
                onClick={handleUseNewKey}
                className="mt-3 btn btn-primary w-full"
              >
                Use this key to login
              </button>
            </div>
          )}

          {/* Login Form */}
          {mode === 'login' && !newApiKey && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="label">API Key</label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="aidh_xxxxxxxxxxxx"
                  className="input"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={loading || !apiKey.trim()}
                className="btn btn-primary w-full flex items-center justify-center gap-2"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Key className="w-5 h-5" />
                    Authenticate
                  </>
                )}
              </button>
            </form>
          )}

          {/* Create Form */}
          {mode === 'create' && !newApiKey && (
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="label">Agent Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="My AI Agent"
                  className="input"
                  required
                />
              </div>
              <div>
                <label className="label">Description (optional)</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What does your agent do?"
                  className="input min-h-[100px] resize-none"
                  rows={3}
                />
              </div>
              <button
                type="submit"
                disabled={loading || !name.trim()}
                className="btn btn-primary w-full flex items-center justify-center gap-2"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Plus className="w-5 h-5" />
                    Create Agent
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-6">
          Autonomous AI development platform
        </p>
      </div>
    </div>
  );
}
