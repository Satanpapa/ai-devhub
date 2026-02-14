'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '@/components/Layout';
import { useAppStore } from '@/lib/store';
import api from '@/lib/api';
import { 
  Globe, 
  Search, 
  Github, 
  GitlabIcon,
  Star,
  GitFork,
  Loader2,
  ExternalLink,
  FileCode,
  BookOpen
} from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

interface SearchResult {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  language: string | null;
  stargazers_count?: number;
  star_count?: number;
  forks_count?: number;
  updated_at: string;
}

export default function External() {
  const router = useRouter();
  const { apiKey, isAuthenticated } = useAppStore();
  
  const [provider, setProvider] = useState<'github' | 'gitlab'>('github');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState<any>(null);
  const [repoDetails, setRepoDetails] = useState<any>(null);
  const [readme, setReadme] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !apiKey) {
      router.push('/');
      return;
    }
    api.setApiKey(apiKey);
  }, [isAuthenticated, apiKey, router]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setResults([]);
    setSelectedRepo(null);
    setRepoDetails(null);
    setReadme(null);

    try {
      if (provider === 'github') {
        const res = await api.searchGitHubRepos(query, 1, 20);
        setResults(res.items || []);
      } else {
        const res = await api.searchGitLabProjects(query, 1, 20);
        setResults(res.items || []);
      }
    } catch (error) {
      console.error('Search error:', error);
      toast.error('Search failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectRepo = async (repo: SearchResult) => {
    setSelectedRepo(repo);
    setRepoDetails(null);
    setReadme(null);

    try {
      if (provider === 'github') {
        const [owner, name] = repo.full_name.split('/');
        const [details, readmeRes] = await Promise.all([
          api.getGitHubRepo(owner, name),
          api.getGitHubReadme(owner, name).catch(() => ({ content: null })),
        ]);
        setRepoDetails(details);
        setReadme(readmeRes.content);
      } else {
        const details = await api.getGitLabProject(repo.id.toString());
        setRepoDetails(details);
      }
    } catch (error) {
      console.error('Failed to fetch repo details:', error);
    }
  };

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
          <Globe className="w-8 h-8 text-primary-500" />
          External Repositories
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Browse and analyze public repositories from GitHub and GitLab (read-only)
        </p>
      </div>

      {/* Provider Toggle */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => { setProvider('github'); setResults([]); setSelectedRepo(null); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
            provider === 'github'
              ? 'bg-gray-900 text-white'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
          }`}
        >
          <Github className="w-5 h-5" />
          GitHub
        </button>
        <button
          onClick={() => { setProvider('gitlab'); setResults([]); setSelectedRepo(null); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
            provider === 'gitlab'
              ? 'bg-orange-600 text-white'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
          }`}
        >
          <GitlabIcon className="w-5 h-5" />
          GitLab
        </button>
      </div>

      {/* Search Form */}
      <form onSubmit={handleSearch} className="flex gap-3 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${provider === 'github' ? 'GitHub' : 'GitLab'} repositories...`}
            className="input pl-10"
          />
        </div>
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="btn btn-primary flex items-center gap-2"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
          Search
        </button>
      </form>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Search Results */}
        <div>
          <h2 className="text-lg font-semibold mb-4">
            {results.length > 0 ? `Results (${results.length})` : 'Search Results'}
          </h2>
          
          {results.length === 0 && !loading && (
            <div className="card text-center py-12">
              <Search className="w-12 h-12 mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500">Search for repositories to explore</p>
            </div>
          )}
          
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
            </div>
          )}
          
          <div className="space-y-3 max-h-[600px] overflow-y-auto">
            {results.map((repo) => (
              <div
                key={repo.id}
                onClick={() => handleSelectRepo(repo)}
                className={`card cursor-pointer transition-all hover:shadow-lg ${
                  selectedRepo?.id === repo.id ? 'ring-2 ring-primary-500' : ''
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-primary-600 dark:text-primary-400">
                    {repo.full_name || repo.name}
                  </h3>
                  <a
                    href={repo.html_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
                
                {repo.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-3">
                    {repo.description}
                  </p>
                )}
                
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  {repo.language && (
                    <span className="flex items-center gap-1">
                      <FileCode className="w-4 h-4" />
                      {repo.language}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Star className="w-4 h-4" />
                    {repo.stargazers_count || repo.star_count || 0}
                  </span>
                  <span className="flex items-center gap-1">
                    <GitFork className="w-4 h-4" />
                    {repo.forks_count || 0}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Repository Details */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Repository Details</h2>
          
          {!selectedRepo ? (
            <div className="card text-center py-12">
              <BookOpen className="w-12 h-12 mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500">Select a repository to view details</p>
            </div>
          ) : (
            <div className="card">
              <div className="flex items-center gap-3 mb-4">
                {provider === 'github' ? (
                  <Github className="w-8 h-8" />
                ) : (
                  <GitlabIcon className="w-8 h-8 text-orange-600" />
                )}
                <div>
                  <h3 className="font-bold text-lg">{selectedRepo.full_name || selectedRepo.name}</h3>
                  <a
                    href={selectedRepo.html_url || repoDetails?.web_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary-500 hover:underline"
                  >
                    View on {provider === 'github' ? 'GitHub' : 'GitLab'} →
                  </a>
                </div>
              </div>
              
              {selectedRepo.description && (
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  {selectedRepo.description}
                </p>
              )}
              
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <p className="text-sm text-gray-500">Stars</p>
                  <p className="text-xl font-bold">
                    {selectedRepo.stargazers_count || selectedRepo.star_count || 0}
                  </p>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <p className="text-sm text-gray-500">Forks</p>
                  <p className="text-xl font-bold">{selectedRepo.forks_count || 0}</p>
                </div>
              </div>
              
              {repoDetails?.languages && (
                <div className="mb-4">
                  <p className="text-sm text-gray-500 mb-2">Languages</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.keys(repoDetails.languages).map((lang) => (
                      <span
                        key={lang}
                        className="px-2 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded text-xs font-medium"
                      >
                        {lang}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              
              {readme && (
                <div>
                  <p className="text-sm text-gray-500 mb-2">README Preview</p>
                  <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg max-h-[300px] overflow-y-auto">
                    <pre className="text-sm whitespace-pre-wrap font-mono">
                      {readme.slice(0, 2000)}
                      {readme.length > 2000 && '...'}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
