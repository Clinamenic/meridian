# CSS Duplicate Analysis Results

## Scanner Summary

- **Total rule blocks**: 706
- **Total properties**: 2,809
- **Average properties per rule**: 4.0
- **Duplicate blocks found**: 0 ✅
- **Similar selector groups**: 7
- **Common patterns**: 56

## Key Findings

### 1. **No Complete Duplicate Blocks** ✅

Good news! The major duplicate block (collapse/expand styles) has been successfully removed. No complete duplicate rule blocks remain.

### 2. **Similar Selectors That Could Be Consolidated**

#### A. **Wallet-Related Selectors** (3 groups)

```css
/* Current: Multiple similar wallet selectors */
.wallet-indicator
  (3 properties)
  -
  appears
  2x
  .wallet-label
  (3 properties vs 2 properties)
  -
  appears
  2x
  .wallet-value
  (3 properties vs 7 properties)
  -
  appears
  2x;
```

**Recommendation**: Consolidate into base classes with modifiers:

```css
.wallet-indicator {
  /* base styles */
}
.wallet-label {
  /* base styles */
}
.wallet-value {
  /* base styles */
}
.wallet-value.compact {
  /* compact variant */
}
```

#### B. **Character Count** (2 variants)

```css
.character-count
  (5 properties)
  -
  appears
  2x
  .character-count
  (4 properties)
  -
  appears
  2x;
```

**Recommendation**: Merge into single rule with conditional states:

```css
.character-count {
  /* base styles */
}
.character-count.warning {
  /* warning state */
}
.character-count.error {
  /* error state */
}
```

#### C. **Phase Number** (2 variants)

```css
.phase-number
  (11 properties)
  -
  appears
  2x
  .phase-number
  (12 properties)
  -
  appears
  2x;
```

**Recommendation**: Consolidate into single rule with modifiers.

#### D. **Preview Content** (2 variants)

```css
.preview-content
  (9 properties)
  -
  appears
  2x
  .preview-content
  (1 properties)
  -
  appears
  2x;
```

**Recommendation**: Review if both are needed or if one can be removed.

### 3. **Common Property Patterns** (56 patterns found)

#### High-Impact Patterns for Utility Classes:

**Pattern 1: Button-like elements** (17 instances)

```css
align-items: center;
display: flex;
gap: var(--spacing-xs);
```

**Components**: `.footer-left`, `.footer-center`, `.footer-right`, `.panel-actions`, `.panel-search`, etc.

**Pattern 2: Icon buttons** (2 instances)

```css
align-items: center;
background-color: transparent;
border: none;
border-radius: 50%;
color: var(--text-secondary);
cursor: pointer;
display: flex;
height: var(--header-height);
justify-content: center;
padding: var(--spacing-xs);
position: relative;
transition: all 0.2s ease;
width: var(--header-height);
```

**Components**: `.header-icon-btn`, `.panel-header-icon-btn`

**Pattern 3: Typography** (5 instances)

```css
color: var(--text-muted);
font-family: var(--font-family);
font-size: var(--font-size-sm);
```

**Components**: Various text elements

## Recommended Cleanup Actions

### Phase 1: High-Impact Consolidations

1. **Create Utility Classes**

   ```css
   /* Flex utilities */
   .flex-center {
     display: flex;
     align-items: center;
     justify-content: center;
   }

   .flex-gap-xs {
     gap: var(--spacing-xs);
   }

   /* Icon button base */
   .icon-btn {
     align-items: center;
     background-color: transparent;
     border: none;
     border-radius: 50%;
     color: var(--text-secondary);
     cursor: pointer;
     display: flex;
     height: var(--header-height);
     justify-content: center;
     padding: var(--spacing-xs);
     position: relative;
     transition: all 0.2s ease;
     width: var(--header-height);
   }
   ```

2. **Consolidate Wallet Components**

   - Merge duplicate `.wallet-indicator` rules
   - Merge duplicate `.wallet-label` rules
   - Merge duplicate `.wallet-value` rules with modifiers

3. **Consolidate Character Count**
   - Merge duplicate `.character-count` rules
   - Add state modifiers for warning/error

### Phase 2: Medium-Impact Optimizations

4. **Consolidate Phase Numbers**

   - Merge duplicate `.phase-number` rules
   - Add modifiers for different contexts

5. **Review Preview Content**
   - Determine if both `.preview-content` variants are needed
   - Consolidate or remove redundant one

### Phase 3: Pattern Extraction

6. **Extract Common Typography Patterns**

   - Create utility classes for common text styles
   - Replace repeated patterns with utilities

7. **Extract Common Layout Patterns**
   - Create utilities for common flex layouts
   - Create utilities for common spacing patterns

## Estimated Impact

### Lines to Remove: ~50-80 lines

- Wallet component consolidations: ~15-20 lines
- Character count consolidation: ~5-10 lines
- Phase number consolidation: ~10-15 lines
- Preview content consolidation: ~5-10 lines
- Pattern extraction: ~15-25 lines

### Lines to Add: ~30-50 lines

- Utility classes: ~20-30 lines
- Consolidated rules: ~10-20 lines

### Net Reduction: ~20-30 lines

**Estimated final file size**: ~5,150 lines (down from 5,183)

## Implementation Priority

1. **High Priority**: Wallet components, character count (immediate impact)
2. **Medium Priority**: Phase numbers, preview content (moderate impact)
3. **Low Priority**: Pattern extraction (long-term maintainability)

## Next Steps

1. Review the specific duplicate rules identified
2. Implement Phase 1 consolidations
3. Test functionality after each consolidation
4. Measure actual line reduction
5. Plan Phase 2 and 3 implementations
