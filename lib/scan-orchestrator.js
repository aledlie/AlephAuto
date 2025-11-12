import { RepositoryScanner } from './scanners/repository-scanner.js';
import { AstGrepPatternDetector } from './scanners/ast-grep-detector.js';
import { createComponentLogger } from '../sidequest/logger.js';
import { spawn } from 'child_process';
import path from 'path';

const logger = createComponentLogger('ScanOrchestrator');

/**
 * Scan Orchestrator
 *
 * Coordinates the entire duplicate detection pipeline:
 * 1. Repository scanning (repomix)
 * 2. Pattern detection (ast-grep)
 * 3. Code block extraction (Python/pydantic)
 * 4. Semantic annotation (Python)
 * 5. Duplicate grouping (Python)
 * 6. Suggestion generation (Python)
 * 7. Report generation (Python)
 */
export class ScanOrchestrator {
  constructor(options = {}) {
    // JavaScript components
    this.repositoryScanner = new RepositoryScanner(options.scanner || {});
    this.patternDetector = new AstGrepPatternDetector(options.detector || {});

    // Python components (called via subprocess)
    this.pythonPath = options.pythonPath || 'python3';
    this.extractorScript = options.extractorScript || path.join(process.cwd(), 'lib/extractors/extract_blocks.py');

    // Configuration
    this.config = options.config || {};
  }

  /**
   * Scan a single repository for duplicates
   *
   * @param {string} repoPath - Absolute path to repository
   * @param {object} config - Scan configuration
   * @returns {Promise<ScanReport>}
   */
  async scanRepository(repoPath, scanConfig = {}) {
    const startTime = Date.now();

    logger.info({ repoPath }, 'Starting repository duplicate scan');

    try {
      // Stage 1: Repository scanning
      logger.info('Stage 1/7: Scanning repository with repomix');
      const repoScan = await this.repositoryScanner.scanRepository(
        repoPath,
        scanConfig.scan_config || {}
      );

      // Stage 2: Pattern detection
      logger.info('Stage 2/7: Detecting patterns with ast-grep');
      const patterns = await this.patternDetector.detectPatterns(
        repoPath,
        scanConfig.pattern_config || {}
      );

      // Stage 3-7: Python pipeline
      logger.info('Stage 3-7: Running Python extraction and analysis pipeline');
      const pythonResult = await this.runPythonPipeline({
        repository_info: repoScan.repository_info,
        pattern_matches: patterns.matches,
        scan_config: scanConfig
      });

      const duration = (Date.now() - startTime) / 1000;

      logger.info({
        repoPath,
        duration,
        blocks: pythonResult.metrics?.total_code_blocks || 0,
        groups: pythonResult.metrics?.total_duplicate_groups || 0,
        suggestions: pythonResult.metrics?.total_suggestions || 0
      }, 'Repository scan completed successfully');

      return {
        ...pythonResult,
        scan_metadata: {
          duration_seconds: duration,
          scanned_at: new Date().toISOString(),
          repository_path: repoPath
        }
      };

    } catch (error) {
      logger.error({ repoPath, error }, 'Repository scan failed');
      throw new ScanError(`Scan failed for ${repoPath}: ${error.message}`, {
        cause: error
      });
    }
  }

  /**
   * Run Python pipeline for extraction, grouping, and reporting
   */
  async runPythonPipeline(data) {
    return new Promise((resolve, reject) => {
      logger.debug('Launching Python extraction pipeline');

      const proc = spawn(this.pythonPath, [this.extractorScript], {
        timeout: 600000, // 10 minute timeout
      });

      let stdout = '';
      let stderr = '';

      // Send input data via stdin
      const jsonData = JSON.stringify(data);
      logger.debug({
        patternMatchCount: data.pattern_matches?.length,
        repoPath: data.repository_info?.path
      }, 'Sending data to Python pipeline');
      proc.stdin.write(jsonData);
      proc.stdin.end();

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data) => {
        const stderrText = data.toString();
        stderr += stderrText;
        // Log warnings at warn level so they're visible
        if (stderrText.includes('Warning:')) {
          logger.warn({ stderr: stderrText }, 'Python pipeline warning');
        } else {
          logger.debug({ stderr: stderrText }, 'Python pipeline stderr');
        }
      });

      proc.on('close', (code) => {
        if (code === 0) {
          try {
            const result = JSON.parse(stdout);
            resolve(result);
          } catch (error) {
            logger.error({ stdout, stderr }, 'Failed to parse Python pipeline output');
            reject(new Error(`Failed to parse Python output: ${error.message}`));
          }
        } else {
          logger.error({ code, stderr }, 'Python pipeline failed');
          reject(new Error(`Python pipeline exited with code ${code}: ${stderr}`));
        }
      });

      proc.on('error', (error) => {
        if (error.code === 'ENOENT') {
          reject(new Error(`Python not found at: ${this.pythonPath}`));
        } else {
          reject(error);
        }
      });
    });
  }

  /**
   * Scan multiple repositories (inter-project analysis)
   *
   * @param {string[]} repoPaths - Array of repository paths
   * @param {object} config - Scan configuration
   * @returns {Promise<MultiRepoScanReport>}
   */
  async scanMultipleRepositories(repoPaths, scanConfig = {}) {
    logger.info({ count: repoPaths.length }, 'Starting multi-repository scan');

    const results = [];

    for (const repoPath of repoPaths) {
      try {
        const result = await this.scanRepository(repoPath, scanConfig);
        results.push(result);
      } catch (error) {
        logger.warn({ repoPath, error }, 'Repository scan failed, continuing');
        results.push({
          error: error.message,
          repository_path: repoPath
        });
      }
    }

    // TODO: Cross-repository duplicate analysis
    // For now, return individual results

    return {
      repositories: results,
      total_scanned: repoPaths.length,
      successful: results.filter(r => !r.error).length,
      failed: results.filter(r => r.error).length
    };
  }
}

/**
 * Custom error class for scan orchestration errors
 */
export class ScanError extends Error {
  constructor(message, options) {
    super(message, options);
    this.name = 'ScanError';
  }
}
