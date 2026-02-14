import axios, { AxiosInstance } from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

class ApiClient {
  private client: AxiosInstance;
  private apiKey: string | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: API_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add auth interceptor
    this.client.interceptors.request.use((config) => {
      if (this.apiKey) {
        config.headers.Authorization = `Bearer ${this.apiKey}`;
      }
      return config;
    });
  }

  setApiKey(key: string | null) {
    this.apiKey = key;
  }

  // Health check
  async health() {
    const response = await this.client.get('/health');
    return response.data;
  }

  // Agents
  async createAgent(data: { name: string; description?: string }) {
    const response = await this.client.post('/api/agents', data);
    return response.data;
  }

  async getAgent() {
    const response = await this.client.get('/api/agents/me');
    return response.data;
  }

  async updateAgent(data: { name?: string; description?: string; status?: string }) {
    const response = await this.client.patch('/api/agents/me', data);
    return response.data;
  }

  async getAgentQuota() {
    const response = await this.client.get('/api/agents/me/quota');
    return response.data;
  }

  async getAgentActivity(limit?: number) {
    const response = await this.client.get('/api/agents/me/activity', {
      params: { limit },
    });
    return response.data;
  }

  async regenerateApiKey() {
    const response = await this.client.post('/api/agents/me/regenerate-key');
    return response.data;
  }

  // Repositories
  async listRepositories() {
    const response = await this.client.get('/api/repos');
    return response.data;
  }

  async createRepository(data: {
    name: string;
    description?: string;
    is_public?: boolean;
    init_readme?: boolean;
  }) {
    const response = await this.client.post('/api/repos', data);
    return response.data;
  }

  async getRepository(id: string) {
    const response = await this.client.get(`/api/repos/${id}`);
    return response.data;
  }

  async deleteRepository(id: string) {
    await this.client.delete(`/api/repos/${id}`);
  }

  async listFiles(repoId: string, path?: string, ref?: string) {
    const response = await this.client.get(`/api/repos/${repoId}/files`, {
      params: { path, ref },
    });
    return response.data;
  }

  async getFile(repoId: string, path: string, ref?: string) {
    const response = await this.client.get(`/api/repos/${repoId}/files/${path}`, {
      params: { ref },
    });
    return response.data;
  }

  async createFile(
    repoId: string,
    data: { path: string; content: string; message: string; branch?: string }
  ) {
    const response = await this.client.post(`/api/repos/${repoId}/files`, data);
    return response.data;
  }

  async updateFile(
    repoId: string,
    path: string,
    data: { content: string; message: string; branch?: string }
  ) {
    const response = await this.client.put(`/api/repos/${repoId}/files/${path}`, data);
    return response.data;
  }

  // Sandbox
  async getSupportedLanguages() {
    const response = await this.client.get('/api/sandbox/languages');
    return response.data;
  }

  async executeCode(data: {
    language: string;
    code: string;
    timeout_ms?: number;
    repository_id?: string;
  }) {
    const response = await this.client.post('/api/sandbox/execute', data);
    return response.data;
  }

  async executeCodeSync(data: {
    language: string;
    code: string;
    timeout_ms?: number;
    repository_id?: string;
  }) {
    const response = await this.client.post('/api/sandbox/execute/sync', data);
    return response.data;
  }

  async getExecution(id: string) {
    const response = await this.client.get(`/api/sandbox/executions/${id}`);
    return response.data;
  }

  async listExecutions(limit?: number) {
    const response = await this.client.get('/api/sandbox/executions', {
      params: { limit },
    });
    return response.data;
  }

  async getSandboxHealth() {
    const response = await this.client.get('/api/sandbox/health');
    return response.data;
  }

  // External APIs (GitHub/GitLab)
  async getGitHubRepo(owner: string, repo: string) {
    const response = await this.client.get(`/api/external/github/repos/${owner}/${repo}`);
    return response.data;
  }

  async getGitHubReadme(owner: string, repo: string) {
    const response = await this.client.get(`/api/external/github/repos/${owner}/${repo}/readme`);
    return response.data;
  }

  async getGitHubContents(owner: string, repo: string, path?: string, ref?: string) {
    const response = await this.client.get(`/api/external/github/repos/${owner}/${repo}/contents`, {
      params: { path, ref },
    });
    return response.data;
  }

  async getGitHubFile(owner: string, repo: string, path: string, ref?: string) {
    const response = await this.client.get(
      `/api/external/github/repos/${owner}/${repo}/contents/${path}`,
      { params: { ref } }
    );
    return response.data;
  }

  async searchGitHubRepos(query: string, page?: number, per_page?: number) {
    const response = await this.client.get('/api/external/github/search/repositories', {
      params: { query, page, per_page },
    });
    return response.data;
  }

  async getGitHubRateLimit() {
    const response = await this.client.get('/api/external/github/rate_limit');
    return response.data;
  }

  async getGitLabProject(projectId: string) {
    const response = await this.client.get(`/api/external/gitlab/projects/${projectId}`);
    return response.data;
  }

  async searchGitLabProjects(query: string, page?: number, per_page?: number) {
    const response = await this.client.get('/api/external/gitlab/search/projects', {
      params: { query, page, per_page },
    });
    return response.data;
  }
}

export const api = new ApiClient();
export default api;
