#!/usr/bin/env node

const testCommand = `docker exec zenode-server node -e "
  const { seerTool } = require('./dist/tools/seer.js');
  const testRequest = {
    prompt: 'What is in this image? Analyze this landscape photo in detail.',
    images: ['https://upload.wikimedia.org/wikipedia/commons/thumb/d/dd/Gfp-wisconsin-madison-the-nature-boardwalk.jpg/2560px-Gfp-wisconsin-madison-the-nature-boardwalk.jpg'],
    analysis_type: 'detailed',
    model: 'openai/gpt-4o'
  };
  
  console.log('Testing seer tool with HTTP URL and GPT-4o...');
  
  seerTool.execute(testRequest)
    .then(result => {
      console.log('✅ Seer SUCCESS!');
      console.log('Status:', result.status);
      console.log('Content preview:', result.content.substring(0, 500) + '...');
      if (result.metadata) {
        console.log('Model used:', result.metadata.model_used);
        console.log('Vision model:', result.metadata.vision_model);
      }
    })
    .catch(error => {
      console.log('❌ Seer ERROR:', error.message);
    });
"`;

const { exec } = require('child_process');

exec(testCommand, { timeout: 60000 }, (error, stdout, stderr) => {
  console.log('🔮 Seer GPT-4o Test Results:');
  if (stdout) console.log(stdout);
  if (stderr && stderr.length < 500) console.log('STDERR:', stderr);
  if (error) console.log('ERROR:', error.message);
});