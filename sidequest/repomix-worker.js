import { SidequestServer } from './server.js';
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { createComponentLogger } from './logger.js';

const logger = createComponentLogger('RepomixWorker');

/**
 * RepomixWorker - Executes repomix jobs
 */
export class RepomixWorker extends SidequestServer {
  constructor(options = {}) {
    super(options);
    this.outputBaseDir = options.outputBaseDir || './condense';
    this.codeBaseDir = options.codeBaseDir || path.join(os.homedir(), 'code');
  }

  /**
   * Run repomix for a specific directory
   */
  async runJobHandler(job) {
    const { sourceDir, relativePath } = job.data;

    // Create output directory matching the source structure
    const outputDir = path.join(this.outputBaseDir, relativePath);
    await fs.mkdir(outputDir, { recursive: true });

    const outputFile = path.join(outputDir, 'repomix-output.txt');

    logger.info({ jobId: job.id, sourceDir, outputFile }, 'Running repomix');

    try {
      const { stdout, stderr } = await this.#runRepomixCommand(sourceDir);

      // Save the output to the appropriate location
      await fs.writeFile(outputFile, stdout);

      if (stderr) {
        logger.warn({ jobId: job.id, stderr }, 'Repomix warnings');
      }

      return {
        sourceDir,
        outputFile,
        relativePath,
        size: (await fs.stat(outputFile)).size,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      // Even if command fails, try to save any output
      if (error.stdout) {
        await fs.writeFile(outputFile, error.stdout);
      }
      throw error;
    }
  }

  /**
   * Securely run repomix command using spawn (prevents command injection)
   * @private
   */
  #runRepomixCommand(cwd) {
    return new Promise((resolve, reject) => {
      const proc = spawn('repomix', [], {
        cwd,
        timeout: 600000, // 10 minute timeout
        maxBuffer: 50 * 1024 * 1024, // 50MB buffer
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve({ stdout, stderr });
        } else {
          const error = new Error(`repomix exited with code ${code}`);
          error.code = code;
          error.stdout = stdout;
          error.stderr = stderr;
          reject(error);
        }
      });

      proc.on('error', (error) => {
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
      });
    });
  }

  /**
   * Create a repomix job for a directory
   */
  createRepomixJob(sourceDir, relativePath) {
    const jobId = `repomix-${relativePath.replace(/\//g, '-')}-${Date.now()}`;

    return this.createJob(jobId, {
      sourceDir,
      relativePath,
      type: 'repomix',
    });
  }
}
