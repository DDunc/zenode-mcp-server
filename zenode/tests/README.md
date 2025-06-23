# Zenode Test Suite

## Philosophy: Real Provider Testing

Traditional unit tests with mocks are insufficient for AI systems. We test against **real provider APIs** to ensure our model integrations remain current and functional.

## Quick Start

1. **Copy the test environment file**:
   ```bash
   cp .env.test.example .env.test
   ```

2. **Add at least one API key**:
   ```bash
   # Edit .env.test and add one or more:
   OPENAI_API_KEY=your-test-key
   OPENROUTER_API_KEY=your-test-key
   GEMINI_API_KEY=your-test-key
   ```

3. **Run tests**:
   ```bash
   npm test
   ```

## Test Modes

### 1. Mock Mode (No API Keys)
- Tests run with mocked responses
- Basic functionality validation
- Fast execution
- ⚠️ Doesn't validate real provider behavior

### 2. Real Provider Mode (Recommended)
- Tests hit actual API endpoints
- Validates model availability
- Ensures compatibility with provider changes
- 💰 Uses API credits (use test/dev keys)

## Test Structure

```
tests/
├── vitest-setup.ts      # Global test configuration
├── README.md            # This file
└── .env.test.example    # Template for test environment

src/
├── providers/
│   └── __tests__/
│       └── provider-availability.test.ts  # Real API health checks
└── tools/
    └── __tests__/
        └── planner.test.ts  # Hybrid mock/real tests
```

## Running Specific Tests

```bash
# Run all tests
npm test

# Run provider availability tests only
npm test provider-availability

# Run with verbose output
npm test -- --reporter=verbose

# Run in watch mode
npm test -- --watch
```

## Test Categories

### Provider Tests (`provider-availability.test.ts`)
- Verifies API keys work
- Lists available models
- Checks model categories (reasoning, vision, etc.)
- Validates expensive model warnings
- Health checks response times

### Tool Tests (e.g., `planner.test.ts`)
- Unit tests with mocks when no providers
- Integration tests with real AI when providers available
- Validates tool-specific functionality
- Tests error handling

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `TEST_REAL_PROVIDERS` | Force real provider mode | `true` if any API key set |
| `TEST_LOG_LEVEL` | Log verbosity | `warn` |
| `TEST_TIMEOUT` | Test timeout (ms) | `30000` |
| `TEST_RATE_LIMIT_DELAY` | Delay between API calls | `1000` |

## Cost Management

⚠️ **Real provider tests use API credits!**

Tips to minimize costs:
1. Use development/test API keys with spending limits
2. Run provider tests selectively
3. Set rate limiting in `.env.test`
4. Use cheaper models for testing when possible

## Writing New Tests

### For Provider-Dependent Features:

```typescript
import { skipIfNoProviders } from '../tests/vitest-setup.js';

it('should work with real AI', async () => {
  if (skipIfNoProviders()) return;
  
  // Your test that needs real AI
});
```

### For Hybrid Tests:

```typescript
// Automatically uses mocks if no providers
if (!hasProviders) {
  vi.spyOn(tool, 'execute').mockImplementation(mockImpl);
}
```

## Continuous Integration

For CI/CD pipelines:

1. **Option 1**: Use restricted test API keys
2. **Option 2**: Run mock-only tests in CI
3. **Option 3**: Schedule real provider tests separately

```yaml
# Example GitHub Actions
env:
  OPENAI_API_KEY: ${{ secrets.TEST_OPENAI_KEY }}
  TEST_RATE_LIMIT_DELAY: 2000  # Slower in CI
```

## Troubleshooting

### "No models available" error
- Check API keys in `.env.test`
- Verify keys are valid
- Check provider service status

### Tests timing out
- Increase `TEST_TIMEOUT`
- Check network connectivity
- Verify provider isn't rate limiting

### Costs too high
- Use test-specific API keys
- Reduce test frequency
- Mock expensive operations

## Future Improvements

- [ ] Cost tracking per test run
- [ ] Automatic provider fallback
- [ ] Test result caching
- [ ] Provider-specific test suites
- [ ] Performance benchmarking