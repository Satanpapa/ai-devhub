import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { githubService, gitlabService } from '../services/external';
import { activityDb } from '../services/supabase';
import { authenticateAgent, checkQuota } from '../middleware/auth';

const router = Router();

// Validation schemas
const repoPathSchema = z.object({
  owner: z.string().min(1).max(100),
  repo: z.string().min(1).max(100),
});

const filePathSchema = z.object({
  path: z.string().max(500).optional().default(''),
  ref: z.string().max(100).optional(),
});

const searchSchema = z.object({
  query: z.string().min(1).max(256),
  page: z.number().min(1).max(100).optional().default(1),
  per_page: z.number().min(1).max(100).optional().default(30),
});

// Apply auth to all routes
router.use(authenticateAgent);

// Check if agent has external read permission
const checkExternalPermission = (req: Request, res: Response, next: Function) => {
  const agent = req.agent!;
  if (!agent.permissions.can_read_external) {
    res.status(403).json({
      error: 'Forbidden',
      message: 'Agent does not have permission to read external repositories',
    });
    return;
  }
  next();
};

router.use(checkExternalPermission);

// ==================== GitHub Routes ====================

// Get GitHub repository info
router.get('/github/repos/:owner/:repo', async (req: Request, res: Response) => {
  try {
    const agent = req.agent!;
    const { owner, repo } = repoPathSchema.parse(req.params);

    const repository = await githubService.getRepository(owner, repo);

    if (!repository) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Repository not found or not accessible',
      });
      return;
    }

    await activityDb.log({
      agent_id: agent.id,
      action: 'external.github.repo',
      details: { owner, repo },
    });

    res.json({
      provider: 'github',
      id: repository.id,
      name: repository.name,
      full_name: repository.full_name,
      description: repository.description,
      html_url: repository.html_url,
      clone_url: repository.clone_url,
      language: repository.language,
      stargazers_count: repository.stargazers_count,
      forks_count: repository.forks_count,
      default_branch: repository.default_branch,
      created_at: repository.created_at,
      updated_at: repository.updated_at,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation Error', details: error.errors });
      return;
    }
    console.error('GitHub repo error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch GitHub repository',
    });
  }
});

// Get GitHub repository README
router.get('/github/repos/:owner/:repo/readme', async (req: Request, res: Response) => {
  try {
    const agent = req.agent!;
    const { owner, repo } = repoPathSchema.parse(req.params);

    const readme = await githubService.getReadme(owner, repo);

    await activityDb.log({
      agent_id: agent.id,
      action: 'external.github.readme',
      details: { owner, repo },
    });

    res.json({
      content: readme || '',
      found: !!readme,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation Error', details: error.errors });
      return;
    }
    console.error('GitHub readme error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch README',
    });
  }
});

// List GitHub repository contents
router.get('/github/repos/:owner/:repo/contents', async (req: Request, res: Response) => {
  try {
    const agent = req.agent!;
    const { owner, repo } = repoPathSchema.parse(req.params);
    const { path, ref } = filePathSchema.parse(req.query);

    const contents = await githubService.listContents(owner, repo, path, ref);

    await activityDb.log({
      agent_id: agent.id,
      action: 'external.github.contents',
      details: { owner, repo, path },
    });

    res.json({
      path,
      ref: ref || 'default',
      contents: contents.map((item) => ({
        name: item.name,
        path: item.path,
        type: item.type,
        size: item.size,
        sha: item.sha,
      })),
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation Error', details: error.errors });
      return;
    }
    console.error('GitHub contents error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to list contents',
    });
  }
});

// Get GitHub file content
router.get('/github/repos/:owner/:repo/contents/*', async (req: Request, res: Response) => {
  try {
    const agent = req.agent!;
    const { owner, repo } = repoPathSchema.parse(req.params);
    const filePath = req.params[0];
    const { ref } = filePathSchema.parse(req.query);

    const content = await githubService.getFileContent(owner, repo, filePath, ref);

    if (content === null) {
      res.status(404).json({
        error: 'Not Found',
        message: 'File not found',
      });
      return;
    }

    await activityDb.log({
      agent_id: agent.id,
      action: 'external.github.file',
      details: { owner, repo, path: filePath },
    });

    res.json({
      path: filePath,
      ref: ref || 'default',
      content,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation Error', details: error.errors });
      return;
    }
    console.error('GitHub file error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch file content',
    });
  }
});

// List GitHub branches
router.get('/github/repos/:owner/:repo/branches', async (req: Request, res: Response) => {
  try {
    const agent = req.agent!;
    const { owner, repo } = repoPathSchema.parse(req.params);

    const branches = await githubService.listBranches(owner, repo);

    await activityDb.log({
      agent_id: agent.id,
      action: 'external.github.branches',
      details: { owner, repo },
    });

    res.json({ branches });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation Error', details: error.errors });
      return;
    }
    console.error('GitHub branches error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to list branches',
    });
  }
});

