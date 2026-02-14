import Docker from 'dockerode';
import { v4 as uuid } from 'uuid';
import { Execution, SUPPORTED_LANGUAGES, SandboxConfig } from '../types';
import { config, LIMITS } from '../utils/config';
import { executionDb } from './supabase';

const docker = new Docker();

interface ExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
  memoryUsedMb: number;
  timedOut: boolean;
}

export class SandboxService {
  private static instance: SandboxService;

  static getInstance(): SandboxService {
    if (!SandboxService.instance) {
      SandboxService.instance = new SandboxService();
    }
    return SandboxService.instance;
  }

  async executeCode(
    executionId: string,
    language: string,
    code: string,
    timeoutMs: number = config.SANDBOX_TIMEOUT_MS
  ): Promise<ExecutionResult> {
    const langConfig = SUPPORTED_LANGUAGES[language];
    if (!langConfig) {
      throw new Error(`Unsupported language: ${language}`);
    }

    // Enforce limits
    const actualTimeout = Math.min(timeoutMs, LIMITS.MAX_TIMEOUT_MS);
    const memoryLimit = LIMITS.MAX_MEMORY_MB * 1024 * 1024; // Convert to bytes

    // Update execution status to running
    await executionDb.update(executionId, {
      status: 'running',
      started_at: new Date().toISOString(),
    });

    const containerId = `sandbox-${executionId}-${uuid().slice(0, 8)}`;
    const startTime = Date.now();
    let result: ExecutionResult;

    try {
      result = await this.runInContainer(
        containerId,
        langConfig,
        code,
        actualTimeout,
        memoryLimit
      );

      // Update execution with results
      await executionDb.update(executionId, {
        status: result.timedOut ? 'timeout' : 'completed',
        stdout: result.stdout.slice(0, 50000), // Limit output size
        stderr: result.stderr.slice(0, 50000),
        exit_code: result.exitCode,
        duration_ms: result.durationMs,
        memory_used_mb: result.memoryUsedMb,
        completed_at: new Date().toISOString(),
      });

      return result;
    } catch (error: any) {
      result = {
        stdout: '',
        stderr: error.message || 'Execution failed',
        exitCode: -1,
        durationMs: Date.now() - startTime,
        memoryUsedMb: 0,
        timedOut: false,
      };

      await executionDb.update(executionId, {
        status: 'failed',
        stderr: result.stderr,
        exit_code: -1,
        duration_ms: result.durationMs,
        completed_at: new Date().toISOString(),
      });

      return result;
    }
  }

