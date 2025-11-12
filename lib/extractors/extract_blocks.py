#!/usr/bin/env python3
"""
Code Block Extraction Pipeline

Reads JSON from stdin containing:
- repository_info
- pattern_matches

Outputs JSON to stdout containing:
- code_blocks
- duplicate_groups
- suggestions
- metrics
"""

import sys
import json
import hashlib
from pathlib import Path
from typing import List, Dict, Any

# Add lib/models to Python path
sys.path.insert(0, str(Path(__file__).parent.parent / 'models'))

from code_block import CodeBlock, SourceLocation, ASTNode
from duplicate_group import DuplicateGroup
from consolidation_suggestion import ConsolidationSuggestion
from scan_report import ScanReport, RepositoryInfo, ScanConfiguration, ScanMetrics

def extract_code_blocks(pattern_matches: List[Dict], repository_info: Dict) -> List[CodeBlock]:
    """
    Extract CodeBlock models from pattern matches
    """
    blocks = []

    for i, match in enumerate(pattern_matches):
        try:
            # Generate unique block ID
            block_id = f"cb_{hashlib.sha256(f"{match['file_path']}:{match['line_start']}".encode()).hexdigest()[:12]}"

            # Map pattern_id to category (must match SemanticCategory enum)
            category_map = {
                'object-manipulation': 'utility',
                'array-map-filter': 'utility',
                'string-manipulation': 'utility',
                'type-checking': 'utility',
                'validation': 'validator',
                'express-route-handlers': 'api_handler',
                'auth-checks': 'auth_check',
                'error-responses': 'error_handler',
                'request-validation': 'validator',
                'prisma-operations': 'database_operation',
                'query-builders': 'database_operation',
                'connection-handling': 'database_operation',
                'await-patterns': 'async_pattern',
                'promise-chains': 'async_pattern',
                'env-variables': 'config_access',
                'config-objects': 'config_access',
                'console-statements': 'logger',
                'logger-patterns': 'logger'
            }

            category = category_map.get(match['rule_id'], 'utility')

            # Create CodeBlock
            # Note: file_path from ast-grep is already relative to repository root
            block = CodeBlock(
                block_id=block_id,
                pattern_id=match['rule_id'],
                location=SourceLocation(
                    file_path=match['file_path'],
                    line_start=match['line_start'],
                    line_end=match.get('line_end', match['line_start'])
                ),
                relative_path=match['file_path'],  # Already relative from ast-grep
                source_code=match.get('matched_text', ''),
                language='javascript',  # TODO: Detect from file extension
                category=category,
                repository_path=repository_info['path'],
                line_count=match.get('line_end', match['line_start']) - match['line_start'] + 1
            )

            blocks.append(block)

        except Exception as e:
            print(f"Warning: Failed to extract block {i} from {match.get('file_path', 'unknown')}: {e}", file=sys.stderr)
            import traceback
            traceback.print_exc(file=sys.stderr)
            continue

    return blocks


def group_duplicates(blocks: List[CodeBlock]) -> List[DuplicateGroup]:
    """
    Group similar code blocks (basic implementation)
    """
    groups = []

    # Group by content hash (exact duplicates)
    hash_groups = {}
    for block in blocks:
        h = block.content_hash
        if h not in hash_groups:
            hash_groups[h] = []
        hash_groups[h].append(block)

    # Create groups for duplicates (2+ blocks with same hash)
    for h, group_blocks in hash_groups.items():
        if len(group_blocks) >= 2:
            group = DuplicateGroup(
                group_id=f"dg_{h[:12]}",
                pattern_id=group_blocks[0].pattern_id,
                member_block_ids=[b.block_id for b in group_blocks],
                similarity_score=1.0,  # Exact matches
                similarity_method='exact_match',  # Must match SimilarityMethod enum
                category=group_blocks[0].category,
                language=group_blocks[0].language,
                occurrence_count=len(group_blocks),
                total_lines=sum(b.line_count for b in group_blocks),
                affected_files=list(set(b.location.file_path for b in group_blocks)),
                affected_repositories=[group_blocks[0].repository_path]
            )
            groups.append(group)

    return groups


def generate_suggestions(groups: List[DuplicateGroup]) -> List[ConsolidationSuggestion]:
    """
    Generate consolidation suggestions (basic implementation)
    """
    suggestions = []

    for group in groups:
        # Determine strategy based on occurrence count
        if group.occurrence_count <= 3:
            strategy = 'local_util'
        elif group.occurrence_count <= 10:
            strategy = 'shared_package'
        else:
            strategy = 'mcp_server'

        suggestion = ConsolidationSuggestion(
            suggestion_id=f"cs_{group.group_id}",
            duplicate_group_id=group.group_id,
            strategy=strategy,
            strategy_rationale=f"Found {group.occurrence_count} occurrences in {len(group.affected_files)} files",
            impact_score=min(group.impact_score, 100.0),
            complexity='simple',
            migration_risk='low',
            breaking_changes=False,
            affected_files_count=len(group.affected_files),
            affected_repositories_count=len(group.affected_repositories),
            confidence=0.9 if group.similarity_score >= 0.95 else 0.7
        )

        suggestions.append(suggestion)

    return suggestions


def main():
    """
    Main pipeline execution
    """
    try:
        # Read input from stdin
        input_data = json.load(sys.stdin)

        repository_info = input_data['repository_info']
        pattern_matches = input_data['pattern_matches']

        # Stage 3: Extract code blocks
        blocks = extract_code_blocks(pattern_matches, repository_info)

        # Stage 4: Semantic annotation (TODO: Implement full annotator)
        # For now, blocks already have basic category from extraction

        # Stage 5: Group duplicates
        groups = group_duplicates(blocks)

        # Stage 6: Generate suggestions
        suggestions = generate_suggestions(groups)

        # Stage 7: Calculate metrics
        metrics = {
            'total_code_blocks': len(blocks),
            'total_duplicate_groups': len(groups),
            'exact_duplicates': len([g for g in groups if g.similarity_method == 'exact']),
            'structural_duplicates': 0,
            'semantic_duplicates': 0,
            'total_duplicated_lines': sum(g.total_lines for g in groups),
            'potential_loc_reduction': sum(g.total_lines - g.total_lines // g.occurrence_count for g in groups),
            'duplication_percentage': 0.0,  # TODO: Calculate properly
            'total_suggestions': len(suggestions),
            'quick_wins': len([s for s in suggestions if s.complexity == 'trivial']),
            'high_priority_suggestions': len([s for s in suggestions if s.impact_score >= 75])
        }

        # Output result as JSON (use mode='json' to serialize datetime objects)
        result = {
            'code_blocks': [b.model_dump(mode='json') for b in blocks],
            'duplicate_groups': [g.model_dump(mode='json') for g in groups],
            'suggestions': [s.model_dump(mode='json') for s in suggestions],
            'metrics': metrics
        }

        json.dump(result, sys.stdout, indent=2)

    except Exception as e:
        print(f"Error in extraction pipeline: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
