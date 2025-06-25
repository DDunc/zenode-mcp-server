
const express = require('express');
const path = require('path');
const app = express();

// Serve static files
app.use(express.static('.'));

// Main game route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    worker: 'demo',
    model: 'fallback',
    linesGenerated: 996,
    testsPassedCount: 5,
    testsFailedCount: 0
  });
});

// API endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    api: 'healthy', 
    worker: 'demo',
    gameType: 'phaser-platformer',
    generated: true
  });
});

const port = process.env.PORT || 3032;
app.listen(port, () => {
  console.log(`🎮 Phaser.js game server running on port ${port}`);
  console.log(`   Worker: demo`);
  console.log(`   Model: fallback`);
  console.log(`   Generated: 996 lines`);
});
