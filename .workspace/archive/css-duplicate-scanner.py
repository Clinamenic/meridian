#!/usr/bin/env python3
"""
CSS Duplicate Scanner for Meridian styles.css

This script analyzes the styles.css file to identify:
1. Duplicate CSS rule blocks
2. Duplicate property declarations within rules
3. Redundant selectors
4. Similar patterns that could be consolidated
"""

import re
import sys
from collections import defaultdict, Counter
from typing import Dict, List, Tuple, Set


def parse_css_file(file_path: str) -> List[Dict]:
    """Parse CSS file and extract rule blocks with their properties."""
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Remove comments
    content = re.sub(r"/\*.*?\*/", "", content, flags=re.DOTALL)

    # Split into rule blocks
    rule_blocks = []
    current_block = ""
    brace_count = 0
    in_rule = False

    for char in content:
        if char == "{":
            brace_count += 1
            in_rule = True
        elif char == "}":
            brace_count -= 1
            if brace_count == 0 and in_rule:
                current_block += char
                rule_blocks.append(current_block.strip())
                current_block = ""
                in_rule = False
                continue

        if in_rule or (not in_rule and char.strip()):
            current_block += char

    # Parse each block
    parsed_blocks = []
    for i, block in enumerate(rule_blocks):
        if not block.strip():
            continue

        # Extract selectors and properties
        parts = block.split("{", 1)
        if len(parts) != 2:
            continue

        selectors = parts[0].strip()
        properties_text = parts[1].rstrip("}").strip()

        # Parse properties
        properties = {}
        for prop_line in properties_text.split(";"):
            prop_line = prop_line.strip()
            if ":" in prop_line:
                prop_parts = prop_line.split(":", 1)
                prop_name = prop_parts[0].strip()
                prop_value = prop_parts[1].strip()
                properties[prop_name] = prop_value

        parsed_blocks.append(
            {
                "line_number": i + 1,  # Approximate line number
                "selectors": selectors,
                "properties": properties,
                "raw_block": block,
                "properties_text": properties_text,
            }
        )

    return parsed_blocks


def find_duplicate_blocks(blocks: List[Dict]) -> List[Tuple[Dict, Dict]]:
    """Find completely duplicate rule blocks."""
    duplicates = []
    seen_blocks = {}

    for block in blocks:
        # Create a normalized key for comparison
        normalized_props = ";".join(
            sorted([f"{k}:{v}" for k, v in block["properties"].items()])
        )
        block_key = f"{block['selectors']}|{normalized_props}"

        if block_key in seen_blocks:
            duplicates.append((seen_blocks[block_key], block))
        else:
            seen_blocks[block_key] = block

    return duplicates


def find_similar_selectors(blocks: List[Dict]) -> Dict[str, List[Dict]]:
    """Find selectors that are similar or could be consolidated."""
    selector_groups = defaultdict(list)

    for block in blocks:
        # Normalize selector for grouping
        normalized = re.sub(r"[.#]", "", block["selectors"])
        normalized = re.sub(r"\s+", " ", normalized).strip()
        selector_groups[normalized].append(block)

    # Return groups with more than one item
    return {k: v for k, v in selector_groups.items() if len(v) > 1}


def find_duplicate_properties(blocks: List[Dict]) -> List[Dict]:
    """Find rules with duplicate property declarations."""
    duplicates = []

    for block in blocks:
        prop_counts = Counter(block["properties"].keys())
        duplicate_props = {
            prop: count for prop, count in prop_counts.items() if count > 1
        }

        if duplicate_props:
            duplicates.append({"block": block, "duplicate_properties": duplicate_props})

    return duplicates


