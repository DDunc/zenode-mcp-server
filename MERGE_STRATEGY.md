# Merge Strategy for Upstream Updates

## Overview

This document outlines the strategy for handling merge conflicts when pulling from upstream, specifically designed to minimize future README conflicts.

## README Structure Strategy

### Current Structure (Post-Strategy Implementation)

Our README.md now follows this structure to minimize future conflicts:

```
1. Zenode Section (Lines 1-126)
   - Zenode MCP header
   - Quick start for Node.js
   - Documentation links
   - Key features
   - Migration status
   - Architecture
   - Development (Node.js focus)
   - Configuration
   - Tools overview
   - License & acknowledgments

2. Separator (Line 127)
   ---

3. Upstream Python Section (Lines 128+)
   - Complete upstream README content
   - Zen MCP: One Context. Many Minds.
   - All upstream documentation
```

### Why This Works

1. **Clear Separation**: The `---` separator clearly delineates our content from upstream content
2. **Zenode First**: Our Node.js port information is prominent and comes first
3. **Upstream Preservation**: Complete upstream content is preserved after our section
4. **Minimal Conflicts**: Future upstream changes will only affect the second section

## Merge Process

### When Upstream Updates README

1. **Fetch upstream changes**:
   ```bash
   git fetch upstream
   ```

2. **Attempt merge**:
   ```bash
   git merge upstream/main
   ```

3. **If README conflicts occur**:
   - The conflict will likely be in the upstream section (after line 127)
   - Our Zenode section (lines 1-126) should remain unaffected
   - Simply accept upstream changes for their section
   - Keep our separator and Zenode content intact

4. **Resolve conflict**:
   - Keep lines 1-127 (our Zenode section + separator) unchanged
   - Replace everything after line 127 with upstream's complete README
   - Commit the resolved merge

### Command Examples

```bash
# Standard merge process
git fetch upstream
git merge upstream/main

# If conflicts occur, resolve and commit
git add README.md
git commit --no-edit
```

## File Structure Benefits

- **Reduced conflicts**: Changes to upstream README won't affect our intro section
- **Clear ownership**: First section is clearly ours, second section is clearly upstream's
- **Future-proof**: Strategy works regardless of how upstream evolves their README
- **User clarity**: Users see Zenode info first, then can access full upstream documentation

## Testing the Strategy

This strategy was implemented during the merge of commits up to `9b98df6`, which included significant upstream README changes. The conflict was resolved cleanly by:

1. Placing all Zenode-specific content first
2. Adding a clear separator
3. Including complete upstream content after the separator

Future merges should have significantly fewer README conflicts using this approach.

## Maintenance

- **Never modify content after the separator** unless coordinating with upstream
- **Keep Zenode section concise** to minimize our maintenance burden
- **Update separator content only if necessary** for clarity
- **Test merge strategy periodically** by pulling upstream changes

This strategy ensures we maintain our Node.js port identity while preserving all upstream documentation and minimizing merge conflicts.