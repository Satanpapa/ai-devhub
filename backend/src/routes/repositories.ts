import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { repoDb, agentDb, activityDb } from '../services/supabase';
import { giteaService } from '../services/gitea';
import { authenticateAgent, checkQuota } from '../middleware/auth';

const router = Router();

// Validation schemas
const createRepoSchema = z.object({
  name: z.string()
    .min(1)
    .max(100)
    .regex(/^[a-zA-Z0-9_-]+$/, 'Name can only contain letters, numbers, underscores and hyphens'),
  description: z.string().max(500).optional(),
  is_public: z.boolean().optional().default(false),
  init_readme: z.boolean().optional().default(true),
});

const createFileSchema = z.object({
  path: z.string().min(1).max(500),
  content: z.string().max(1024 * 100), // 100KB max
  message: z.string().min(1).max(200),
  branch: z.string().optional().default('main'),
});

const updateFileSchema = z.object({
  content: z.string().max(1024 * 100),
  message: z.string().min(1).max(200),
  branch: z.string().optional().default('main'),
});

// Apply auth to all routes
router.use(authenticateAgent);

// List agent's repositories
router.get('/', async (req: Request, res: Response) => {
  try {
    const agent = req.agent!;
    const repos = await repoDb.findByAgentId(agent.id);

    res.json({
      repositories: repos.map(repo => ({
        id: repo.id,
        name: repo.name,
        description: repo.description,
        is_public: repo.is_public,
        clone_url: repo.clone_url,
        default_branch: repo.default_branch,
        size_mb: repo.size_mb,
        commits_count: repo.commits_count,
        created_at: repo.created_at,
        updated_at: repo.updated_at,
      })),
      count: repos.length,
    });
  } catch (error: any) {
    console.error('List repos error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to list repositories',
    });
  }
});

// Create new repository
router.post('/', checkQuota, async (req: Request, res: Response) => {
  try {
    const agent = req.agent!;
    const body = createRepoSchema.parse(req.body);

    // Check if repo with same name exists
    const existingRepos = await repoDb.findByAgentId(agent.id);
    if (existingRepos.some(r => r.name === body.name)) {
      res.status(409).json({
        error: 'Conflict',
        message: 'Repository with this name already exists',
      });
      return;
    }

    // Create in Gitea if available
    let giteaRepo = null;
    const giteaToken = agent.gitea_token;
    
    if (giteaToken) {
      try {
        giteaRepo = await giteaService.createRepository(giteaToken, {
          name: body.name,
          description: body.description,
          private: !body.is_public,
          auto_init: body.init_readme,
          default_branch: 'main',
        });
      } catch (error) {
        console.warn('Failed to create Gitea repo:', error);
      }
    }

    // Create in database
    const repo = await repoDb.create({
      agent_id: agent.id,
      name: body.name,
      description: body.description,
      is_public: body.is_public,
      gitea_repo_id: giteaRepo?.id,
      clone_url: giteaRepo?.clone_url,
    });

    // Update quota
    await agentDb.incrementQuota(agent.id, 'repos_used');

    // Log activity
    await activityDb.log({
      agent_id: agent.id,
      action: 'repository.created',
      details: { name: body.name, id: repo.id },
    });

    res.status(201).json({
      id: repo.id,
      name: repo.name,
      description: repo.description,
      is_public: repo.is_public,
      clone_url: repo.clone_url,
      default_branch: repo.default_branch,
      created_at: repo.created_at,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Validation Error',
        details: error.errors,
      });
      return;
    }
    console.error('Create repo error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create repository',
    });
  }
});

// Get repository details
router.get('/:repoId', async (req: Request, res: Response) => {
  try {
    const agent = req.agent!;
    const { repoId } = req.params;

    const repo = await repoDb.findById(repoId);
    
    if (!repo || repo.agent_id !== agent.id) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Repository not found',
      });
      return;
    }

    // Get additional info from Gitea if available
    let branches: string[] = [];
    let recentCommits: any[] = [];
    
    if (repo.clone_url && agent.gitea_username) {
      try {
        branches = (await giteaService.listBranches(agent.gitea_username, repo.name)).map((b: any) => b.name);
        recentCommits = await giteaService.listCommits(agent.gitea_username, repo.name, 1, 10);
      } catch {
        // Gitea info not available
      }
    }

    res.json({
      id: repo.id,
      name: repo.name,
      description: repo.description,
      is_public: repo.is_public,
      clone_url: repo.clone_url,
      default_branch: repo.default_branch,
      size_mb: repo.size_mb,
      commits_count: repo.commits_count,
      branches,
      recent_commits: recentCommits.slice(0, 10),
      created_at: repo.created_at,
      updated_at: repo.updated_at,
    });
  } catch (error: any) {
    console.error('Get repo error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get repository',
    });
  }
});

// Delete repository
router.delete('/:repoId', async (req: Request, res: Response) => {
  try {
    const agent = req.agent!;
    const { repoId } = req.params;

    const repo = await repoDb.findById(repoId);
    
    if (!repo || repo.agent_id !== agent.id) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Repository not found',
      });
      return;
    }

    // Delete from Gitea if available
    const giteaToken = agent.gitea_token;
    if (giteaToken && agent.gitea_username) {
      try {
        await giteaService.deleteRepository(giteaToken, agent.gitea_username, repo.name);
      } catch (error) {
        console.warn('Failed to delete Gitea repo:', error);
      }
    }

    // Delete from database
    await repoDb.delete(repoId);

    // Update quota
    const currentAgent = await agentDb.findById(agent.id);
    if (currentAgent) {
      const quota = currentAgent.quota;
      quota.repos_used = Math.max(0, quota.repos_used - 1);
      await agentDb.update(agent.id, { quota });
    }

    // Log activity
    await activityDb.log({
      agent_id: agent.id,
      action: 'repository.deleted',
      details: { name: repo.name, id: repoId },
    });

    res.status(204).send();
  } catch (error: any) {
    console.error('Delete repo error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to delete repository',
    });
  }
});