def find_common_patterns(blocks: List[Dict]) -> Dict[str, List[Dict]]:
    """Find common property patterns that could be extracted to utility classes."""
    pattern_groups = defaultdict(list)

    for block in blocks:
        if (
            len(block["properties"]) >= 3
        ):  # Only consider blocks with multiple properties
            # Create a pattern key based on property names (not values)
            pattern_key = ";".join(sorted(block["properties"].keys()))
            pattern_groups[pattern_key].append(block)

    # Return patterns that appear multiple times
    return {k: v for k, v in pattern_groups.items() if len(v) > 1}


def analyze_css_file(file_path: str):
    """Main analysis function."""
    print(f"Analyzing {file_path}...")
    print("=" * 60)

    blocks = parse_css_file(file_path)
    print(f"Found {len(blocks)} CSS rule blocks")

    # 1. Find duplicate blocks
    print("\n1. DUPLICATE RULE BLOCKS:")
    print("-" * 30)
    duplicates = find_duplicate_blocks(blocks)
    if duplicates:
        for i, (block1, block2) in enumerate(duplicates, 1):
            print(f"Duplicate {i}:")
            print(f"  Block 1 (line ~{block1['line_number']}): {block1['selectors']}")
            print(f"  Block 2 (line ~{block2['line_number']}): {block2['selectors']}")
            print(f"  Properties: {len(block1['properties'])} properties")
            print()
    else:
        print("No duplicate rule blocks found.")

    # 2. Find similar selectors
    print("\n2. SIMILAR SELECTORS (potential consolidation):")
    print("-" * 50)
    similar = find_similar_selectors(blocks)
    if similar:
        for pattern, similar_blocks in list(similar.items())[:10]:  # Show first 10
            print(f"Pattern: {pattern}")
            for block in similar_blocks:
                print(
                    f"  - {block['selectors']} ({len(block['properties'])} properties)"
                )
            print()
    else:
        print("No similar selectors found.")

    # 3. Find duplicate properties within rules
    print("\n3. RULES WITH DUPLICATE PROPERTIES:")
    print("-" * 40)
    prop_duplicates = find_duplicate_properties(blocks)
    if prop_duplicates:
        for dup in prop_duplicates[:5]:  # Show first 5
            block = dup["block"]
            print(f"Selector: {block['selectors']}")
            for prop, count in dup["duplicate_properties"].items():
                print(f"  - {prop}: appears {count} times")
            print()
    else:
        print("No rules with duplicate properties found.")

    # 4. Find common patterns
    print("\n4. COMMON PROPERTY PATTERNS (potential utility classes):")
    print("-" * 55)
    patterns = find_common_patterns(blocks)
    if patterns:
        for pattern, pattern_blocks in list(patterns.items())[:5]:  # Show first 5
            print(f"Pattern: {pattern}")
            print(f"  Appears in {len(pattern_blocks)} rules:")
            for block in pattern_blocks[:3]:  # Show first 3 examples
                print(f"    - {block['selectors']}")
            if len(pattern_blocks) > 3:
                print(f"    ... and {len(pattern_blocks) - 3} more")
            print()
    else:
        print("No common patterns found.")

    # 5. Summary statistics
    print("\n5. SUMMARY STATISTICS:")
    print("-" * 25)
    total_properties = sum(len(block["properties"]) for block in blocks)
    avg_properties = total_properties / len(blocks) if blocks else 0

    print(f"Total rule blocks: {len(blocks)}")
    print(f"Total properties: {total_properties}")
    print(f"Average properties per rule: {avg_properties:.1f}")
    print(f"Duplicate blocks found: {len(duplicates)}")
    print(f"Similar selector groups: {len(similar)}")
    print(f"Rules with duplicate properties: {len(prop_duplicates)}")
    print(f"Common patterns: {len(patterns)}")


if __name__ == "__main__":
    css_file = "src/renderer/styles.css"
    try:
        analyze_css_file(css_file)
    except FileNotFoundError:
        print(f"Error: Could not find {css_file}")
        sys.exit(1)
    except Exception as e:
        print(f"Error analyzing CSS file: {e}")
        sys.exit(1)
