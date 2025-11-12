# Repository File Tree

## Authentication & Configuration

This repository uses **Doppler** for all authentication and environment variable management. All sensitive credentials, API keys, and configuration values are stored securely in Doppler and injected at runtime.

### Using Doppler

All commands that require environment variables should be run with Doppler:

```bash
doppler run -- <command>
```

**Examples:**
```bash
# Run the application
doppler run -- node sidequest/index.js

# Run tests
doppler run -- npm test

# Start the server
doppler run -- node sidequest/server.js
```

### Configuration File

The `config.yml` file documents all environment variables used by the application, including their default values. However, actual values are managed by Doppler and should never be hardcoded.

### Code Configuration

All sidequest/ directory code uses the centralized `sidequest/config.js` module which reads from environment variables injected by Doppler. Never use `process.env` directly in application code - always import from `config.js`:

```javascript
import { config } from './config.js';

// ✅ Correct - use config object
const dsn = config.sentryDsn;

// ❌ Incorrect - don't use process.env directly
const dsn = process.env.SENTRY_DSN;
```

## Structure Overview

This repository contains various projects and utilities organized into the following structure:

```
.
├── .claude/
│   └── settings.local.json
├── condense/
│   ├── ast-grep-mcp/
│   ├── dotfiles/
│   ├── experiments/
│   ├── financial-hub-system/
│   ├── go/
│   ├── IntegrityStudioClients/
│   ├── Inventory/
│   ├── InventoryAI/
│   ├── ISInternal/
│   ├── ISPublicSites/
│   ├── jobs/
│   ├── node/
│   ├── OldSites/
│   ├── PersonalSite/
│   ├── php/
│   ├── project/
│   ├── python/
│   ├── recovery/
│   ├── ToolVisualizer/
│   ├── .repomixignore
│   ├── repomix-output.xml
│   └── repomix.config.json
├── directory-scan-reports/
│   ├── directory-tree-*.txt
│   ├── scan-report-*.json
│   ├── scan-summary-*.json
│   └── repomix-output.xml
├── document-enhancement-impact-measurement/
│   ├── enhanced-readmes/
│   ├── impact-reports/
│   ├── enhancement-summary-*.json
│   └── repomix-output.xml
├── jobs/
│   ├── condense/
│   └── repomix-output.xml
├── logs/
│   ├── event-test.json
│   ├── job-*.json
│   ├── repomix-*.json (numerous log files)
│   └── repomix-*.error.json
├── setup-files/
│   ├── brew-installed-packages.txt
│   ├── claude-code-setup.md
│   ├── doppler-setup-guide.md
│   ├── doppler-test-fix-summary.md
│   ├── fix-history.md
│   ├── node-setup-history.md
│   ├── package.json
│   ├── repomix-implementation-log.md
│   ├── repomix-output.xml
│   ├── requirements.txt
│   ├── run-status.json
│   ├── terminal-journal.md
│   └── webscraper-setup.md
├── sidequest/
│   ├── repomix-output.xml
│   ├── requirements.txt
│   └── testing-instructions.md
├── test/
│   ├── repomix-output.xml
│   ├── schema-integration.test.html
│   ├── schema-validation.test.html
│   └── test-enhancement-pipeline.js
├── .gitignore
├── .repomixignore
├── doc-enhancement-pipeline.js
├── package-lock.json
├── package.json
├── README.md
├── repomix-config-reference.md
├── repomix-output.xml
└── repomix.config.json
```

## Key Directories

### `/condense`
Contains condensed or archived projects including:
- MCP (Model Context Protocol) related projects
- Client projects (IntegrityStudioClients)
- Internal tools (ISInternal)
- Personal websites and portfolios
- Various programming language environments (go, node, php, python)

### `/directory-scan-reports`
Automated scanning reports with:
- Directory tree snapshots
- Scan reports in JSON format
- Scan summaries

### `/document-enhancement-impact-measurement`
Documentation enhancement tracking:
- Enhanced README files
- Impact analysis reports
- Enhancement summaries

### `/logs`
Comprehensive logging directory containing:
- Job execution logs
- Repomix operation logs
- Error logs

### `/setup-files`
Setup and configuration documentation:
- Package lists
- Setup guides for various tools (Claude Code, Doppler, etc.)
- Implementation logs
- Terminal journals

### `/sidequest`
Additional experimental or side projects

### `/test`
Testing files and utilities:
- Schema validation tests
- Enhancement pipeline tests

## Root Files

- **package.json**: Node.js project configuration
- **repomix.config.json**: Repomix tool configuration
- **.repomixignore**: Patterns for files to ignore during repomix operations
- **doc-enhancement-pipeline.js**: Main documentation enhancement script
- **README.md**: Project documentation
