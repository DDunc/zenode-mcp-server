/**
 * Grunts Status Service - Real-time monitoring dashboard
 * Runs on port 3030 with WebSocket support for live updates
 */

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const Docker = require('dockerode');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const docker = new Docker();

const PORT = 3000; // Internal port (mapped to 3030 externally)
const WORKSPACE_PATH = '/workspace';
const UPDATE_INTERVAL = 2000; // 2 seconds

// Status storage
let gruntsStatus = {
  executionTime: 0,
  maxExecutionTime: 14400, // 4 hours
  startTime: Date.now(),
  containers: {},
  overallProgress: 0,
  taskDecomposition: null,
  logs: []
};

// WebSocket connections
const clients = new Set();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

/**
 * API Routes
 */

// Get current status
app.get('/api/status', (req, res) => {
  res.json(gruntsStatus);
});

// Get container logs
app.get('/api/logs/:containerId', async (req, res) => {
  try {
    const { containerId } = req.params;
    const container = docker.getContainer(containerId);
    
    const logs = await container.logs({
      stdout: true,
      stderr: true,
      tail: 100,
      timestamps: true
    });
    
    res.json({ logs: logs.toString() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * WebSocket handling
 */
wss.on('connection', (ws) => {
  console.log('New WebSocket connection established');
  clients.add(ws);
  
  // Send current status immediately
  ws.send(JSON.stringify({ type: 'status', data: gruntsStatus }));
  
  ws.on('close', () => {
    clients.delete(ws);
    console.log('WebSocket connection closed');
  });
  
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    clients.delete(ws);
  });
});

/**
 * Broadcast updates to all connected clients
 */
function broadcastUpdate(type, data) {
  const message = JSON.stringify({ type, data, timestamp: Date.now() });
  
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

/**
 * Update execution time
 */
function updateExecutionTime() {
  gruntsStatus.executionTime = Math.floor((Date.now() - gruntsStatus.startTime) / 1000);
}

/**
 * Monitor Docker containers
 */
async function monitorContainers() {
  try {
    const containers = await docker.listContainers({ all: true });
    const gruntsContainers = containers.filter(container => 
      container.Names.some(name => name.includes('grunt-'))
    );
    
    for (const containerInfo of gruntsContainers) {
      const containerId = containerInfo.Id;
      const containerName = containerInfo.Names[0].replace('/', '');
      const workerId = containerName.split('-').pop();
      
      if (!gruntsStatus.containers[workerId]) {
        gruntsStatus.containers[workerId] = {
          status: 'starting',
          linesAdded: 0,
          linesDeleted: 0,
          testsPassedCount: 0,
          testsFailedCount: 0,
          lastActivity: new Date(),
          partialAssessments: 0,
          currentPhase: 'analysis',
          model: 'unknown',
          specialization: 'unknown',
          containerId: containerId
        };
      }
      
      // Get worker info from health endpoint
      const workerPort = 3030 + parseInt(workerId); // 3031, 3032, etc.
      try {
        const response = await fetch(`http://host.docker.internal:${workerPort}/health`);
        if (response.ok) {
          const healthData = await response.json();
          if (healthData.worker) {
            gruntsStatus.containers[workerId].model = healthData.worker.model || 'unknown';
            gruntsStatus.containers[workerId].specialization = healthData.worker.specialization || 'unknown';
            gruntsStatus.containers[workerId].currentPhase = healthData.worker.currentPhase || 'analysis';
            gruntsStatus.containers[workerId].linesAdded = healthData.worker.linesAdded || 0;
            gruntsStatus.containers[workerId].testsPassedCount = healthData.worker.testsPassedCount || 0;
            gruntsStatus.containers[workerId].testsFailedCount = healthData.worker.testsFailedCount || 0;
          }
        }
      } catch (error) {
        console.debug(`Could not fetch health from worker ${workerId}:`, error.message);
      }
      
      // Update container status based on Docker state
      const container = docker.getContainer(containerId);
      const containerData = await container.inspect();
      
      gruntsStatus.containers[workerId].status = containerData.State.Running ? 'running' : 
                                                containerData.State.ExitCode === 0 ? 'completed' : 'failed';
      
      // Update last activity timestamp only for running containers
      if (gruntsStatus.containers[workerId].status === 'running') {
        gruntsStatus.containers[workerId].lastActivity = new Date();
      }
      
      // CRITICAL: Override any residual mock data with real worker data
      console.log(`✅ Updated worker ${workerId}: ${gruntsStatus.containers[workerId].linesAdded} lines, ${gruntsStatus.containers[workerId].testsPassedCount} tests, model: ${gruntsStatus.containers[workerId].model}`);
    }
    
    // Calculate overall progress
    const totalContainers = Object.keys(gruntsStatus.containers).length;
    const completedContainers = Object.values(gruntsStatus.containers)
      .filter(c => c.status === 'completed').length;
    
    gruntsStatus.overallProgress = totalContainers > 0 ? 
      Math.round((completedContainers / totalContainers) * 100) : 0;
    
  } catch (error) {
    console.error('Error monitoring containers:', error);
  }
}

/**
 * Main monitoring loop
 */
async function startMonitoring() {
  console.log('Starting Grunts status monitoring...');
  
  setInterval(async () => {
    updateExecutionTime();
    await monitorContainers();
    broadcastUpdate('status', gruntsStatus);
  }, UPDATE_INTERVAL);
}

/**
 * Serve the dashboard HTML
 */
app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>🤖 Grunts Status Dashboard</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: 'SF Mono', 'Monaco', 'Cascadia Code', monospace; 
            background: #0d1117; 
            color: #c9d1d9; 
            line-height: 1.6; 
        }
        .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
        .header { text-align: center; margin-bottom: 30px; }
        .header h1 { color: #58a6ff; font-size: 2rem; margin-bottom: 10px; }
        .status-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
        .status-card { 
            background: #161b22; 
            border: 1px solid #30363d; 
            border-radius: 8px; 
            padding: 20px; 
        }
        .status-card h3 { color: #f0f6fc; margin-bottom: 15px; }
        .progress-bar { 
            width: 100%; 
            height: 20px; 
            background: #21262d; 
            border-radius: 10px; 
            overflow: hidden; 
        }
        .progress-fill { 
            height: 100%; 
            background: linear-gradient(90deg, #238636, #2ea043); 
            transition: width 0.3s ease; 
        }
        .container-status { margin: 10px 0; padding: 15px; background: #0d1117; border-radius: 6px; }
        .status-running { border-left: 4px solid #2ea043; }
        .status-completed { border-left: 4px solid #1f883d; }
        .status-failed { border-left: 4px solid #da3633; }
        .status-starting { border-left: 4px solid #d29922; }
        .metric { display: flex; justify-content: space-between; margin: 5px 0; }
        .metric-value { color: #58a6ff; font-weight: bold; }
        .time-display { font-size: 1.5rem; color: #f85149; }
        .connected { color: #2ea043; }
        .disconnected { color: #f85149; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🤖 Grunts Distributed LLM Dashboard</h1>
            <p>Real-time monitoring for competitive web development</p>
            <p>Connection: <span id="connectionStatus" class="disconnected">Disconnected</span></p>
        </div>
        
        <div class="status-grid">
            <div class="status-card">
                <h3>⏱️ Execution Status</h3>
                <div class="metric">
                    <span>Runtime:</span>
                    <span id="executionTime" class="time-display">00:00:00</span>
                </div>
                <div class="metric">
                    <span>Max Time:</span>
                    <span>04:00:00</span>
                </div>
                <div class="metric">
                    <span>Progress:</span>
                    <span id="overallProgress" class="metric-value">0%</span>
                </div>
                <div class="progress-bar">
                    <div id="progressFill" class="progress-fill" style="width: 0%"></div>
                </div>
            </div>
            
            <div class="status-card">
                <h3>📊 Container Overview</h3>
                <div id="containerStats">
                    <p>No containers running</p>
                </div>
            </div>
        </div>
        
        <div style="margin-top: 30px;">
            <h2>🖥️ LLM Containers</h2>
            <div id="containers"></div>
        </div>
    </div>

    <script>
        let ws;
        let reconnectInterval;
        
        function connect() {
            ws = new WebSocket('ws://localhost:3030');
            
            ws.onopen = () => {
                document.getElementById('connectionStatus').textContent = 'Connected';
                document.getElementById('connectionStatus').className = 'connected';
                clearInterval(reconnectInterval);
            };
            
            ws.onmessage = (event) => {
                const message = JSON.parse(event.data);
                if (message.type === 'status') {
                    updateDashboard(message.data);
                }
            };
            
            ws.onclose = () => {
                document.getElementById('connectionStatus').textContent = 'Disconnected';
                document.getElementById('connectionStatus').className = 'disconnected';
                reconnectInterval = setInterval(connect, 5000);
            };
            
            ws.onerror = (error) => {
                console.error('WebSocket error:', error);
            };
        }
        
        function updateDashboard(status) {
            // Update execution time
            const hours = Math.floor(status.executionTime / 3600);
            const minutes = Math.floor((status.executionTime % 3600) / 60);
            const seconds = status.executionTime % 60;
            document.getElementById('executionTime').textContent = 
                hours.toString().padStart(2, '0') + ':' + 
                minutes.toString().padStart(2, '0') + ':' + 
                seconds.toString().padStart(2, '0');
            
            // Update progress
            document.getElementById('overallProgress').textContent = status.overallProgress + '%';
            document.getElementById('progressFill').style.width = status.overallProgress + '%';
            
            // Update container stats
            const containerCount = Object.keys(status.containers).length;
            const runningCount = Object.values(status.containers).filter(c => c.status === 'running').length;
            const completedCount = Object.values(status.containers).filter(c => c.status === 'completed').length;
            
            document.getElementById('containerStats').innerHTML = 
                '<div class="metric"><span>Total:</span><span class="metric-value">' + containerCount + '</span></div>' +
                '<div class="metric"><span>Running:</span><span class="metric-value">' + runningCount + '</span></div>' +
                '<div class="metric"><span>Completed:</span><span class="metric-value">' + completedCount + '</span></div>';
            
            // Update containers
            const containersDiv = document.getElementById('containers');
            containersDiv.innerHTML = '';
            
            Object.entries(status.containers).forEach(([workerId, container]) => {
                const containerDiv = document.createElement('div');
                containerDiv.className = 'container-status status-' + container.status;
                containerDiv.innerHTML = 
                    '<h4>' + container.model + ' (' + workerId + ')</h4>' +
                    '<p><strong>Specialization:</strong> ' + container.specialization + '</p>' +
                    '<p><strong>Phase:</strong> ' + container.currentPhase + '</p>' +
                    '<div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin: 10px 0;">' +
                        '<div class="metric"><span>Lines Added:</span><span class="metric-value">' + container.linesAdded + '</span></div>' +
                        '<div class="metric"><span>Lines Deleted:</span><span class="metric-value">' + container.linesDeleted + '</span></div>' +
                        '<div class="metric"><span>Tests Passed:</span><span class="metric-value">' + container.testsPassedCount + '</span></div>' +
                        '<div class="metric"><span>Tests Failed:</span><span class="metric-value">' + container.testsFailedCount + '</span></div>' +
                    '</div>' +
                    '<div class="metric"><span>Assessments:</span><span class="metric-value">' + container.partialAssessments + '</span></div>' +
                    '<div class="metric"><span>Last Activity:</span><span class="metric-value">' + new Date(container.lastActivity).toLocaleTimeString() + '</span></div>';
                containersDiv.appendChild(containerDiv);
            });
        }
        
        // Initialize connection
        connect();
    </script>
</body>
</html>`);
});

// Start the server
server.listen(3030, () => {
  console.log('🚀 Grunts Status Service running on port 3030');
  console.log('📊 Dashboard: http://localhost:3030');
  startMonitoring();
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Shutting down Grunts Status Service...');
  server.close(() => {
    process.exit(0);
  });
});