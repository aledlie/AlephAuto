# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This repository contains two primary systems:

1. **Code Consolidation System** - Automated duplicate code detection using ast-grep, pydantic, and multi-layer similarity algorithms
2. **Document Enhancement Pipeline** - Automated Schema.org structured data injection for README files

Both systems run on sidequest job servers with Sentry error logging.

## Authentication & Configuration

**All commands must be run with Doppler** for environment variable management:

```bash
doppler run -- <command>
```

### Configuration Access

**Never use `process.env` directly** in application code. Always import from the centralized config:

```javascript
import { config } from './sidequest/config.js';

// ✅ Correct
const dsn = config.sentryDsn;

// ❌ Incorrect
const dsn = process.env.SENTRY_DSN;
```

## Key Commands

### Development

```bash
# Start systems
npm start                    # Repomix cron server
npm run dev                  # Development mode with auto-restart
doppler run -- npm start     # With environment variables

# Documentation enhancement
npm run docs:enhance         # Enhance Inventory directory
npm run docs:enhance:dry     # Dry run (no modifications)
npm run docs:test README.md  # Test single README file
```

### Testing

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:scanner         # Directory scanner tests
npm run test:single          # Single job tests
node --test test/directory-scanner.test.js  # Individual test file

# Duplicate detection accuracy tests
node test/accuracy/accuracy-test.js                    # Run accuracy tests
node test/accuracy/accuracy-test.js --verbose          # Detailed output
node test/accuracy/accuracy-test.js --save-results     # Save results to JSON
```

### Code Consolidation System

```bash
# Run duplicate detection scan
doppler run -- node lib/scan-orchestrator.js <repo-path>

# Run with Python virtual environment
doppler run -- venv/bin/python3 lib/extractors/extract_blocks.py < input.json

# Test ast-grep patterns
ast-grep scan -r .ast-grep/rules/ <directory>
ast-grep scan -r .ast-grep/rules/utilities/ src/
```

### Type Checking

```bash
npm run typecheck    # Run TypeScript type checking (no emit)
```

## Architecture

### Code Consolidation System

**Pipeline Architecture (7 stages):**

```
Stage 1-2 (JavaScript):
  Repository Scanner → AST-Grep Detector
       ↓
  JSON via stdin/stdout
       ↓
Stage 3-7 (Python):
  Block Extraction → Semantic Annotation → Duplicate Grouping →
  Suggestion Generation → Report Generation
```

**Key Components:**

- **`lib/scan-orchestrator.js`** - Coordinates entire pipeline, bridges JavaScript/Python
- **`lib/scanners/repository-scanner.js`** - Repository validation, Git info, repomix integration
- **`lib/scanners/ast-grep-detector.js`** - Pattern detection using ast-grep
- **`lib/extractors/extract_blocks.py`** - Python pipeline (stages 3-7)
- **`lib/similarity/`** - Multi-layer similarity algorithm (exact, structural, semantic)
- **`lib/models/`** - Pydantic data models (CodeBlock, DuplicateGroup, etc.)
- **`.ast-grep/rules/`** - 18 pattern detection rules across 6 categories

**Multi-Layer Similarity Algorithm:**

1. **Layer 1 (Exact):** Hash-based exact matching - O(1)
2. **Layer 2 (Structural):** AST normalization + Levenshtein - O(n*k)
3. **Layer 3 (Semantic):** Category + tag overlap - TODO

**Pattern Categories:**

```
.ast-grep/rules/
├── utilities/        (5 rules)  - array, object, string, type-checking, validation
├── api/              (4 rules)  - routes, auth, errors, request-validation
├── database/         (3 rules)  - Prisma, queries, connections
├── config/           (2 rules)  - env variables, config objects
├── async/            (2 rules)  - await patterns, promise chains
└── logging/          (2 rules)  - console, logger patterns
```

### Document Enhancement Pipeline

**Pipeline Flow:**

```
README Scanner → Schema Type Detection → Schema Generation →
Impact Analysis → Content Injection → Report Generation
```

**Key Components:**

- **`doc-enhancement-pipeline.js`** - Main server with cron scheduling
- **`sidequest/doc-enhancement/readme-scanner.js`** - README discovery
- **`sidequest/doc-enhancement/schema-mcp-tools.js`** - Schema.org type detection and generation
- **`sidequest/doc-enhancement/schema-enhancement-worker.js`** - Enhancement job worker

**Schema Types Supported:**

| Content Type | Schema Type | Rich Results |
|-------------|-------------|--------------|
| Test documentation | `HowTo` | How-to guides |
| API documentation | `APIReference` | Technical articles |
| Software projects | `SoftwareApplication` | Software apps |
| Code repositories | `SoftwareSourceCode` | Code repositories |
| Tutorials/guides | `HowTo` | How-to guides |

### Sidequest Job Management

**Core Pattern:**

```javascript
import { SidequestServer } from './sidequest/server.js';

class MyWorker extends SidequestServer {
  constructor(options) {
    super({
      maxConcurrent: 3,
      ...options
    });
  }

  async processJob(jobData) {
    // Job implementation
    return result;
  }
}

