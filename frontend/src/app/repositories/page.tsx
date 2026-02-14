'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '@/components/Layout';
import { useAppStore, useRepoStore } from '@/lib/store';
import api from '@/lib/api';
import { 
  FolderGit2, 
  Plus, 
  Trash2, 
  GitBranch, 
  Clock, 
  Lock, 
  Globe,
  Loader2,
  X,
  ExternalLink
} from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

export default function Repositories() {
  const router = useRouter();
  const { apiKey, isAuthenticated } = useAppStore();
  const { repositories, setRepositories, addRepository, removeRepository, loading, setLoading } = useRepoStore();
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !apiKey) {
      router.push('/');
      return;
    }
    
    api.setApiKey(apiKey);
    fetchRepos();
  }, [isAuthenticated, apiKey, router]);

  const fetchRepos = async () => {
    setLoading(true);
    try {
      const res = await api.listRepositories();
      setRepositories(res.repositories || []);
    } catch (error) {
      console.error('Failed to fetch repos:', error);
      toast.error('Failed to load repositories');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete repository "${name}"? This action cannot be undone.`)) return;
    
    try {
      await api.deleteRepository(id);
      removeRepository(id);
      toast.success('Repository deleted');
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Failed to delete repository');
    }
  };

  return (
    <Layout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <FolderGit2 className="w-8 h-8 text-primary-500" />
            Repositories
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage your agent's code repositories
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn btn-primary flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          New Repository
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-[40vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
        </div>
      ) : repositories.length === 0 ? (
        <div className="card text-center py-12">
          <FolderGit2 className="w-16 h-16 mx-auto text-gray-300 mb-4" />
          <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
            No repositories yet
          </h3>
          <p className="text-gray-500 mb-6">
            Create your first repository to start coding
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn btn-primary inline-flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Create Repository
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {repositories.map((repo) => (
            <div key={repo.id} className="card hover:shadow-xl transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  {repo.is_public ? (
                    <Globe className="w-4 h-4 text-green-500" />
                  ) : (
                    <Lock className="w-4 h-4 text-yellow-500" />
                  )}
                  <h3 className="font-semibold text-lg">{repo.name}</h3>
                </div>
                <button
                  onClick={() => handleDelete(repo.id, repo.name)}
                  className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              
              {repo.description && (
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-4 line-clamp-2">
                  {repo.description}
                </p>
              )}
              
              <div className="flex items-center gap-4 text-sm text-gray-500">
                <span className="flex items-center gap-1">
                  <GitBranch className="w-4 h-4" />
                  {repo.default_branch}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {format(new Date(repo.updated_at), 'MMM d')}
                </span>
              </div>
              
              <div className="mt-4 pt-4 border-t dark:border-gray-700 flex items-center justify-between">
                <span className="text-xs text-gray-400">
                  {repo.commits_count} commits · {repo.size_mb} MB
                </span>
                {repo.clone_url && (
                  <a
                    href={repo.clone_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary-500 hover:text-primary-600 flex items-center gap-1 text-sm"
                  >
                    Open <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <CreateRepoModal
          onClose={() => setShowCreateModal(false)}
          onCreated={(repo) => {
            addRepository(repo);
            setShowCreateModal(false);
            toast.success('Repository created!');
          }}
        />
      )}
    </Layout>
  );
}

function CreateRepoModal({ 
  onClose, 
  onCreated 
}: { 
  onClose: () => void; 
  onCreated: (repo: any) => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [initReadme, setInitReadme] = useState(true);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    try {
      const repo = await api.createRepository({
        name: name.trim(),
        description: description.trim() || undefined,
        is_public: isPublic,
        init_readme: initReadme,
      });
      onCreated(repo);
    } catch (error: any) {
      console.error('Create error:', error);
      toast.error(error.response?.data?.message || 'Failed to create repository');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="card w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Create Repository</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Repository Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))}
              placeholder="my-awesome-project"
              className="input"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Only letters, numbers, hyphens and underscores
            </p>
          </div>

          <div>
            <label className="label">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this repository contain?"
              className="input resize-none"
              rows={3}
            />
          </div>

          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300"
              />
              <span className="text-sm">Public repository</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={initReadme}
                onChange={(e) => setInitReadme(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300"
              />
              <span className="text-sm">Initialize with README</span>
            </label>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary flex-1"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="btn btn-primary flex-1 flex items-center justify-center gap-2"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Plus className="w-5 h-5" />
                  Create
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
