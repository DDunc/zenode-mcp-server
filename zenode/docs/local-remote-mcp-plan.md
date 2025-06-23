# Local Remote MCP Implementation Plan

## 🎭 AI Council Discussion: Proving Remote MCP Viability

*The council convenes with 🐞 The Problem Solver, 🔍 The Detective, and 📋 The Strategist to create an incremental testing plan for remote MCP.*

---

## Executive Summary

Before investing in full AWS infrastructure, we need to prove that zenode can function as a remote MCP server. This document outlines 10 incremental tests that validate each assumption, building confidence before the Fargate deployment.

## Core Architecture Shift

### 🔍 The Detective's Analysis:

The fundamental change from local to remote MCP:

```
LOCAL MCP (Current):
Claude Code <--> stdio <--> Docker Container (same machine)

REMOTE MCP (Target):
Claude Code <--> HTTP/SSE <--> API Gateway <--> Fargate <--> Multi-tenant Containers
```

Key differences to test:
1. **Transport**: stdio → HTTP/SSE
2. **Authentication**: None → OAuth2
3. **File Access**: Direct → S3/Virtual FS
4. **State**: Process memory → Redis/DynamoDB
5. **Isolation**: Single user → Multi-tenant

## Multi-Tenancy Architecture (Based on 2025 Best Practices)

### 📋 The Strategist's Design:

Based on AWS Fargate multi-tenant patterns:

1. **Task-Level Isolation**: Each tenant gets dedicated Fargate tasks
2. **Network Policies**: Security groups per tenant
3. **IAM Roles**: Task-specific roles with tenant boundaries
4. **Resource Quotas**: CPU/memory limits per tenant
5. **Data Isolation**: Tenant-prefixed S3 buckets and Redis keyspaces

## The 10 Incremental Tests

### Test 1: Basic HTTP Transport
**Goal**: Prove MCP can work over HTTP instead of stdio

```typescript
// test-1-http-transport.ts
import express from 'express';
import { MCPServer } from '../src/mcp-server';

const app = express();
app.use(express.json());

// Simulate MCP over HTTP
app.post('/mcp/v1/message', async (req, res) => {
  const response = await MCPServer.handleMessage(req.body);
  res.json(response);
});

// Test script
async function test() {
  // Start local HTTP server
  const server = app.listen(3000);
  
  // Send MCP initialization
  const initResponse = await fetch('http://localhost:3000/mcp/v1/message', {
    method: 'POST',
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'initialize',
      params: { capabilities: {} },
      id: 1
    })
  });
  
  assert(initResponse.ok);
  assert(initResponse.body.result.name === 'zenode');
  
  console.log('✅ Test 1 Passed: HTTP transport works');
}
```

**Success Criteria**: 
- MCP messages work over HTTP
- Response format matches stdio version
- No message ordering issues

### Test 2: OAuth2 Mock Authentication
**Goal**: Validate OAuth2 flow without AWS Cognito

```typescript
// test-2-oauth-mock.ts
import { MockOAuthProvider } from './mocks/oauth-provider';

const oauth = new MockOAuthProvider({
  clientId: 'test-client',
  clientSecret: 'test-secret',
  redirectUri: 'http://localhost:3000/callback'
});

// Implement discovery endpoints
app.get('/.well-known/oauth-authorization-server', (req, res) => {
  res.json({
    issuer: 'http://localhost:3000',
    authorization_endpoint: 'http://localhost:3000/oauth/authorize',
    token_endpoint: 'http://localhost:3000/oauth/token',
    scopes_supported: ['read', 'write']
  });
});

// Test OAuth flow
async function testOAuth() {
  // 1. Get authorization URL
  const authUrl = oauth.getAuthorizationUrl();
  
  // 2. Simulate user authorization
  const code = await oauth.simulateUserAuth('user123');
  
  // 3. Exchange code for token
  const token = await oauth.exchangeCode(code);
  
  // 4. Validate token on MCP request
  const response = await fetch('http://localhost:3000/mcp/v1/message', {
    headers: { 'Authorization': `Bearer ${token}` },
    method: 'POST',
    body: JSON.stringify({ method: 'list_tools' })
  });
  
  assert(response.status === 200);
  console.log('✅ Test 2 Passed: OAuth2 authentication works');
}
```

**Success Criteria**:
- OAuth discovery endpoints work
- Token exchange succeeds
- Authenticated requests accepted
- Unauthenticated requests rejected

### Test 3: Multi-User Simulation
**Goal**: Prove tenant isolation with multiple concurrent users