// Job lifecycle events
worker.on('job:created', (job) => { /* ... */ });
worker.on('job:started', (job) => { /* ... */ });
worker.on('job:completed', (job) => { /* ... */ });
worker.on('job:failed', (job) => { /* ... */ });
```

## Data Models (Pydantic)

### CodeBlock

```python
class CodeBlock(BaseModel):
    block_id: str
    pattern_id: str  # ast-grep rule ID
    location: SourceLocation
    relative_path: str
    source_code: str
    language: str
    category: SemanticCategory  # utility, api_handler, database_operation, etc.
    semantic_tags: List[str] = []  # e.g., ["function:getUserNames"]
    line_count: int
    content_hash: str  # For exact matching
```

### DuplicateGroup

```python
class DuplicateGroup(BaseModel):
    group_id: str
    pattern_id: str
    member_block_ids: List[str]
    similarity_score: float  # 0.0-1.0
    similarity_method: SimilarityMethod  # exact_match, structural, semantic, hybrid
    category: SemanticCategory
    occurrence_count: int
    total_lines: int
    affected_files: List[str]
    impact_score: float  # 0-100
```

### ConsolidationSuggestion

```python
class ConsolidationSuggestion(BaseModel):
    suggestion_id: str
    duplicate_group_id: str
    strategy: ConsolidationStrategy  # local_util, shared_package, mcp_server, autonomous_agent
    strategy_rationale: str
    target_location: str
    migration_steps: List[MigrationStep]
    code_example: str
    complexity: ComplexityLevel  # trivial, simple, moderate, complex
    migration_risk: RiskLevel    # minimal, low, medium, high
    estimated_effort_hours: float
    confidence: float  # 0.0-1.0
    roi_score: float   # 0-100
```

## Important Patterns

### Function Name Extraction

Code blocks store function names in `semantic_tags`:

```python
# In extract_blocks.py
function_name = extract_function_name(source_code)
semantic_tags = [f"function:{function_name}"] if function_name else []

# In accuracy tests
tags = block.semantic_tags || [];
for (const tag of tags) {
  if (tag.startsWith('function:')) {
    const funcName = tag.substring('function:'.length);
    return funcName;
  }
}
```

### Deduplication

Priority 4 improvement removes duplicate blocks from same location:

```python
# In extract_blocks.py - Stage 3.5
blocks = deduplicate_blocks(blocks)

def deduplicate_blocks(blocks):
    seen_locations = set()
    unique_blocks = []
    for block in blocks:
        location_key = f"{block.location.file_path}:{block.location.line_start}"
        if location_key not in seen_locations:
            seen_locations.add(location_key)
            unique_blocks.append(block)
    return unique_blocks
```

### Structural Similarity

Normalize code to detect structural duplicates:

```python
# In lib/similarity/structural.py
def normalize_code(source_code):
    # Remove comments, whitespace
    # Replace strings → 'STR'
    # Replace numbers → 'NUM'
    # Replace variables → 'var'
    # Normalize operators, punctuation
    return normalized

def calculate_structural_similarity(code1, code2, threshold=0.85):
    # Layer 1: Exact hash match → 1.0
    # Layer 2: Normalized comparison → 0.0-1.0 (Levenshtein)
    return (similarity_score, method)
```

## Directory Structure

```
.
├── lib/                           # Core consolidation system
│   ├── scanners/                  # Repository & pattern scanners (JS)
│   ├── extractors/                # Code block extraction (Python)
│   ├── similarity/                # Multi-layer similarity algorithm (Python)
│   ├── models/                    # Pydantic data models (Python)
│   ├── reports/                   # HTML/Markdown report generators (JS)
│   ├── scan-orchestrator.js       # Pipeline coordinator (JS)
│   └── inter-project-scanner.js   # Cross-repository analysis (JS)
├── .ast-grep/                     # Pattern detection rules
│   ├── rules/                     # 18 YAML rules across 6 categories
│   │   ├── utilities/
│   │   ├── api/
│   │   ├── database/
│   │   ├── config/
│   │   ├── async/
│   │   └── logging/
│   └── sgconfig.yml               # ast-grep configuration
├── sidequest/                     # Job management system
│   ├── server.js                  # Base sidequest server
│   ├── config.js                  # Centralized configuration
│   ├── logger.js                  # Sentry-integrated logging
│   ├── repomix-worker.js          # Repomix job worker
│   ├── directory-scanner.js       # Directory scanning utility
│   └── doc-enhancement/           # Documentation enhancement
├── test/                          # Test suites
│   ├── accuracy/                  # Duplicate detection accuracy tests
│   │   ├── fixtures/              # Test repository with known duplicates
│   │   ├── expected-results.json  # Ground truth (16 groups, 41 functions)
│   │   ├── metrics.js             # Precision, recall, F1, FP rate
│   │   ├── accuracy-test.js       # Automated test harness
│   │   └── README.md              # Testing guide
│   └── *.test.js                  # Unit test suites
├── research/                      # Phase 1 research documentation
│   ├── phase1-ast-grep-research.md
│   ├── phase1-pydantic-research.md
│   ├── phase1-schema-org-research.md
│   ├── phase1-repomix-integration.md
│   ├── phase1-system-architecture.md
│   └── phase1-algorithm-design.md
├── logs/                          # Job execution logs
├── condense/                      # Repomix outputs (mirrors ~/code structure)
├── output/                        # Duplicate detection outputs
│   └── reports/                   # Scan reports (HTML/Markdown/JSON)
└── document-enhancement-impact-measurement/
    ├── enhanced-readmes/          # Enhanced README copies
    ├── impact-reports/            # SEO impact analysis
    └── enhancement-summary-*.json # Enhancement run summaries
