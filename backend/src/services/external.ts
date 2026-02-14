import axios, { AxiosInstance } from 'axios';
import { config } from '../utils/config';

interface ExternalRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  clone_url: string;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  default_branch: string;
  created_at: string;
  updated_at: string;
}

interface FileContent {
  name: string;
  path: string;
  type: 'file' | 'dir';
  content?: string;
  encoding?: string;
  size: number;
  sha: string;
}

interface SearchResult {
  total_count: number;
  items: ExternalRepo[];
}

export class GitHubReadOnlyService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: 'https://api.github.com',
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'AI-DevHub',
        ...(config.GITHUB_TOKEN && {
          'Authorization': `token ${config.GITHUB_TOKEN}`,
        }),
      },
    });
  }

  async getRepository(owner: string, repo: string): Promise<ExternalRepo | null> {
    try {
      const response = await this.client.get(`/repos/${owner}/${repo}`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  async getFileContent(
    owner: string,
    repo: string,
    path: string,
    ref?: string
  ): Promise<string | null> {
    try {
      const response = await this.client.get(
        `/repos/${owner}/${repo}/contents/${path}`,
        { params: ref ? { ref } : {} }
      );

      if (response.data.type !== 'file') {
        throw new Error('Path is not a file');
      }

      return Buffer.from(response.data.content, 'base64').toString('utf8');
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  async listContents(
    owner: string,
    repo: string,
    path: string = '',
    ref?: string
  ): Promise<FileContent[]> {
    try {
      const response = await this.client.get(
        `/repos/${owner}/${repo}/contents/${path}`,
        { params: ref ? { ref } : {} }
      );

      return Array.isArray(response.data) ? response.data : [response.data];
    } catch (error: any) {
      if (error.response?.status === 404) {
        return [];
      }
      throw error;
    }
  }

  async getReadme(owner: string, repo: string): Promise<string | null> {
    try {
      const response = await this.client.get(`/repos/${owner}/${repo}/readme`);
      return Buffer.from(response.data.content, 'base64').toString('utf8');
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  async listBranches(owner: string, repo: string): Promise<string[]> {
    const response = await this.client.get(`/repos/${owner}/${repo}/branches`);
    return response.data.map((b: any) => b.name);
  }

  async listCommits(
    owner: string,
    repo: string,
    options: { sha?: string; page?: number; per_page?: number } = {}
  ): Promise<any[]> {
    const response = await this.client.get(`/repos/${owner}/${repo}/commits`, {
      params: {
        sha: options.sha,
        page: options.page || 1,
        per_page: options.per_page || 30,
      },
    });
    return response.data;
  }

  async searchRepositories(
    query: string,
    options: {
      sort?: 'stars' | 'forks' | 'updated';
      order?: 'asc' | 'desc';
      page?: number;
      per_page?: number;
    } = {}
  ): Promise<SearchResult> {
    const response = await this.client.get('/search/repositories', {
      params: {
        q: query,
        sort: options.sort || 'stars',
        order: options.order || 'desc',
        page: options.page || 1,
        per_page: Math.min(options.per_page || 30, 100),
      },
    });
    return response.data;
  }

  async searchCode(
    query: string,
    options: {
      page?: number;
      per_page?: number;
    } = {}
  ): Promise<any> {
    const response = await this.client.get('/search/code', {
      params: {
        q: query,
        page: options.page || 1,
        per_page: Math.min(options.per_page || 30, 100),
      },
    });
    return response.data;
  }

  async getLanguages(owner: string, repo: string): Promise<Record<string, number>> {
    const response = await this.client.get(`/repos/${owner}/${repo}/languages`);
    return response.data;
  }

  async getRateLimit(): Promise<{ limit: number; remaining: number; reset: Date }> {
    const response = await this.client.get('/rate_limit');
    const core = response.data.resources.core;
    return {
      limit: core.limit,
      remaining: core.remaining,
      reset: new Date(core.reset * 1000),
    };
  }
}

export class GitLabReadOnlyService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: 'https://gitlab.com/api/v4',
      headers: {
        'Accept': 'application/json',
        ...(config.GITLAB_TOKEN && {
          'PRIVATE-TOKEN': config.GITLAB_TOKEN,
        }),
      },
    });
  }

  async getProject(projectId: string | number): Promise<any | null> {
    try {
      const encodedId = typeof projectId === 'string' 
        ? encodeURIComponent(projectId) 
        : projectId;
      const response = await this.client.get(`/projects/${encodedId}`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  async getFileContent(
    projectId: string | number,
    path: string,
    ref: string = 'main'
  ): Promise<string | null> {
    try {
      const encodedId = typeof projectId === 'string' 
        ? encodeURIComponent(projectId) 
        : projectId;
      const encodedPath = encodeURIComponent(path);
      
      const response = await this.client.get(
        `/projects/${encodedId}/repository/files/${encodedPath}`,
        { params: { ref } }
      );

      return Buffer.from(response.data.content, 'base64').toString('utf8');
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  async listTree(
    projectId: string | number,
    path: string = '',
    ref: string = 'main'
  ): Promise<any[]> {
    try {
      const encodedId = typeof projectId === 'string' 
        ? encodeURIComponent(projectId) 
        : projectId;
      
      const response = await this.client.get(
        `/projects/${encodedId}/repository/tree`,
        { params: { path, ref, per_page: 100 } }
      );

      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return [];
      }
      throw error;
    }
  }

  async listBranches(projectId: string | number): Promise<string[]> {
    const encodedId = typeof projectId === 'string' 
      ? encodeURIComponent(projectId) 
      : projectId;
    
    const response = await this.client.get(`/projects/${encodedId}/repository/branches`);
    return response.data.map((b: any) => b.name);
  }

  async listCommits(
    projectId: string | number,
    options: { ref_name?: string; page?: number; per_page?: number } = {}
  ): Promise<any[]> {
    const encodedId = typeof projectId === 'string' 
      ? encodeURIComponent(projectId) 
      : projectId;
    
    const response = await this.client.get(`/projects/${encodedId}/repository/commits`, {
      params: {
        ref_name: options.ref_name,
        page: options.page || 1,
        per_page: options.per_page || 20,
      },
    });
    return response.data;
  }

  async searchProjects(
    query: string,
    options: { page?: number; per_page?: number } = {}
  ): Promise<any[]> {
    const response = await this.client.get('/projects', {
      params: {
        search: query,
        page: options.page || 1,
        per_page: Math.min(options.per_page || 20, 100),
        order_by: 'last_activity_at',
        sort: 'desc',
      },
    });
    return response.data;
  }

  async getLanguages(projectId: string | number): Promise<Record<string, number>> {
    const encodedId = typeof projectId === 'string' 
      ? encodeURIComponent(projectId) 
      : projectId;
    
    const response = await this.client.get(`/projects/${encodedId}/languages`);
    return response.data;
  }
}

export const githubService = new GitHubReadOnlyService();
export const gitlabService = new GitLabReadOnlyService();
