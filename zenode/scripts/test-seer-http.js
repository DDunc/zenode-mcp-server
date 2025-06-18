#!/usr/bin/env node

const testCommand = `docker exec zenode-server node -e "
  const { seerTool } = require('./dist/tools/seer.js');
  const testRequest = {
    prompt: 'What is in this image? Analyze this landscape photo in detail.',
    images: ['https://upload.wikimedia.org/wikipedia/commons/thumb/d/dd/Gfp-wisconsin-madison-the-nature-boardwalk.jpg/2560px-Gfp-wisconsin-madison-the-nature-boardwalk.jpg'],
    analysis_type: 'detailed',
    model: 'meta-llama/llama-3.2-11b-vision-instruct'
  };
  
  console.log('Testing seer tool with HTTP URL and Llama vision model...');
  console.log('Request:', JSON.stringify(testRequest, null, 2));
  
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
  console.log('🔮 Seer HTTP Test Results:');
  if (stdout) console.log(stdout);
  if (stderr) console.log('STDERR:', stderr);
  if (error) console.log('ERROR:', error.message);
});