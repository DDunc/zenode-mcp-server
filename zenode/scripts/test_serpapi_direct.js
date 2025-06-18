#!/usr/bin/env node

// Direct test of SerpAPI reverse image search
const https = require('https');

const imageUrl = 'https://miro.medium.com/v2/resize:fit:720/format/webp/1*AkKIRQNiuy2q7at1nJynbA.jpeg';
const serpApiKey = process.env.SERPAPI_KEY || 'your_serpapi_key_here';

async function testSerpApiReverseImageSearch() {
  console.log('🔍 Testing SerpAPI reverse image search directly...\n');
  console.log('Image URL:', imageUrl);
  console.log('');

  const params = new URLSearchParams({
    engine: 'google_reverse_image',
    image_url: imageUrl,
    api_key: serpApiKey
  });

  const apiUrl = `https://serpapi.com/search.json?${params.toString()}`;
  
  console.log('API Request URL:');
  console.log(apiUrl.replace(serpApiKey, 'API_KEY_HIDDEN'));
  console.log('');

  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    https.get(apiUrl, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        const endTime = Date.now();
        console.log(`Request completed in ${endTime - startTime}ms\n`);
        
        try {
          const result = JSON.parse(data);
          
          if (result.error) {
            console.error('❌ SerpAPI Error:', result.error);
            reject(new Error(`SerpAPI Error: ${result.error}`));
            return;
          }
          
          console.log('✅ SerpAPI Response received!\n');
          
          // Display basic info
          if (result.search_information) {
            console.log('🔍 Search Information:');
            console.log('- Total results:', result.search_information.total_results || 'Unknown');
            console.log('- Search time:', result.search_information.time_taken_displayed || 'Unknown');
            console.log('');
          }
          
          // Display visual matches
          if (result.image_results && result.image_results.length > 0) {
            console.log(`🖼️ Visual Matches Found: ${result.image_results.length}`);
            console.log('');
            
            result.image_results.slice(0, 5).forEach((match, index) => {
              console.log(`${index + 1}. ${match.title || 'Untitled'}`);
              console.log(`   Source: ${match.source || 'Unknown'}`);
              if (match.link) console.log(`   URL: ${match.link}`);
              console.log('');
            });
          }
          
          // Display pages containing the image
          if (result.inline_images && result.inline_images.length > 0) {
            console.log(`📄 Pages Containing Image: ${result.inline_images.length}`);
            console.log('');
            
            result.inline_images.slice(0, 3).forEach((page, index) => {
              console.log(`${index + 1}. ${page.title || 'Untitled Page'}`);
              if (page.link) console.log(`   URL: ${page.link}`);
              if (page.snippet) console.log(`   Context: ${page.snippet}`);
              console.log('');
            });
          }
          
          // Check if no results
          if (!result.image_results && !result.inline_images) {
            console.log('❌ No matches found for this image');
            console.log('This could mean:');
            console.log('- The image is original/unique');
            console.log('- The image is new and not yet indexed');
            console.log('- The image has been modified from its original');
          }
          
          // Save full results
          const fs = require('fs');
          fs.writeFileSync('./serpapi_results.json', JSON.stringify(result, null, 2));
          console.log('\n💾 Full results saved to serpapi_results.json');
          
          resolve(result);
          
        } catch (error) {
          console.error('❌ Failed to parse SerpAPI response:', error.message);
          console.log('Raw response:', data.substring(0, 500) + '...');
          reject(error);
        }
      });
    }).on('error', (error) => {
      console.error('❌ Network error:', error.message);
      reject(error);
    });
  });
}

// Run the test
testSerpApiReverseImageSearch()
  .then(() => {
    console.log('\n✅ Test completed successfully!');
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  });