// Get GitHub repository languages
router.get('/github/repos/:owner/:repo/languages', async (req: Request, res: Response) => {
  try {
    const agent = req.agent!;
    const { owner, repo } = repoPathSchema.parse(req.params);

    const languages = await githubService.getLanguages(owner, repo);

    await activityDb.log({
      agent_id: agent.id,
      action: 'external.github.languages',
      details: { owner, repo },
    });

    res.json({ languages });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation Error', details: error.errors });
      return;
    }
    console.error('GitHub languages error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get languages',
    });
  }
});

// Search GitHub repositories
router.get('/github/search/repositories', async (req: Request, res: Response) => {
  try {
    const agent = req.agent!;
    const { query, page, per_page } = searchSchema.parse(req.query);

    const results = await githubService.searchRepositories(query, { page, per_page });

    await activityDb.log({
      agent_id: agent.id,
      action: 'external.github.search',
      details: { query, results_count: results.total_count },
    });

    res.json({
      total_count: results.total_count,
      page,
      per_page,
      items: results.items.map((repo) => ({
        id: repo.id,
        name: repo.name,
        full_name: repo.full_name,
        description: repo.description,
        html_url: repo.html_url,
        language: repo.language,
        stargazers_count: repo.stargazers_count,
        forks_count: repo.forks_count,
        updated_at: repo.updated_at,
      })),
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation Error', details: error.errors });
      return;
    }
    console.error('GitHub search error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to search repositories',
    });
  }
});

// Get GitHub rate limit status
router.get('/github/rate_limit', async (req: Request, res: Response) => {
  try {
    const rateLimit = await githubService.getRateLimit();

    res.json({
      limit: rateLimit.limit,
      remaining: rateLimit.remaining,
      reset: rateLimit.reset.toISOString(),
    });
  } catch (error: any) {
    console.error('GitHub rate limit error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get rate limit',
    });
  }
});

// ==================== GitLab Routes ====================

// Get GitLab project info
router.get('/gitlab/projects/:projectId', async (req: Request, res: Response) => {
  try {
    const agent = req.agent!;
    const { projectId } = req.params;

    const project = await gitlabService.getProject(projectId);

    if (!project) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Project not found or not accessible',
      });
      return;
    }

    await activityDb.log({
      agent_id: agent.id,
      action: 'external.gitlab.project',
      details: { projectId },
    });

    res.json({
      provider: 'gitlab',
      id: project.id,
      name: project.name,
      path_with_namespace: project.path_with_namespace,
      description: project.description,
      web_url: project.web_url,
      http_url_to_repo: project.http_url_to_repo,
      default_branch: project.default_branch,
      star_count: project.star_count,
      forks_count: project.forks_count,
      created_at: project.created_at,
      last_activity_at: project.last_activity_at,
    });
  } catch (error: any) {
    console.error('GitLab project error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch GitLab project',
    });
  }
});

// List GitLab project tree
router.get('/gitlab/projects/:projectId/tree', async (req: Request, res: Response) => {
  try {
    const agent = req.agent!;
    const { projectId } = req.params;
    const { path, ref } = filePathSchema.parse(req.query);

    const tree = await gitlabService.listTree(projectId, path, ref || 'main');

    await activityDb.log({
      agent_id: agent.id,
      action: 'external.gitlab.tree',
      details: { projectId, path },
    });

    res.json({
      path,
      ref: ref || 'main',
      contents: tree.map((item) => ({
        name: item.name,
        path: item.path,
        type: item.type,
        id: item.id,
      })),
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation Error', details: error.errors });
      return;
    }
    console.error('GitLab tree error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to list tree',
    });
  }
});

// Get GitLab file content
router.get('/gitlab/projects/:projectId/files/*', async (req: Request, res: Response) => {
  try {
    const agent = req.agent!;
    const { projectId } = req.params;
    const filePath = req.params[0];
    const { ref } = filePathSchema.parse(req.query);

    const content = await gitlabService.getFileContent(projectId, filePath, ref || 'main');

    if (content === null) {
      res.status(404).json({
        error: 'Not Found',
        message: 'File not found',
      });
      return;
    }

    await activityDb.log({
      agent_id: agent.id,
      action: 'external.gitlab.file',
      details: { projectId, path: filePath },
    });

    res.json({
      path: filePath,
      ref: ref || 'main',
      content,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation Error', details: error.errors });
      return;
    }
    console.error('GitLab file error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch file content',
    });
  }
});

// Search GitLab projects
router.get('/gitlab/search/projects', async (req: Request, res: Response) => {
  try {
    const agent = req.agent!;
    const { query, page, per_page } = searchSchema.parse(req.query);

    const results = await gitlabService.searchProjects(query, { page, per_page });

    await activityDb.log({
      agent_id: agent.id,
      action: 'external.gitlab.search',
      details: { query, results_count: results.length },
    });

    res.json({
      page,
      per_page,
      items: results.map((project) => ({
        id: project.id,
        name: project.name,
        path_with_namespace: project.path_with_namespace,
        description: project.description,
        web_url: project.web_url,
        star_count: project.star_count,
        forks_count: project.forks_count,
        last_activity_at: project.last_activity_at,
      })),
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation Error', details: error.errors });
      return;
    }
    console.error('GitLab search error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to search projects',
    });
  }
});

export default router;
