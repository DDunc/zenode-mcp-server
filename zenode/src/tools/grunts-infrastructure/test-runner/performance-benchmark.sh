#!/bin/bash
# Performance Benchmark Script - Load testing, memory monitoring, response times

set -e

WORKER_ID=$1
PORT=$((3031 + WORKER_ID))
RESULTS_PATH="/tmp/grunt-${WORKER_ID}/test-results"

if [ -z "$WORKER_ID" ]; then
    echo "❌ Usage: $0 <worker_id>"
    exit 1
fi

mkdir -p "$RESULTS_PATH"

echo "🚀 Running performance benchmarks for worker $WORKER_ID on port $PORT"
echo "📊 Results will be saved to: $RESULTS_PATH"

# Function to check if server is running
check_server() {
    curl -s -o /dev/null -w "%{http_code}" "http://localhost:$PORT/health" 2>/dev/null || echo "000"
}

# Wait for server to be available
echo "⏳ Waiting for server on port $PORT..."
WAIT_COUNT=0
while [ $WAIT_COUNT -lt 30 ]; do
    if [ "$(check_server)" = "200" ]; then
        echo "✅ Server is ready on port $PORT"
        break
    fi
    echo "   Attempt $((WAIT_COUNT + 1))/30 - Server not ready, waiting..."
    sleep 2
    WAIT_COUNT=$((WAIT_COUNT + 1))
done

if [ $WAIT_COUNT -ge 30 ]; then
    echo "❌ Server not available on port $PORT after 60 seconds"
    echo '{"error": "Server not available", "performanceScore": 0}' > "$RESULTS_PATH/performance-score.json"
    exit 1
fi

# 1. Load testing with Artillery (if available) or curl-based alternative
echo "📈 Load testing..."
if command -v artillery >/dev/null 2>&1; then
    echo "Using Artillery for load testing..."
    
    cat > "$RESULTS_PATH/artillery-config.yaml" << EOF
config:
  target: "http://localhost:$PORT"
  phases:
    - duration: 60
      arrivalRate: 10
  processor: "./artillery-processor.js"

scenarios:
  - name: "API Load Test"
    weight: 50
    flow:
      - get:
          url: "/"
      - get:
          url: "/health"
      - post:
          url: "/api/data"
          json:
            test: "load-test-data"
            timestamp: "{{ \$timestamp }}"

  - name: "Static Assets"
    weight: 30
    flow:
      - get:
          url: "/static/js/main.js"
      - get:
          url: "/static/css/main.css"
          capture:
            - header: "content-type"
              as: "contentType"

  - name: "Heavy Operations"
    weight: 20
    flow:
      - post:
          url: "/api/heavy-computation"
          json:
            iterations: 1000
EOF

    # Create Artillery processor
    cat > "$RESULTS_PATH/artillery-processor.js" << 'EOF'
module.exports = {
  generateTimestamp: function() {
    return Date.now();
  }
};
EOF

    cd "$RESULTS_PATH"
    npx artillery run artillery-config.yaml --output artillery-report.json > artillery.log 2>&1 || true
    cd - >/dev/null
else
    echo "Using curl for load testing..."
    
    # Simple curl-based load test
    cat > "$RESULTS_PATH/curl-load-test.sh" << 'EOF'
#!/bin/bash
PORT=$1
RESULTS_PATH=$2
TOTAL_REQUESTS=0
SUCCESSFUL_REQUESTS=0
TOTAL_TIME=0

endpoints=("/" "/health" "/api/data")

for i in {1..100}; do
    for endpoint in "${endpoints[@]}"; do
        TOTAL_REQUESTS=$((TOTAL_REQUESTS + 1))
        start_time=$(date +%s%N)
        
        if [ "$endpoint" = "/api/data" ]; then
            response_code=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
                -H "Content-Type: application/json" \
                -d '{"test": "load-test"}' \
                "http://localhost:$PORT$endpoint" 2>/dev/null || echo "000")
        else
            response_code=$(curl -s -o /dev/null -w "%{http_code}" \
                "http://localhost:$PORT$endpoint" 2>/dev/null || echo "000")
        fi
        
        end_time=$(date +%s%N)
        request_time=$(( (end_time - start_time) / 1000000 ))
        TOTAL_TIME=$((TOTAL_TIME + request_time))
        
        if [ "$response_code" = "200" ] || [ "$response_code" = "201" ]; then
            SUCCESSFUL_REQUESTS=$((SUCCESSFUL_REQUESTS + 1))
        fi
        
        # Small delay to avoid overwhelming the server
        sleep 0.1
    done