```

## Testing

### Test Statistics

```
Total Tests: 67
Passing: 64 (95.5%)
Test Suites: 5
```

### Accuracy Testing

The accuracy test suite validates duplicate detection against known ground truth:

```bash
# Run accuracy tests
node test/accuracy/accuracy-test.js

# With detailed output and results saving
node test/accuracy/accuracy-test.js --verbose --save-results
```

**Test Metrics:**
- Precision: TP / (TP + FP)
- Recall: TP / (TP + FN)
- F1 Score: Harmonic mean of precision and recall
- False Positive Rate: FP / (FP + TN)

**Ground Truth:**
- 16 expected duplicate groups
- 41 duplicate functions
- 8 false positive candidates
- Targets: Precision ≥90%, Recall ≥80%, FP Rate ≤10%

### Adding Test Cases

To add new duplicate detection test cases:

1. Add functions to `test/accuracy/fixtures/src/`
2. Update `test/accuracy/expected-results.json` with new groups
3. Run tests to validate

## MCP Servers

Configured MCP servers for enhanced AI capabilities:

- **Sentry MCP** (HTTP Remote) - Error tracking, OAuth authentication required
- **Redis MCP** (STDIO) - Queue management, connected to localhost:6379
- **TaskQueue MCP** (STDIO) - AI task management with approval gates
- **Filesystem MCP** (STDIO) - Limited to `/Users/alyshialedlie/code/jobs`

```bash
# Manage MCP servers
claude mcp list                    # List all servers
claude mcp tools <server-name>     # View available tools
```

## Python Environment

**Virtual environment required** for Python components:

```bash
# Create virtual environment
python3 -m venv venv

# Activate
source venv/bin/activate  # macOS/Linux

# Install dependencies
pip install -r requirements.txt

# Run Python scripts
doppler run -- venv/bin/python3 lib/extractors/extract_blocks.py
```

**Required Python packages:**
- pydantic>=2.12 (data models)
- Additional dependencies in `requirements.txt`

## Logging & Monitoring

### Sentry Integration

All errors and performance metrics sent to Sentry:

```javascript
import { createComponentLogger } from './sidequest/logger.js';

const logger = createComponentLogger('ComponentName');
logger.info('Message');
logger.error({ error }, 'Error message');
```

### Log Files

```
logs/
├── repomix-{path}-{timestamp}.json        # Completed jobs
├── repomix-{path}-{timestamp}.error.json  # Failed jobs
└── run-summary-{timestamp}.json           # Run statistics
```

## Excluded Directories

The scanner automatically skips:
- `node_modules`, `.git`, `dist`, `build`, `coverage`
- `.next`, `.nuxt`, `vendor`
- `__pycache__`, `.venv`, `venv`, `target`
- `.idea`, `.vscode`
- All hidden directories (starting with `.`)

## Production Deployment

### Using PM2

```bash
npm install -g pm2
pm2 start index.js --name repomix-cron
pm2 start doc-enhancement-pipeline.js --name doc-enhancement
pm2 save
pm2 startup
```

## Important Notes

### Cron Scheduling

Environment variables for scheduling:
- `CRON_SCHEDULE` - Repomix scheduling (default: `0 2 * * *` - 2 AM daily)
- `DOC_CRON_SCHEDULE` - Doc enhancement (default: `0 3 * * *` - 3 AM daily)
- `RUN_ON_STARTUP=true` - Run immediately on startup

### Phase Status

**Phase 1 (Research & Design):** ✅ Complete - 6 documents, 4,120 lines
**Phase 2 (Core Implementation):** ✅ Complete - Working prototype with improvements
**Phase 3 (Automation):** ⏳ Pending - Cron jobs, job queue, MCP server
**Phase 4 (Validation):** ✅ Complete - Accuracy test suite implemented

### Recent Improvements

**Priority 1-4 implementations:**
1. ✅ Function-level extraction (regex patterns, semantic_tags)
2. ✅ Structural similarity (multi-layer algorithm)
3. ⏳ ast-grep pattern refinement (manual effort pending)
4. ✅ Deduplication (60% reduction in false positives)

**Impact:** Deduplication reduced false positives from 49 to 25 (48% improvement)

## Troubleshooting

### repomix not found
```bash
npm install -g repomix
```

### Python pipeline errors
Check Python path and virtual environment:
```bash
which python3
source venv/bin/activate
```

### Accuracy tests failing
Ensure all dependencies installed and Python models importable.

### Redis connection errors
```bash
redis-cli ping  # Should return PONG
brew services start redis  # Start Redis if needed
```
