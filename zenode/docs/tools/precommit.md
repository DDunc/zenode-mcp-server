# Precommit Tool - Git Change Validation

**Comprehensive pre-commit validation that catches bugs, security issues, and incomplete implementations**

The `zenode:precommit` tool provides essential quality gates before git commits, ensuring code changes meet requirements, maintain security standards, and prevent regressions. With recursive repository discovery and deep analysis capabilities, it's the critical final step before committing code to prevent bugs from entering the codebase.

## Key Features

- **ALWAYS use before committing** - Essential quality gate for all code changes
- **Recursive repository discovery** - Finds all git repos including nested submodules
- **Requirement compliance validation** - Ensures implementation matches original intent
- **Security vulnerability detection** - Catches exposed secrets and security issues
- **Incomplete change detection** - Finds missing tests, unused functions, broken imports
- **Cross-repository impact analysis** - Reviews changes across multiple repos simultaneously
- **Smart diff truncation** - Handles large changesets without exceeding context limits
- **Multi-provider model support** - Leverage best AI models for thorough analysis
- **Container-native operations** - Works within zenode's Docker environment

## Critical Usage Pattern

**⚠️ ESSENTIAL: Always run precommit before any git commit!**

```bash
# Before any commit, ALWAYS run:
zenode:precommit "/workspace" "implemented user authentication with OAuth2 and MFA support"

# Then commit only after precommit validation passes:
git add .
git commit -m "Add OAuth2 authentication with MFA"
```

## Tool Parameters

### Required Parameters
- `path`: Starting directory to search for git repositories (must be absolute path)
- `model`: AI model for analysis (required in auto mode)

### Core Parameters
- `prompt`: Original user request description providing critical context
- `compare_to`: Git ref (branch/tag/commit) to compare against instead of local changes
- `review_type`: full|security|performance|quick (default: full)
- `severity_filter`: critical|high|medium|all (default: all)

### Scope Control
- `include_staged`: Include staged changes (default: true)
- `include_unstaged`: Include unstaged changes (default: true)
- `max_depth`: Repository search depth limit (default: 5)
- `focus_on`: Specific aspects to prioritize in review

### Enhancement Parameters
- `files`: Additional context files (configs, docs, specs)
- `thinking_mode`: minimal|low|medium|high|max (default: medium)
- `use_websearch`: Enable security/best practice research (default: true)
- `continuation_id`: Continue previous validation discussions

## Usage Examples

### Essential Pre-Commit Workflow
```bash
# Step 1: Complete development work
# Step 2: ALWAYS validate before committing
zenode:precommit "/workspace" "Added payment processing with Stripe integration and error handling" --model pro --thinking-mode high

# Step 3: Address any issues found
# Step 4: Only then commit
git add .
git commit -m "Add Stripe payment processing with comprehensive error handling"
```

### Security-Focused Validation
```bash
# Prioritize security review for authentication changes
zenode:precommit "/workspace" "implemented JWT authentication with refresh tokens" --model o3 --review-type security --severity-filter critical --focus-on "JWT security, token storage, and session management"
```

### Multi-Repository Project Validation
```bash
# Validate changes across microservices repositories
zenode:precommit "/workspace/microservices" "updated user service API and dependent services" --model pro --thinking-mode high --include-staged true --include-unstaged true
```

### Feature Branch Validation
```bash
# Compare feature branch against main before merge
zenode:precommit "/workspace" "complete implementation of real-time chat feature" --compare-to main --model o3 --review-type full --thinking-mode max
```

### Quick Critical Issue Check
```bash
# Fast validation for hotfixes
zenode:precommit "/workspace" "fixed critical authentication bypass bug" --model flash --review-type quick --severity-filter critical --thinking-mode low
```

### Comprehensive Release Validation
```bash
# Thorough validation for production releases
zenode:precommit "/workspace" "v2.0 release with new API and database schema changes" --model pro --thinking-mode max --review-type full --severity-filter all --use-websearch true --files ["/workspace/CHANGELOG.md", "/workspace/migration.sql"]
```

## Zenode-Specific Features

### Container-Native Git Operations
The precommit tool operates within zenode's Docker environment:
- **Volume-mounted repositories**: Access to git repos via `/workspace/` paths
- **Container git configuration**: Proper git setup within Docker containers
- **Cross-container repository discovery**: Find repos across mounted volumes
- **Docker networking**: Secure access to git remotes and dependency services

### Multi-Provider AI Analysis
```bash
# Use different models for different validation aspects:

# Comprehensive reasoning for complex changes
zenode:precommit "/workspace" "major refactoring" --model pro --thinking-mode high

# Fast systematic validation for standard changes
zenode:precommit "/workspace" "bug fixes" --model o3 --thinking-mode medium

# Lightning-fast validation for minor changes
zenode:precommit "/workspace" "documentation updates" --model flash --thinking-mode low
```

