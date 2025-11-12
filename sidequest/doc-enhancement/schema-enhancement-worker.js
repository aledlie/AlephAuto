import { SidequestServer } from '../server.js';
import { SchemaMCPTools } from './schema-mcp-tools.js';
import { READMEScanner } from './readme-scanner.js';
import { createComponentLogger } from '../logger.js';
import fs from 'fs/promises';
import path from 'path';

const logger = createComponentLogger('SchemaEnhancementWorker');

/**
 * SchemaEnhancementWorker - Enhances README files with Schema.org markup
 */
export class SchemaEnhancementWorker extends SidequestServer {
  constructor(options = {}) {
    super(options);
    this.outputBaseDir = options.outputBaseDir || './document-enhancement-impact-measurement';
    this.mcpTools = new SchemaMCPTools(options);
    this.scanner = new READMEScanner(options);
    this.dryRun = options.dryRun || false;
    this.stats = {
      enhanced: 0,
      skipped: 0,
      failed: 0,
    };
  }

  /**
   * Run enhancement for a specific README file
   */
  async runJobHandler(job) {
    const { readmePath, relativePath, context } = job.data;

    logger.info({ jobId: job.id, readmePath }, 'Enhancing README');

    try {
      // Read README content
      const originalContent = await fs.readFile(readmePath, 'utf-8');

      // Check if already has schema
      if (originalContent.includes('<script type="application/ld+json">')) {
        logger.info({ jobId: job.id }, 'Skipped - already has schema markup');
        this.stats.skipped++;
        return {
          status: 'skipped',
          reason: 'Already has schema markup',
          readmePath,
          relativePath,
        };
      }

      // Get appropriate schema type
      const schemaType = await this.mcpTools.getSchemaType(
        readmePath,
        originalContent,
        context
      );

      logger.info({ jobId: job.id, schemaType }, 'Schema type detected');

      // Generate schema markup
      const schema = await this.mcpTools.generateSchema(
        readmePath,
        originalContent,
        context,
        schemaType
      );

      // Validate schema
      const validation = await this.mcpTools.validateSchema(schema);
      if (!validation.valid) {
        throw new Error(`Schema validation failed: ${validation.errors.join(', ')}`);
      }

      if (validation.warnings.length > 0) {
        logger.warn({
          jobId: job.id,
          warnings: validation.warnings
        }, 'Schema validation warnings');
      }

      // Inject schema into content
      const enhancedContent = this.mcpTools.injectSchema(originalContent, schema);

      // Analyze impact
      const impact = await this.mcpTools.analyzeSchemaImpact(
        originalContent,
        enhancedContent,
        schema
      );

      logger.info({
        jobId: job.id,
        impactScore: impact.impactScore,
        rating: impact.rating
      }, 'Impact analysis complete');

      // Save enhanced README
      if (!this.dryRun) {
        await fs.writeFile(readmePath, enhancedContent, 'utf-8');
        logger.info({ jobId: job.id }, 'Enhanced README saved');
      } else {
        logger.info({ jobId: job.id }, 'Dry run - no changes made');
      }

      // Save impact report
      await this.saveImpactReport(relativePath, schema, impact);

      // Save enhanced copy to output directory
      await this.saveEnhancedCopy(relativePath, enhancedContent);

      this.stats.enhanced++;

      return {
        status: 'enhanced',
        readmePath,
        relativePath,
        schemaType,
        schema,
        impact,
        validation,
        timestamp: new Date().toISOString(),
      };

    } catch (error) {
      this.stats.failed++;
      throw error;
    }
  }

  /**
   * Save impact report to output directory
   */
  async saveImpactReport(relativePath, schema, impact) {
    const reportDir = path.join(
      this.outputBaseDir,
      'impact-reports',
      path.dirname(relativePath)
    );

    await fs.mkdir(reportDir, { recursive: true });

    const reportPath = path.join(
      reportDir,
      `${path.basename(relativePath, '.md')}-impact.json`
    );

    const report = {
      relativePath,
      schema,
      impact,
      timestamp: new Date().toISOString(),
    };

    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
  }

  /**
   * Save enhanced copy to output directory
   */
  async saveEnhancedCopy(relativePath, enhancedContent) {
    const outputDir = path.join(
      this.outputBaseDir,
      'enhanced-readmes',
      path.dirname(relativePath)
    );

    await fs.mkdir(outputDir, { recursive: true });

    const outputPath = path.join(outputDir, path.basename(relativePath));

    await fs.writeFile(outputPath, enhancedContent, 'utf-8');
  }

  /**
   * Create an enhancement job for a README
   */
  createEnhancementJob(readme, context) {
    const jobId = `schema-${readme.relativePath.replace(/\//g, '-')}-${Date.now()}`;

    return this.createJob(jobId, {
      readmePath: readme.fullPath,
      relativePath: readme.relativePath,
      context,
      type: 'schema-enhancement',
    });
  }

  /**
   * Get enhancement statistics
   */
  getEnhancementStats() {
    return {
      ...this.stats,
      total: this.stats.enhanced + this.stats.skipped + this.stats.failed,
      successRate: this.stats.enhanced > 0
        ? ((this.stats.enhanced / (this.stats.enhanced + this.stats.failed)) * 100).toFixed(2)
        : 0,
    };
  }

  /**
   * Generate enhancement summary report
   */
  async generateSummaryReport() {
    const stats = this.getEnhancementStats();
    const jobStats = this.getStats();

    const summary = {
      timestamp: new Date().toISOString(),
      enhancement: stats,
      jobs: jobStats,
      outputDirectory: this.outputBaseDir,
    };

    const summaryPath = path.join(
      this.outputBaseDir,
      `enhancement-summary-${Date.now()}.json`
    );

    await fs.mkdir(this.outputBaseDir, { recursive: true });
    await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2));

    return summary;
  }
}