  private async runInContainer(
    containerId: string,
    langConfig: SandboxConfig,
    code: string,
    timeoutMs: number,
    memoryLimit: number
  ): Promise<ExecutionResult> {
    const startTime = Date.now();
    let container: Docker.Container | null = null;
    let timedOut = false;

    try {
      // Create container with strict resource limits
      container = await docker.createContainer({
        Image: langConfig.image,
        name: containerId,
        Cmd: this.getCommand(langConfig.language, code),
        HostConfig: {
          Memory: memoryLimit,
          MemorySwap: memoryLimit, // Disable swap
          CpuPeriod: 100000,
          CpuQuota: langConfig.cpu_limit * 100000,
          NetworkMode: langConfig.network_disabled ? 'none' : 'bridge',
          AutoRemove: true,
          ReadonlyRootfs: true,
          SecurityOpt: ['no-new-privileges'],
          CapDrop: ['ALL'],
          Tmpfs: {
            '/tmp': 'rw,noexec,nosuid,size=64m',
            '/app': 'rw,noexec,nosuid,size=64m',
          },
        },
        WorkingDir: '/app',
        User: '65534:65534', // nobody user
        Tty: false,
        AttachStdout: true,
        AttachStderr: true,
      });

      // Start container
      await container.start();

      // Wait for completion with timeout
      const waitPromise = container.wait();
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          timedOut = true;
          reject(new Error('Execution timed out'));
        }, timeoutMs);
      });

      try {
        await Promise.race([waitPromise, timeoutPromise]);
      } catch {
        if (timedOut && container) {
          try {
            await container.kill();
          } catch {
            // Container might already be stopped
          }
        }
      }

      // Get logs
      const logs = await container.logs({
        stdout: true,
        stderr: true,
        timestamps: false,
      });

      const { stdout, stderr } = this.parseLogs(logs);
      
      // Get container stats for memory usage
      let memoryUsedMb = 0;
      try {
        const stats = await container.stats({ stream: false });
        memoryUsedMb = Math.round((stats.memory_stats?.usage || 0) / (1024 * 1024));
      } catch {
        // Stats might not be available
      }

      // Get exit code
      const inspection = await container.inspect();
      const exitCode = inspection.State?.ExitCode ?? -1;

      return {
        stdout,
        stderr,
        exitCode: timedOut ? 124 : exitCode, // 124 is standard timeout exit code
        durationMs: Date.now() - startTime,
        memoryUsedMb,
        timedOut,
      };
    } finally {
      // Cleanup container
      if (container) {
        try {
          await container.remove({ force: true });
        } catch {
          // Container might be auto-removed
        }
      }
    }
  }

  private getCommand(language: string, code: string): string[] {
    // Escape code for shell execution
    const escapedCode = code.replace(/'/g, "'\\''");
    
    switch (language) {
      case 'python':
        return ['python3', '-c', code];
      case 'javascript':
        return ['node', '-e', code];
      case 'typescript':
        // Use ts-node or esbuild-register in practice
        return ['node', '-e', code];
      case 'go':
        return ['sh', '-c', `echo '${escapedCode}' > /tmp/main.go && go run /tmp/main.go`];
      case 'rust':
        return ['sh', '-c', `echo '${escapedCode}' > /tmp/main.rs && rustc /tmp/main.rs -o /tmp/main && /tmp/main`];
      default:
        throw new Error(`Unsupported language: ${language}`);
    }
  }

  private parseLogs(logs: Buffer): { stdout: string; stderr: string } {
    // Docker multiplexed streams format
    // Each frame: [STREAM_TYPE, 0, 0, 0, SIZE1, SIZE2, SIZE3, SIZE4, DATA...]
    let stdout = '';
    let stderr = '';
    let offset = 0;

    while (offset < logs.length) {
      if (offset + 8 > logs.length) break;

      const streamType = logs[offset];
      const size = logs.readUInt32BE(offset + 4);
      
      if (offset + 8 + size > logs.length) break;

      const data = logs.slice(offset + 8, offset + 8 + size).toString('utf8');
      
      if (streamType === 1) {
        stdout += data;
      } else if (streamType === 2) {
        stderr += data;
      }

      offset += 8 + size;
    }

    // Fallback: if parsing failed, treat as plain text
    if (!stdout && !stderr && logs.length > 0) {
      stdout = logs.toString('utf8');
    }

    return { stdout, stderr };
  }

  async pullImage(image: string): Promise<void> {
    return new Promise((resolve, reject) => {
      docker.pull(image, (err: any, stream: any) => {
        if (err) {
          reject(err);
          return;
        }

        docker.modem.followProgress(stream, (err: any) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
    });
  }

  async ensureImagesExist(): Promise<void> {
    console.log('🐳 Checking Docker images...');
    
    for (const [lang, langConfig] of Object.entries(SUPPORTED_LANGUAGES)) {
      try {
        await docker.getImage(langConfig.image).inspect();
        console.log(`  ✓ ${lang}: ${langConfig.image}`);
      } catch {
        console.log(`  ⬇ Pulling ${lang}: ${langConfig.image}...`);
        try {
          await this.pullImage(langConfig.image);
          console.log(`  ✓ ${lang}: ${langConfig.image} pulled`);
        } catch (err) {
          console.warn(`  ⚠ Failed to pull ${langConfig.image}:`, err);
        }
      }
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      await docker.ping();
      return true;
    } catch {
      return false;
    }
  }
}

export const sandboxService = SandboxService.getInstance();