### Advanced Repository Discovery
```bash
# Discover nested repositories and submodules
zenode:precommit "/workspace" "changes across multiple services" --max-depth 3

# Focus on specific repository structure
zenode:precommit "/workspace/backend" "API changes only" --max-depth 2
```

### Intelligent Change Analysis
- **Token-aware diff processing**: Smart truncation for large changesets
- **Cross-file dependency tracking**: Identifies breaking changes across modules
- **Import/export validation**: Ensures module boundaries remain intact
- **Configuration change impact**: Analyzes environment and config file changes

## Validation Categories

### Code Quality Checks
```markdown
✅ **Completeness Validation**:
- New functions have corresponding tests
- Documentation updated for API changes
- Configuration files updated appropriately
- Database migrations included when needed

✅ **Logic and Implementation**:
- No obvious bugs or logical errors
- Proper error handling implementation
- Edge cases appropriately handled
- Performance implications considered

✅ **Code Standards Compliance**:
- Follows project coding standards
- Consistent naming conventions
- Proper TypeScript types and interfaces
- ESLint/TSLint rules compliance
```

### Security Analysis
```markdown
🔒 **Security Vulnerability Detection**:
- No exposed API keys or secrets
- Input validation and sanitization
- SQL injection prevention
- XSS vulnerability prevention
- Authentication and authorization checks

🔒 **Access Control Validation**:
- Proper permission checking
- Role-based access implementation
- Session management security
- CORS configuration correctness
```

### Requirement Compliance
```markdown
📋 **Implementation Verification**:
- Changes match original requirements
- All acceptance criteria addressed
- No unauthorized scope creep
- Feature completeness validation

📋 **Integration Safety**:
- Breaking changes properly documented
- Backward compatibility maintained
- API contract preservation
- Environment-specific considerations
```

## Advanced Usage Patterns

### Staged Development Workflow
```bash
# Stage 1: Feature development validation
zenode:precommit "/workspace" "initial user profile feature implementation" --include-unstaged true --include-staged false --review-type quick

# Stage 2: Pre-staging validation
zenode:precommit "/workspace" "complete user profile feature ready for staging" --include-staged true --include-unstaged false --review-type full

# Stage 3: Pre-production validation
zenode:precommit "/workspace" "user profile feature ready for production" --compare-to main --review-type full --thinking-mode max
```

### Cross-Tool Integration
```bash
# Step 1: Comprehensive precommit validation
zenode:precommit "/workspace" "payment processing implementation" --model pro --continuation-id {session_id}

# Step 2: If issues found, detailed code review
zenode:codereview "fix issues identified in precommit" --files ["/workspace/src/payment"] --continuation-id {session_id}

# Step 3: Test generation for missing coverage
zenode:testgen "generate tests for payment processing based on precommit findings" --files ["/workspace/src/payment"] --continuation-id {session_id}

# Step 4: Final validation
zenode:precommit "/workspace" "payment processing with fixes and tests" --model pro --continuation-id {session_id}
```

### Multi-Branch Validation
```bash
# Compare feature branch against multiple targets
zenode:precommit "/workspace" "feature branch ready for merge" --compare-to main --model pro
zenode:precommit "/workspace" "check compatibility with develop branch" --compare-to develop --model o3

# Use consensus for merge decision
zenode:consensus "should we merge this feature branch?" --models '[
  {"model": "pro", "stance": "for", "stance_prompt": "Focus on feature completeness and quality"},
  {"model": "o3", "stance": "against", "stance_prompt": "Focus on potential risks and issues"}
]' --continuation-id {precommit_session}
```

### Iterative Quality Improvement
```bash
# Initial validation
zenode:precommit "/workspace" "authentication system implementation" --model pro --continuation-id {session_id}

# Address issues and re-validate
zenode:precommit "/workspace" "authentication system with security fixes" --model pro --continuation-id {session_id}

# Final validation with higher scrutiny
zenode:precommit "/workspace" "final authentication system validation" --model o3 --thinking-mode max --review-type security --continuation-id {session_id}
```

## Output Analysis and Action Items

### Validation Result Categories
```markdown
## 🟢 PASSED - Ready to Commit
✅ All requirements met
✅ No security vulnerabilities found
✅ Code quality standards satisfied
✅ Complete implementation with tests

Action: Safe to commit and push

## 🟡 WARNINGS - Address Before Commit
⚠️ Minor issues that should be fixed
⚠️ Missing documentation
⚠️ Performance considerations
⚠️ Non-critical test coverage gaps

Action: Fix warnings then re-validate

## 🔴 CRITICAL ISSUES - Do Not Commit
❌ Security vulnerabilities
❌ Breaking changes without migration
❌ Logic errors or bugs
❌ Incomplete implementations

Action: Fix issues, then run precommit again
```

