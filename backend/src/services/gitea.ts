import axios, { AxiosInstance } from 'axios';
import { config } from '../utils/config';

interface GiteaUser {
  id: number;
  login: string;
  full_name: string;
  email: string;
}

interface GiteaRepo {
  id: number;
  name: string;
  full_name: string;
  description: string;
  private: boolean;
  clone_url: string;
  ssh_url: string;
  html_url: string;
  default_branch: string;
  size: number;
  created_at: string;
  updated_at: string;
}

interface CreateRepoOptions {
  name: string;
  description?: string;
  private?: boolean;
  auto_init?: boolean;
  default_branch?: string;
}

interface CreateFileOptions {
  content: string; // base64 encoded
  message: string;
  branch?: string;
  author?: {
    name: string;
    email: string;
  };
}

export class GiteaService {
  private client: AxiosInstance;
  private adminClient: AxiosInstance | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: `${config.GITEA_URL}/api/v1`,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (config.GITEA_ADMIN_TOKEN) {
      this.adminClient = axios.create({
        baseURL: `${config.GITEA_URL}/api/v1`,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `token ${config.GITEA_ADMIN_TOKEN}`,
        },
      });
    }
  }

  // Admin operations (requires admin token)
  async createOrganization(name: string, fullName?: string): Promise<any> {
    if (!this.adminClient) {
      throw new Error('Admin token not configured');
    }

    const response = await this.adminClient.post('/orgs', {
      username: name,
      full_name: fullName || name,
      visibility: 'public',
    });

    return response.data;
  }

  async createAgentUser(agentId: string, agentName: string): Promise<GiteaUser> {
    if (!this.adminClient) {
      throw new Error('Admin token not configured');
    }

    const username = `agent-${agentId.slice(0, 8)}`;
    const email = `${username}@ai-devhub.local`;
    const password = this.generateSecurePassword();

    const response = await this.adminClient.post('/admin/users', {
      username,
      email,
      full_name: agentName,
      password,
      must_change_password: false,
      visibility: 'public',
    });

    return response.data;
  }

  async createAgentToken(username: string, tokenName: string): Promise<string> {
    if (!this.adminClient) {
      throw new Error('Admin token not configured');
    }

    const response = await this.adminClient.post(`/users/${username}/tokens`, {
      name: tokenName,
      scopes: ['write:repository', 'read:user'],
    });

    return response.data.sha1;
  }

  // Repository operations
  async createRepository(
    ownerToken: string,
    options: CreateRepoOptions
  ): Promise<GiteaRepo> {
    const response = await this.client.post('/user/repos', {
      name: options.name,
      description: options.description || '',
      private: options.private ?? false,
      auto_init: options.auto_init ?? true,
      default_branch: options.default_branch || 'main',
    }, {
      headers: {
        'Authorization': `token ${ownerToken}`,
      },
    });

    return response.data;
  }

  async getRepository(owner: string, repo: string): Promise<GiteaRepo | null> {
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

  async listUserRepos(
    ownerToken: string,
    page: number = 1,
    limit: number = 20
  ): Promise<GiteaRepo[]> {
    const response = await this.client.get('/user/repos', {
      headers: {
        'Authorization': `token ${ownerToken}`,
      },
      params: { page, limit },
    });

    return response.data;
  }

  async deleteRepository(ownerToken: string, owner: string, repo: string): Promise<void> {
    await this.client.delete(`/repos/${owner}/${repo}`, {
      headers: {
        'Authorization': `token ${ownerToken}`,
      },
    });
  }

  // File operations
  async createFile(
    ownerToken: string,
    owner: string,
    repo: string,
    path: string,
    options: CreateFileOptions
  ): Promise<any> {
    const response = await this.client.post(
      `/repos/${owner}/${repo}/contents/${path}`,
      {
        content: options.content,
        message: options.message,
        branch: options.branch || 'main',
        author: options.author,
      },
      {
        headers: {
          'Authorization': `token ${ownerToken}`,
        },
      }
    );

    return response.data;
  }

  async updateFile(
    ownerToken: string,
    owner: string,
    repo: string,
    path: string,
    sha: string,
    options: CreateFileOptions
  ): Promise<any> {
    const response = await this.client.put(
      `/repos/${owner}/${repo}/contents/${path}`,
      {
        content: options.content,
        message: options.message,
        sha,
        branch: options.branch || 'main',
        author: options.author,
      },
      {
        headers: {
          'Authorization': `token ${ownerToken}`,
        },
      }
    );

    return response.data;
  }

  async getFileContent(
    owner: string,
    repo: string,
    path: string,
    ref?: string
  ): Promise<{ content: string; sha: string } | null> {
    try {
      const response = await this.client.get(
        `/repos/${owner}/${repo}/contents/${path}`,
        { params: ref ? { ref } : {} }
      );

      return {
        content: Buffer.from(response.data.content, 'base64').toString('utf8'),
        sha: response.data.sha,
      };
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  async listFiles(
    owner: string,
    repo: string,
    path: string = '',
    ref?: string
  ): Promise<any[]> {
    const response = await this.client.get(
      `/repos/${owner}/${repo}/contents/${path}`,
      { params: ref ? { ref } : {} }
    );

    return Array.isArray(response.data) ? response.data : [response.data];
  }

  // Branch operations
  async createBranch(
    ownerToken: string,
    owner: string,
    repo: string,
    branchName: string,
    fromBranch: string = 'main'
  ): Promise<any> {
    const response = await this.client.post(
      `/repos/${owner}/${repo}/branches`,
      {
        new_branch_name: branchName,
        old_branch_name: fromBranch,
      },
      {
        headers: {
          'Authorization': `token ${ownerToken}`,
        },
      }
    );

    return response.data;
  }

  async listBranches(owner: string, repo: string): Promise<any[]> {
    const response = await this.client.get(`/repos/${owner}/${repo}/branches`);
    return response.data;
  }

  // Commit operations
  async listCommits(
    owner: string,
    repo: string,
    page: number = 1,
    limit: number = 20
  ): Promise<any[]> {
    const response = await this.client.get(`/repos/${owner}/${repo}/commits`, {
      params: { page, limit },
    });

    return response.data;
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      await this.client.get('/version');
      return true;
    } catch {
      return false;
    }
  }

  private generateSecurePassword(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%';
    let password = '';
    for (let i = 0; i < 32; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }
}

export const giteaService = new GiteaService();
