import { SidequestServer } from './server.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const execAsync = promisify(exec);

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

    // Run repomix command
    const command = `cd "${sourceDir}" && repomix`;

    console.log(`[${job.id}] Running repomix for: ${sourceDir}`);
    console.log(`[${job.id}] Output will be saved to: ${outputFile}`);

    try {
      const { stdout, stderr } = await execAsync(command, {
        maxBuffer: 50 * 1024 * 1024, // 50MB buffer
        timeout: 600000, // 10 minute timeout
      });

      // Save the output to the appropriate location
      await fs.writeFile(outputFile, stdout);

      if (stderr) {
        console.warn(`[${job.id}] Warnings:`, stderr);
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