### Typical Issue Categories Found
```markdown
**Security Issues**:
- Exposed API keys in configuration files
- Missing input validation on user inputs
- Inadequate authentication checks
- Potential SQL injection vulnerabilities

**Code Quality Issues**:
- Functions added but never called
- Imports added but not used
- Missing error handling for async operations
- Inconsistent error messaging

**Completeness Issues**:
- New API endpoints without tests
- Database schema changes without migrations
- Configuration changes not documented
- Breaking changes without version updates
```

## Best Practices for Zenode

### Effective Context Provision
```bash
# ✅ GOOD: Detailed context with requirements
zenode:precommit "/workspace" "Implemented OAuth2 authentication following RFC 6749 with PKCE extension, supporting Google and GitHub providers, including refresh token rotation and secure session management as specified in requirements document" --files ["/workspace/docs/auth-requirements.md"]

# ❌ BAD: Vague context
zenode:precommit "/workspace" "added auth stuff"
```

### Strategic Model Selection
```bash
# Large, complex changes requiring deep analysis
zenode:precommit "/workspace" "major architectural refactoring" --model pro --thinking-mode max

# Standard feature implementations
zenode:precommit "/workspace" "user profile management" --model o3 --thinking-mode medium

# Minor fixes and updates
zenode:precommit "/workspace" "bug fix for edge case" --model flash --thinking-mode low
```

### Repository Organization
```bash
# For monorepos with multiple services
zenode:precommit "/workspace" "changes across user and payment services" --max-depth 2

# For microservices in separate repos
zenode:precommit "/workspace/services" "API contract updates" --max-depth 1

# For complex nested structures
zenode:precommit "/workspace" "infrastructure and application changes" --max-depth 5
```

### Continuous Quality Culture
- **Never skip precommit**: Make it mandatory before any commit
- **Address all critical issues**: Never commit with red flags
- **Document validation decisions**: Use continuation IDs to track reasoning
- **Learn from findings**: Use patterns to improve development practices

## Integration with Git Workflows

### Feature Branch Workflow
```bash
# During development
zenode:precommit "/workspace" "work in progress validation" --include-unstaged true --review-type quick

# Before creating pull request
zenode:precommit "/workspace" "feature complete, ready for PR" --compare-to main --review-type full --thinking-mode high

# Before merging to main
zenode:precommit "/workspace" "final validation before merge" --compare-to main --review-type security --severity-filter critical
```

### Gitflow Integration
```bash
# Feature branch completion
zenode:precommit "/workspace" "feature ready for develop" --compare-to develop --model pro

# Release preparation
zenode:precommit "/workspace" "release candidate validation" --compare-to main --model o3 --thinking-mode max --review-type full

# Hotfix validation
zenode:precommit "/workspace" "critical security hotfix" --compare-to main --review-type security --severity-filter critical
```

### CI/CD Pipeline Integration
```bash
# Pre-commit hook equivalent
zenode:precommit "/workspace" "$COMMIT_MESSAGE" --model flash --review-type quick --severity-filter high

# Pre-merge validation
zenode:precommit "/workspace" "$PR_DESCRIPTION" --compare-to main --model pro --review-type full

# Pre-deployment validation
zenode:precommit "/workspace" "$DEPLOYMENT_DESCRIPTION" --compare-to production --model o3 --thinking-mode max
```

## Configuration and Dependencies

### Git Repository Requirements
- **Git installed**: Proper git configuration in containers
- **Repository access**: Read access to all repositories being validated
- **Branch permissions**: Access to compare against target branches
- **Submodule support**: Proper submodule configuration if used

### Container Environment
- **Volume mounts**: Proper `/workspace/` access to repositories
- **Git credentials**: Configure for private repositories if needed
- **Network access**: For web search and remote repository operations
- **File permissions**: Appropriate read access to all files

### Model Provider Configuration
- **Extended context models**: Recommended for large changesets
- **Multiple providers**: Fallback options for different validation types
- **Cost optimization**: Balance thoroughness with model expenses
- **Rate limiting**: Respect API limits for large repository operations

## When to Use Precommit vs Other Zenode Tools

- **Use `zenode:precommit`** for: Validating git changes before commit, ensuring requirement compliance, preventing bugs
- **Use `zenode:codereview`** for: General code quality assessment without git context
- **Use `zenode:debug`** for: Investigating specific runtime issues or errors
- **Use `zenode:analyze`** for: Understanding existing code without validation context
- **Use `zenode:testgen`** for: Creating tests after precommit identifies coverage gaps

## Error Prevention Impact

Regular use of zenode:precommit dramatically improves code quality:
- **Prevents production bugs** by catching issues before commit
- **Maintains security standards** through automated vulnerability detection  
- **Ensures requirement compliance** by validating against original intent
- **Improves team collaboration** by maintaining consistent code quality
- **Reduces technical debt** by preventing incomplete implementations

The zenode:precommit tool serves as the essential quality gate that prevents bugs, security issues, and incomplete implementations from entering your codebase, making it indispensable for professional software development.