```typescript
// test-3-multi-user.ts
import { DockerCompose } from './utils/docker-compose';

async function testMultiTenancy() {
  // Start 3 isolated containers
  const compose = new DockerCompose({
    services: {
      'user1': createUserService('user1', 3001),
      'user2': createUserService('user2', 3002),
      'user3': createUserService('user3', 3003)
    }
  });
  
  await compose.up();
  
  // Create user-specific tokens
  const tokens = {
    user1: await oauth.createToken('user1'),
    user2: await oauth.createToken('user2'),
    user3: await oauth.createToken('user3')
  };
  
  // Test isolation: User1 creates a file
  await fetch('http://localhost:3001/mcp/v1/message', {
    headers: { 'Authorization': `Bearer ${tokens.user1}` },
    method: 'POST',
    body: JSON.stringify({
      method: 'write_file',
      params: { path: '/workspace/secret.txt', content: 'user1 secret' }
    })
  });
  
  // Test: User2 cannot read User1's file
  const user2Read = await fetch('http://localhost:3002/mcp/v1/message', {
    headers: { 'Authorization': `Bearer ${tokens.user2}` },
    method: 'POST',
    body: JSON.stringify({
      method: 'read_file',
      params: { path: '/workspace/secret.txt' }
    })
  });
  
  assert(user2Read.status === 403 || user2Read.body.error);
  console.log('✅ Test 3 Passed: Multi-user isolation works');
}
```

**Success Criteria**:
- Each user has isolated filesystem
- Cross-tenant access denied
- Concurrent operations don't interfere
- Resource limits enforced

### Test 4: S3 Virtual Filesystem
**Goal**: Validate file operations work with S3 backend

```typescript
// test-4-s3-filesystem.ts
import { S3FileSystem } from '../src/filesystem/s3-adapter';
import { LocalS3Mock } from './mocks/s3-mock';

async function testS3FileSystem() {
  // Use LocalStack or S3 mock
  const s3 = new LocalS3Mock();
  const fs = new S3FileSystem({
    bucket: 'zenode-workspaces',
    prefix: 'user123/',
    s3Client: s3
  });
  
  // Test basic operations
  await fs.writeFile('/project/index.js', 'console.log("hello")');
  const content = await fs.readFile('/project/index.js');
  assert(content === 'console.log("hello")');
  
  // Test directory listing
  await fs.writeFile('/project/src/app.js', '// app');
  const files = await fs.listDirectory('/project');
  assert(files.includes('index.js'));
  assert(files.includes('src/'));
  
  // Test move/copy
  await fs.copyFile('/project/index.js', '/project/index.backup.js');
  assert(await fs.exists('/project/index.backup.js'));
  
  console.log('✅ Test 4 Passed: S3 filesystem abstraction works');
}
```

**Success Criteria**:
- Read/write operations work
- Directory navigation works
- File metadata preserved
- Performance acceptable (<100ms per op)

### Test 5: Cold Start Simulation
**Goal**: Measure and optimize cold start times

```typescript
// test-5-cold-start.ts
async function testColdStart() {
  const measurements = [];
  
  for (let i = 0; i < 5; i++) {
    // Kill container to simulate cold start
    await docker.kill('zenode-test');
    await docker.remove('zenode-test');
    
    const startTime = Date.now();
    
    // Start new container
    await docker.run('zenode:latest', {
      name: 'zenode-test',
      ports: { '3000': '3000' }
    });
    
    // Wait for health check
    await waitForHealth('http://localhost:3000/health');
    
    // First MCP request
    const response = await fetch('http://localhost:3000/mcp/v1/message', {
      method: 'POST',
      body: JSON.stringify({ method: 'initialize' })
    });
    
    const coldStartTime = Date.now() - startTime;
    measurements.push(coldStartTime);
    
    console.log(`Cold start ${i + 1}: ${coldStartTime}ms`);
  }
  
  const avgColdStart = measurements.reduce((a, b) => a + b) / measurements.length;
  assert(avgColdStart < 5000, `Cold start too slow: ${avgColdStart}ms`);
  
  console.log(`✅ Test 5 Passed: Average cold start ${avgColdStart}ms`);
}
```

**Success Criteria**:
- Cold start < 5 seconds
- Warm requests < 100ms
- Memory usage stable
- No timeout errors

### Test 6: Network Latency Simulation
**Goal**: Ensure MCP works with realistic network delays