done

# Calculate statistics
if [ $TOTAL_REQUESTS -gt 0 ]; then
    SUCCESS_RATE=$(echo "scale=2; ($SUCCESSFUL_REQUESTS * 100) / $TOTAL_REQUESTS" | bc 2>/dev/null || echo 0)
    AVG_RESPONSE_TIME=$(echo "scale=2; $TOTAL_TIME / $TOTAL_REQUESTS" | bc 2>/dev/null || echo 0)
else
    SUCCESS_RATE=0
    AVG_RESPONSE_TIME=0
fi

cat > "$RESULTS_PATH/load-test-results.json" << EOF_JSON
{
  "totalRequests": $TOTAL_REQUESTS,
  "successfulRequests": $SUCCESSFUL_REQUESTS,
  "successRate": $SUCCESS_RATE,
  "averageResponseTime": $AVG_RESPONSE_TIME,
  "totalTime": $TOTAL_TIME
}
EOF_JSON

echo "Load test completed: $SUCCESSFUL_REQUESTS/$TOTAL_REQUESTS requests successful ($SUCCESS_RATE%)"
echo "Average response time: ${AVG_RESPONSE_TIME}ms"
EOF

    chmod +x "$RESULTS_PATH/curl-load-test.sh"
    bash "$RESULTS_PATH/curl-load-test.sh" $PORT "$RESULTS_PATH"
fi

# 2. Memory usage monitoring
echo "💾 Monitoring memory usage..."
NODE_PID=$(pgrep -f "node.*$PORT" | head -1 || echo "")

if [ -n "$NODE_PID" ]; then
    echo "Found Node.js process: $NODE_PID"
    
    # Monitor for 60 seconds
    echo "timestamp,pid,cpu,memory_rss,memory_vsz" > "$RESULTS_PATH/memory-usage.csv"
    
    for i in {1..60}; do
        if ps -p $NODE_PID > /dev/null 2>&1; then
            ps -p $NODE_PID -o pid,pcpu,rss,vsz --no-headers | while read pid cpu rss vsz; do
                echo "$(date +%s),$pid,$cpu,$rss,$vsz" >> "$RESULTS_PATH/memory-usage.csv"
            done
        else
            echo "Process $NODE_PID no longer running"
            break
        fi
        sleep 1
    done
    
    # Calculate memory statistics
    if [ -f "$RESULTS_PATH/memory-usage.csv" ]; then
        # Skip header line and calculate averages
        tail -n +2 "$RESULTS_PATH/memory-usage.csv" | awk -F',' '
        {
            sum_cpu += $3
            sum_rss += $4
            sum_vsz += $5
            count++
            if ($4 > max_rss) max_rss = $4
            if ($5 > max_vsz) max_vsz = $5
        }
        END {
            if (count > 0) {
                printf "avg_cpu=%.2f\navg_memory_rss=%.0f\navg_memory_vsz=%.0f\nmax_memory_rss=%.0f\nmax_memory_vsz=%.0f\nsamples=%d\n", 
                       sum_cpu/count, sum_rss/count, sum_vsz/count, max_rss, max_vsz, count
            }
        }' > "$RESULTS_PATH/memory-stats.txt"
        
        AVG_MEMORY_KB=$(grep "avg_memory_rss" "$RESULTS_PATH/memory-stats.txt" | cut -d'=' -f2 || echo "0")
        MAX_MEMORY_KB=$(grep "max_memory_rss" "$RESULTS_PATH/memory-stats.txt" | cut -d'=' -f2 || echo "0")
        
        echo "Average Memory: ${AVG_MEMORY_KB}KB, Peak Memory: ${MAX_MEMORY_KB}KB"
    fi
else
    echo "⚠️  Could not find Node.js process for monitoring"
    echo "avg_memory_rss=0" > "$RESULTS_PATH/memory-stats.txt"
    echo "max_memory_rss=0" >> "$RESULTS_PATH/memory-stats.txt"
fi

# 3. Response time testing
echo "⏱️  Testing response times..."
cat > "$RESULTS_PATH/response-time-test.js" << EOF
const http = require('http');

const testEndpoints = [
  { path: '/', method: 'GET' },
  { path: '/health', method: 'GET' },
  { path: '/api/data', method: 'POST', data: '{"test": "response-time"}' },
  { path: '/api/users', method: 'GET' },
  { path: '/static/js/main.js', method: 'GET' }
];

