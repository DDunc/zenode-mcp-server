# Zenode Porting Plan - Simplified

**Date**: 2025-06-17  
**Source**: 35 commits from upstream Python zen-mcp  
**Goal**: Port critical improvements to Node.js zenode

## Priority Items (Top 10)

### 🔴 CRITICAL (Complete First)
1. **`91077e3`** - File embedding performance improvements ✅ **DONE**
2. **`97fa678`** - Vision support + image processing pipeline
3. **`ebfda18`** - Retry logic with progressive delays

### 🟠 HIGH (Complete Next)  
4. **`9b98df6`** - O3-Pro connection fixes
5. **`f55f2b0`** - Google model restriction fixes
6. **`70b64ad`** - ListModels tool
7. **`4a95197`** - Model validation consistency

### 🟡 MEDIUM (If Time Allows)
8. **`4c0bd3b`** - File collection strategy improvements
9. **`cb17582`** - OpenRouter caching optimization
10. **`357452b`** - Prompt support feature

## 2-Week Implementation Plan

### Week 1: Core Features
- ✅ File embedding performance (completed)
- Vision support integration
- Retry logic implementation
- Google model fixes

### Week 2: Tools & Polish
- O3-Pro connection fixes
- ListModels tool creation
- Model validation consistency
- Testing and verification

## Key Node.js Changes Needed

```bash
# New dependencies
npm install sharp file-type canvas pdf-parse

# Files to modify
- zenode/src/providers/gemini.ts (retry logic, model restrictions)
- zenode/src/providers/openai.ts (O3-Pro fixes)
- zenode/src/tools/ (vision support integration)
- zenode/src/tools/listmodels.ts (new tool)
```

## Major Risks
- **Vision pipeline complexity** - Test image processing thoroughly
- **Model provider changes** - Validate all providers still work
- **Performance regressions** - Benchmark before/after

## Success Criteria
- [ ] Vision support works with common formats
- [ ] No regressions in existing functionality  
- [ ] O3-Pro models connect properly
- [ ] All priority items have tests

---
*Simplified from 300-line detailed plan focusing on actionable development workflow items*