```typescript
// test-6-network-latency.ts
import { NetworkProxy } from './utils/network-proxy';

async function testNetworkLatency() {
  // Add 100ms latency to simulate internet
  const proxy = new NetworkProxy({
    target: 'http://localhost:3000',
    latency: 100,
    jitter: 20
  });
  
  await proxy.listen(4000);
  
  // Test various operations with latency
  const operations = [
    { method: 'list_tools', expectedTime: 200 },
    { method: 'read_file', params: { path: '/test.txt' }, expectedTime: 300 },
    { method: 'analyze_code', params: { code: 'function test() {}' }, expectedTime: 1000 }
  ];
  
  for (const op of operations) {
    const start = Date.now();
    const response = await fetch('http://localhost:4000/mcp/v1/message', {
      method: 'POST',
      body: JSON.stringify(op)
    });
    const duration = Date.now() - start;
    
    assert(response.ok);
    assert(duration < op.expectedTime, `${op.method} too slow: ${duration}ms`);
  }
  
  console.log('✅ Test 6 Passed: MCP handles network latency');
}
```

**Success Criteria**:
- All operations complete
- No timeouts with 100ms latency
- Graceful degradation
- Error messages helpful

### Test 7: Session State Management
**Goal**: Validate Redis-backed session state

```typescript
// test-7-session-state.ts
import Redis from 'ioredis';

async function testSessionState() {
  const redis = new Redis({ host: 'localhost', port: 6379 });
  
  // User1 starts a conversation
  const session1 = await createSession('user1');
  await session1.execute({
    method: 'chat',
    params: { message: 'Remember that x = 42' }
  });
  
  // Simulate container restart
  await docker.restart('zenode-test');
  await waitForHealth('http://localhost:3000/health');
  
  // User1 continues conversation
  const response = await session1.execute({
    method: 'chat',
    params: { message: 'What is the value of x?' }
  });
  
  assert(response.result.includes('42'));
  
  // User2 has different state
  const session2 = await createSession('user2');
  const response2 = await session2.execute({
    method: 'chat',
    params: { message: 'What is the value of x?' }
  });
  
  assert(!response2.result.includes('42'));
  
  console.log('✅ Test 7 Passed: Session state persists correctly');
}
```

**Success Criteria**:
- State survives container restarts
- User sessions isolated
- Conversation history maintained
- Redis operations fast

### Test 8: Resource Limits
**Goal**: Enforce per-tenant resource quotas

```typescript
// test-8-resource-limits.ts
async function testResourceLimits() {
  // Configure tenant limits
  const limits = {
    cpu: '0.5',      // 0.5 vCPU
    memory: '512m',  // 512 MB
    storage: '1g',   // 1 GB S3 storage
    requests: 100    // 100 requests/minute
  };
  
  // Start container with limits
  await docker.run('zenode:latest', {
    name: 'zenode-limited',
    cpus: limits.cpu,
    memory: limits.memory
  });
  
  // Test CPU limit: Heavy computation
  const cpuStart = Date.now();
  await fetch('http://localhost:3000/mcp/v1/message', {
    method: 'POST',
    body: JSON.stringify({
      method: 'analyze_code',
      params: { code: generateLargeCode() }
    })
  });
  const cpuTime = Date.now() - cpuStart;
  
  // Should be slow due to CPU limit
  assert(cpuTime > 2000);
  
  // Test memory limit: Try to allocate too much
  const memResponse = await fetch('http://localhost:3000/mcp/v1/message', {
    method: 'POST',
    body: JSON.stringify({
      method: 'process_large_file',
      params: { size: '2GB' }
    })
  });
  
  assert(memResponse.status === 507); // Insufficient Storage
  
  // Test rate limit
  const requests = [];
  for (let i = 0; i < 150; i++) {
    requests.push(fetch('http://localhost:3000/mcp/v1/message', {
      method: 'POST',
      body: JSON.stringify({ method: 'ping' })
    }));
  }
  
  const results = await Promise.all(requests);
  const rateLimited = results.filter(r => r.status === 429).length;
  assert(rateLimited >= 50); // At least 50 requests rate limited
  
  console.log('✅ Test 8 Passed: Resource limits enforced');
}
```

**Success Criteria**:
- CPU limits enforced
- Memory limits enforced
- Storage quotas work
- Rate limiting works

### Test 9: Graceful Degradation
**Goal**: Test behavior under failure conditions

```typescript
// test-9-graceful-degradation.ts
async function testGracefulDegradation() {
  // Test 1: Redis unavailable
  await docker.stop('redis');
  
  const response1 = await fetch('http://localhost:3000/mcp/v1/message', {
    method: 'POST',
    body: JSON.stringify({ method: 'chat', params: { message: 'hello' } })
  });
  
  assert(response1.ok);
  assert(response1.body.result.includes('stateless mode'));
  
  // Test 2: S3 unavailable
  await s3Mock.simulateOutage();
  
  const response2 = await fetch('http://localhost:3000/mcp/v1/message', {
    method: 'POST',
    body: JSON.stringify({ method: 'read_file', params: { path: '/test.txt' } })
  });
  
  assert(response2.status === 503);
  assert(response2.body.error.includes('temporarily unavailable'));
  
  // Test 3: Partial service degradation
  await docker.start('redis');
  await s3Mock.simulateSlowness(2000); // 2s delay
  
  const response3 = await fetch('http://localhost:3000/mcp/v1/message', {
    method: 'POST',
    body: JSON.stringify({ method: 'analyze_code' }),
    timeout: 5000
  });
  
  assert(response3.ok);
  assert(response3.headers['x-degraded-mode'] === 'true');
  
  console.log('✅ Test 9 Passed: Graceful degradation works');
}
```

