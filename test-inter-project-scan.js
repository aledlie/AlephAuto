#!/usr/bin/env node

/**
 * Test script for inter-project duplicate detection
 *
 * Usage: node test-inter-project-scan.js [repo1] [repo2] [...]
 */

import { InterProjectScanner } from './lib/inter-project-scanner.js';
import { createComponentLogger } from './sidequest/logger.js';
import path from 'path';

const logger = createComponentLogger('TestInterProject');

async function main() {
  const args = process.argv.slice(2);

  // Default: scan sidequest and test directories
  const repoPaths = args.length > 0
    ? args
    : [
        path.join(process.cwd(), 'sidequest'),
        path.join(process.cwd(), 'test')
      ];

  logger.info({ repositories: repoPaths }, 'Starting inter-project test scan');

  try {
    // Create scanner
    const scanner = new InterProjectScanner({
      orchestrator: {
        scanner: {
          outputBaseDir: path.join(process.cwd(), 'output', 'scan-tests')
        },
        detector: {
          rulesDirectory: path.join(process.cwd(), '.ast-grep', 'rules'),
          configPath: path.join(process.cwd(), '.ast-grep', 'sgconfig.yml')
        },
        pythonPath: path.join(process.cwd(), 'venv', 'bin', 'python3'),
        extractorScript: path.join(process.cwd(), 'lib', 'extractors', 'extract_blocks.py')
      },
      outputDir: path.join(process.cwd(), 'output', 'inter-project-scans')
    });

    // Run inter-project scan
    logger.info('Running inter-project duplicate detection scan...');
    const result = await scanner.scanRepositories(repoPaths, {
      pattern_config: {
        languages: ['javascript', 'typescript']
      }
    });

    // Display results
    console.log('\n' + '='.repeat(80));
    console.log('INTER-PROJECT SCAN RESULTS');
    console.log('='.repeat(80));

    console.log('\nScanned Repositories:');
    for (const repo of result.scanned_repositories) {
      const status = repo.error ? `ERROR: ${repo.error}` : `✓ ${repo.code_blocks} blocks`;
      console.log(`  ${repo.name}: ${status}`);
    }

    console.log('\nMetrics:');
    console.log(`  Total Repositories: ${result.metrics.total_repositories_scanned}`);
    console.log(`  Total Code Blocks: ${result.metrics.total_code_blocks}`);
    console.log(`  Intra-Project Groups: ${result.metrics.total_intra_project_groups}`);
    console.log(`  Cross-Repository Groups: ${result.metrics.total_cross_repository_groups}`);
    console.log(`  Cross-Repo Occurrences: ${result.metrics.cross_repository_occurrences}`);
    console.log(`  Cross-Repo Duplicated Lines: ${result.metrics.cross_repository_duplicated_lines}`);
    console.log(`  Suggestions: ${result.metrics.total_suggestions}`);
    console.log(`  Shared Package Candidates: ${result.metrics.shared_package_candidates}`);
    console.log(`  MCP Server Candidates: ${result.metrics.mcp_server_candidates}`);
    console.log(`  Avg Repos per Duplicate: ${result.metrics.average_repositories_per_duplicate}`);

    if (result.cross_repository_duplicates && result.cross_repository_duplicates.length > 0) {
      console.log('\nTop Cross-Repository Duplicates:');
      const topGroups = result.cross_repository_duplicates
        .sort((a, b) => b.impact_score - a.impact_score)
        .slice(0, 5);

      for (const group of topGroups) {
        console.log(`\n  Group ${group.group_id}:`);
        console.log(`    Pattern: ${group.pattern_id}`);
        console.log(`    Occurrences: ${group.occurrence_count}`);
        console.log(`    Repositories: ${group.repository_count} (${group.affected_repositories.join(', ')})`);
        console.log(`    Impact Score: ${group.impact_score.toFixed(2)}/100`);
        console.log(`    Files: ${group.affected_files.slice(0, 3).join(', ')}${group.affected_files.length > 3 ? '...' : ''}`);
      }
    }

    if (result.cross_repository_suggestions && result.cross_repository_suggestions.length > 0) {
      console.log('\nTop Cross-Repository Suggestions:');
      const topSuggestions = result.cross_repository_suggestions
        .sort((a, b) => b.roi_score - a.roi_score)
        .slice(0, 5);

      for (const suggestion of topSuggestions) {
        console.log(`\n  ${suggestion.suggestion_id}:`);
        console.log(`    Strategy: ${suggestion.strategy}`);
        console.log(`    Rationale: ${suggestion.strategy_rationale}`);
        console.log(`    Target: ${suggestion.target_location}`);
        console.log(`    Impact: ${suggestion.impact_score.toFixed(2)}/100`);
        console.log(`    ROI: ${suggestion.roi_score.toFixed(2)}/100`);
        console.log(`    Complexity: ${suggestion.complexity}`);
        console.log(`    Risk: ${suggestion.migration_risk}`);
        console.log(`    Affected Repos: ${suggestion.affected_repositories.join(', ')}`);
      }
    }

    // Save results
    const outputPath = await scanner.saveResults(result);
    console.log(`\n\nFull results saved to: ${outputPath}`);
    console.log('='.repeat(80) + '\n');

    logger.info('Inter-project test scan completed successfully');

  } catch (error) {
    logger.error({ error }, 'Inter-project test scan failed');
    console.error('\nError:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
    process.exit(1);
  }
}

main();