// List files in repository
router.get('/:repoId/files', async (req: Request, res: Response) => {
  try {
    const agent = req.agent!;
    const { repoId } = req.params;
    const path = (req.query.path as string) || '';
    const ref = (req.query.ref as string) || 'main';

    const repo = await repoDb.findById(repoId);
    
    if (!repo || repo.agent_id !== agent.id) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Repository not found',
      });
      return;
    }

    if (!agent.gitea_username) {
      res.status(501).json({
        error: 'Not Implemented',
        message: 'File listing requires Gitea integration',
      });
      return;
    }

    const files = await giteaService.listFiles(agent.gitea_username, repo.name, path, ref);

    res.json({
      path,
      ref,
      files: files.map((f: any) => ({
        name: f.name,
        path: f.path,
        type: f.type,
        size: f.size,
        sha: f.sha,
      })),
    });
  } catch (error: any) {
    console.error('List files error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to list files',
    });
  }
});

// Get file content
router.get('/:repoId/files/*', async (req: Request, res: Response) => {
  try {
    const agent = req.agent!;
    const { repoId } = req.params;
    const filePath = req.params[0];
    const ref = (req.query.ref as string) || 'main';

    const repo = await repoDb.findById(repoId);
    
    if (!repo || repo.agent_id !== agent.id) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Repository not found',
      });
      return;
    }

    if (!agent.gitea_username) {
      res.status(501).json({
        error: 'Not Implemented',
        message: 'File access requires Gitea integration',
      });
      return;
    }

    const file = await giteaService.getFileContent(agent.gitea_username, repo.name, filePath, ref);
    
    if (!file) {
      res.status(404).json({
        error: 'Not Found',
        message: 'File not found',
      });
      return;
    }

    res.json({
      path: filePath,
      ref,
      content: file.content,
      sha: file.sha,
    });
  } catch (error: any) {
    console.error('Get file error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get file',
    });
  }
});

// Create file in repository
router.post('/:repoId/files', async (req: Request, res: Response) => {
  try {
    const agent = req.agent!;
    const { repoId } = req.params;
    const body = createFileSchema.parse(req.body);

    const repo = await repoDb.findById(repoId);
    
    if (!repo || repo.agent_id !== agent.id) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Repository not found',
      });
      return;
    }

    const giteaToken = agent.gitea_token;
    if (!giteaToken || !agent.gitea_username) {
      res.status(501).json({
        error: 'Not Implemented',
        message: 'File creation requires Gitea integration',
      });
      return;
    }

    const contentBase64 = Buffer.from(body.content).toString('base64');
    
    const result = await giteaService.createFile(
      giteaToken,
      agent.gitea_username,
      repo.name,
      body.path,
      {
        content: contentBase64,
        message: body.message,
        branch: body.branch,
        author: {
          name: agent.name,
          email: `${agent.gitea_username}@ai-devhub.local`,
        },
      }
    );

    // Update repo stats
    await repoDb.update(repoId, {
      commits_count: (repo.commits_count || 0) + 1,
    });

    // Log activity
    await activityDb.log({
      agent_id: agent.id,
      action: 'file.created',
      details: { repo: repo.name, path: body.path },
    });

    res.status(201).json({
      path: body.path,
      sha: result.content?.sha,
      commit: result.commit?.sha,
      message: 'File created successfully',
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Validation Error',
        details: error.errors,
      });
      return;
    }
    console.error('Create file error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create file',
    });
  }
});

// Update file in repository
router.put('/:repoId/files/*', async (req: Request, res: Response) => {
  try {
    const agent = req.agent!;
    const { repoId } = req.params;
    const filePath = req.params[0];
    const body = updateFileSchema.parse(req.body);

    const repo = await repoDb.findById(repoId);
    
    if (!repo || repo.agent_id !== agent.id) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Repository not found',
      });
      return;
    }

    const giteaToken = agent.gitea_token;
    if (!giteaToken || !agent.gitea_username) {
      res.status(501).json({
        error: 'Not Implemented',
        message: 'File update requires Gitea integration',
      });
      return;
    }

    // Get current file SHA
    const currentFile = await giteaService.getFileContent(
      agent.gitea_username,
      repo.name,
      filePath,
      body.branch
    );

    if (!currentFile) {
      res.status(404).json({
        error: 'Not Found',
        message: 'File not found',
      });
      return;
    }

    const contentBase64 = Buffer.from(body.content).toString('base64');
    
    const result = await giteaService.updateFile(
      giteaToken,
      agent.gitea_username,
      repo.name,
      filePath,
      currentFile.sha,
      {
        content: contentBase64,
        message: body.message,
        branch: body.branch,
        author: {
          name: agent.name,
          email: `${agent.gitea_username}@ai-devhub.local`,
        },
      }
    );

    // Update repo stats
    await repoDb.update(repoId, {
      commits_count: (repo.commits_count || 0) + 1,
    });

    // Log activity
    await activityDb.log({
      agent_id: agent.id,
      action: 'file.updated',
      details: { repo: repo.name, path: filePath },
    });

    res.json({
      path: filePath,
      sha: result.content?.sha,
      commit: result.commit?.sha,
      message: 'File updated successfully',
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Validation Error',
        details: error.errors,
      });
      return;
    }
    console.error('Update file error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update file',
    });
  }
});

export default router;