**Success Criteria**:
- Service stays up when dependencies fail
- Clear error messages
- Degraded mode indicators
- Auto-recovery when services return

### Test 10: End-to-End Remote MCP
**Goal**: Full integration test with Claude Desktop

```typescript
// test-10-e2e-remote.ts
async function testEndToEnd() {
  // Start full stack locally
  const stack = await startLocalStack({
    oauth: true,
    redis: true,
    s3: true,
    monitoring: true
  });
  
  // Configure Claude Desktop for remote MCP
  const config = {
    "mcpServers": {
      "zenode-remote": {
        "command": "mcp-remote",
        "args": ["http://localhost:3000"],
        "auth": {
          "type": "oauth2",
          "clientId": "test-client",
          "scope": "read write"
        }
      }
    }
  };
  
  // Save config and restart Claude
  await updateClaudeConfig(config);
  
  // Manual test steps
  console.log(`
  ✋ MANUAL TEST REQUIRED:
  
  1. Open Claude Desktop
  2. Verify OAuth prompt appears
  3. Complete authentication
  4. Test these commands:
     - zenode:chat "Hello from remote"
     - zenode:analyze --files ["./test.js"]
     - zenode:debug "Why is this failing?"
  5. Verify all responses work correctly
  
  Press ENTER when complete...
  `);
  
  await waitForEnter();
  
  // Verify logs show remote connections
  const logs = await getLogs(stack);
  assert(logs.includes('OAuth token validated'));
  assert(logs.includes('Remote MCP request processed'));
  
  console.log('✅ Test 10 Passed: End-to-end remote MCP works!');
}
```

**Success Criteria**:
- Claude connects via OAuth
- All tools work remotely
- Performance acceptable
- Multi-user works

## Local Development Setup

### 🐞 The Problem Solver's Environment:

```yaml
# docker-compose.local-remote.yml
version: '3.8'

services:
  zenode-remote:
    build: .
    environment:
      - MCP_TRANSPORT=http
      - OAUTH_ENABLED=true
      - REDIS_URL=redis://redis:6379
      - S3_ENDPOINT=http://localstack:4566
      - MULTI_TENANT=true
    ports:
      - "3000:3000"
    depends_on:
      - redis
      - localstack
      - oauth-mock

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  localstack:
    image: localstack/localstack
    environment:
      - SERVICES=s3
    ports:
      - "4566:4566"

  oauth-mock:
    build: ./oauth-mock
    ports:
      - "8080:8080"
```

## Success Metrics

### 📋 The Strategist's Checklist:

Before proceeding to AWS Fargate, we must achieve:

1. ✅ All 10 tests passing
2. ✅ Cold start < 5 seconds
3. ✅ Latency overhead < 200ms
4. ✅ Multi-user isolation proven
5. ✅ Resource limits enforced
6. ✅ OAuth flow working
7. ✅ S3 filesystem functional
8. ✅ Graceful degradation tested
9. ✅ Claude Desktop connects remotely
10. ✅ Load test: 10 concurrent users

## Risk Mitigation

### 🔍 The Detective's Concerns:

**High-Risk Areas**:
1. **File System Performance**: S3 latency might be too high
   - Mitigation: Local caching layer
   
2. **Cold Start Times**: Fargate cold starts are slow
   - Mitigation: Keep-warm strategy
   
3. **OAuth Complexity**: Many failure points
   - Mitigation: Comprehensive error handling
   
4. **Cost at Scale**: Multi-tenant might be expensive
   - Mitigation: Aggressive auto-scaling

## Implementation Timeline

Week 1: Tests 1-3 (Transport & Auth)
Week 2: Tests 4-6 (Storage & Performance)
Week 3: Tests 7-9 (State & Reliability)
Week 4: Test 10 & Production Prep

## Conclusion

This incremental approach minimizes risk by validating each assumption before full AWS deployment. The 10 tests provide concrete evidence that remote MCP is viable, with clear success criteria at each step.

**Next Step**: Begin with Test 1 - Basic HTTP Transport. Each subsequent test builds on the previous, creating a solid foundation for the AWS Fargate deployment.