const results = [];

async function testEndpoint(endpoint) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const options = {
      hostname: 'localhost',
      port: $PORT,
      path: endpoint.path,
      method: endpoint.method,
      headers: endpoint.method === 'POST' ? {'Content-Type': 'application/json'} : {},
      timeout: 10000
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        const responseTime = Date.now() - startTime;
        resolve({
          endpoint: endpoint.path,
          method: endpoint.method,
          statusCode: res.statusCode,
          responseTime: responseTime,
          success: res.statusCode >= 200 && res.statusCode < 400
        });
      });
    });

    req.on('error', (error) => {
      resolve({
        endpoint: endpoint.path,
        method: endpoint.method,
        statusCode: 0,
        responseTime: Date.now() - startTime,
        success: false,
        error: error.message
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        endpoint: endpoint.path,
        method: endpoint.method,
        statusCode: 0,
        responseTime: Date.now() - startTime,
        success: false,
        error: 'Timeout'
      });
    });

    if (endpoint.data) {
      req.write(endpoint.data);
    }
    req.end();
  });
}

async function runTests() {
  console.log('Starting response time tests...');
  
  for (const endpoint of testEndpoints) {
    const iterations = 5;
    const times = [];
    let successCount = 0;
    
    for (let i = 0; i < iterations; i++) {
      const result = await testEndpoint(endpoint);
      if (result.success) {
        times.push(result.responseTime);
        successCount++;
      }
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    if (times.length > 0) {
      const avg = times.reduce((a, b) => a + b, 0) / times.length;
      const min = Math.min(...times);
      const max = Math.max(...times);
      const median = times.sort((a, b) => a - b)[Math.floor(times.length / 2)];
      
      results.push({
        endpoint: endpoint.path,
        method: endpoint.method,
        avgResponseTime: Math.round(avg),
        minResponseTime: min,
        maxResponseTime: max,
        medianResponseTime: median,
        successRate: (successCount / iterations) * 100,
        samples: times.length
      });
    } else {
      results.push({
        endpoint: endpoint.path,
        method: endpoint.method,
        avgResponseTime: -1,
        minResponseTime: -1,
        maxResponseTime: -1,
        medianResponseTime: -1,
        successRate: 0,
        samples: 0,
        error: 'All requests failed'
      });
    }
  }
  
  console.log(JSON.stringify(results, null, 2));
}

runTests().catch(console.error);
EOF

if command -v node >/dev/null 2>&1; then
    node "$RESULTS_PATH/response-time-test.js" > "$RESULTS_PATH/response-times.json" 2>&1
else
    echo '[]' > "$RESULTS_PATH/response-times.json"
    echo "⚠️  Node.js not available for response time testing"
fi

# 4. Generate performance score
echo "📊 Calculating performance score..."
cat > "$RESULTS_PATH/calculate-score.js" << 'EOF'
const fs = require('fs');

try {
  let performanceScore = 100;
  const metrics = {
    responseTime: 0,
    errorRate: 0,
    memoryUsage: 0,
    throughput: 0
  };

  // Load Artillery results if available
  try {
    const artilleryData = JSON.parse(fs.readFileSync('./artillery-report.json', 'utf8'));
    const p95ResponseTime = artilleryData.aggregate?.p95 || 1000;
    const errorRate = (artilleryData.aggregate?.errors || 0) / (artilleryData.aggregate?.requestsCompleted || 1);
    
    metrics.responseTime = p95ResponseTime;
    metrics.errorRate = errorRate * 100;
    
    // Deduct points for high response times (target: <200ms)
    if (p95ResponseTime > 200) {
      performanceScore -= Math.min(30, (p95ResponseTime - 200) / 10);
    }
    
    // Deduct points for errors (target: <1%)
    if (errorRate > 0.01) {
      performanceScore -= Math.min(25, errorRate * 1000);
    }
  } catch (e) {
    // Try load test results
    try {
      const loadTestData = JSON.parse(fs.readFileSync('./load-test-results.json', 'utf8'));
      const errorRate = 100 - loadTestData.successRate;
      const avgResponseTime = loadTestData.averageResponseTime;
      
      metrics.responseTime = avgResponseTime;
      metrics.errorRate = errorRate;
      
      if (avgResponseTime > 200) {
        performanceScore -= Math.min(25, (avgResponseTime - 200) / 20);
      }
      
      if (errorRate > 1) {
        performanceScore -= Math.min(20, errorRate);
      }
    } catch (e2) {
      console.warn('No load test data available');
      performanceScore -= 20; // Penalty for missing load test data
    }
  }

  // Response time analysis
  try {
    const responseData = JSON.parse(fs.readFileSync('./response-times.json', 'utf8'));
    responseData.forEach(endpoint => {
      if (endpoint.avgResponseTime > 0) {
        if (endpoint.avgResponseTime > 500) {
          performanceScore -= Math.min(10, (endpoint.avgResponseTime - 500) / 100);
        }
        if (endpoint.successRate < 90) {
          performanceScore -= Math.min(10, (90 - endpoint.successRate) / 10);
        }
      }
    });
  } catch (e) {
    console.warn('No response time data available');
    performanceScore -= 10;
  }

  // Memory usage analysis
  try {
    const memoryStatsFile = fs.readFileSync('./memory-stats.txt', 'utf8');
    const avgMemoryMatch = memoryStatsFile.match(/avg_memory_rss=([0-9.]+)/);
    const maxMemoryMatch = memoryStatsFile.match(/max_memory_rss=([0-9.]+)/);
    
    if (avgMemoryMatch && maxMemoryMatch) {
      const avgMemory = parseFloat(avgMemoryMatch[1]);
      const maxMemory = parseFloat(maxMemoryMatch[1]);
      
      metrics.memoryUsage = avgMemory / 1024; // Convert to MB
      
      // Deduct points for high memory usage (target: <100MB average)
      if (avgMemory > 100000) { // 100MB in KB
        performanceScore -= Math.min(15, (avgMemory - 100000) / 10000);
      }
      
      // Deduct points for memory spikes (target: <200MB peak)
      if (maxMemory > 200000) { // 200MB in KB
        performanceScore -= Math.min(10, (maxMemory - 200000) / 20000);
      }
    }
  } catch (e) {
    console.warn('No memory usage data available');
    performanceScore -= 5;
  }

  performanceScore = Math.max(0, Math.round(performanceScore));
  
  const result = {
    workerId: process.env.WORKER_ID || 'unknown',
    performanceScore,
    metrics,
    timestamp: new Date().toISOString(),
    details: {
      scoreBreakdown: {
        baseScore: 100,
        responseTimePenalty: 100 - performanceScore > 30 ? 30 : Math.max(0, 100 - performanceScore),
        errorRatePenalty: metrics.errorRate > 1 ? Math.min(25, metrics.errorRate) : 0,
        memoryPenalty: metrics.memoryUsage > 100 ? Math.min(15, (metrics.memoryUsage - 100) / 10) : 0
      }
    }
  };
  
  fs.writeFileSync('./performance-score.json', JSON.stringify(result, null, 2));
  console.log(`Performance Score: ${performanceScore}/100`);
  console.log(`Metrics: Response Time: ${metrics.responseTime}ms, Error Rate: ${metrics.errorRate}%, Memory: ${metrics.memoryUsage}MB`);
  
} catch (error) {
  console.error('Error calculating performance score:', error);
  const fallbackResult = {
    workerId: process.env.WORKER_ID || 'unknown',
    performanceScore: 0,
    metrics: { error: error.message },
    timestamp: new Date().toISOString()
  };
  fs.writeFileSync('./performance-score.json', JSON.stringify(fallbackResult, null, 2));
  process.exit(1);
}
EOF

cd "$RESULTS_PATH"
WORKER_ID=$WORKER_ID node calculate-score.js || echo "Score calculation failed"
cd - >/dev/null

echo ""
echo "✅ Performance benchmarking complete for worker $WORKER_ID"
echo "📊 Results available in: $RESULTS_PATH/"
echo "   - performance-score.json (final score)"
echo "   - response-times.json (endpoint performance)"
echo "   - memory-usage.csv (memory monitoring)"
if [ -f "$RESULTS_PATH/artillery-report.json" ]; then
    echo "   - artillery-report.json (load test results)"
elif [ -f "$RESULTS_PATH/load-test-results.json" ]; then
    echo "   - load-test-results.json (load test results)"
fi
echo ""

# Display final score if available
if [ -f "$RESULTS_PATH/performance-score.json" ]; then
    if command -v jq >/dev/null 2>&1; then
        FINAL_SCORE=$(jq -r '.performanceScore' "$RESULTS_PATH/performance-score.json" 2>/dev/null || echo "N/A")
        echo "🏆 Final Performance Score: $FINAL_SCORE/100"
    else
        echo "📄 Performance score saved to performance-score.json"
    fi
fi