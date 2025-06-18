// Yandex Reverse Image Search using SerpApi
// Free tier: 100 searches per month

const https = require('https');

async function searchYandexImages(imageUrl, apiKey) {
    const serpApiUrl = `https://serpapi.com/search.json?engine=yandex_images&url=${encodeURIComponent(imageUrl)}&api_key=${apiKey}`;
    
    return new Promise((resolve, reject) => {
        https.get(serpApiUrl, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    resolve(result);
                } catch (error) {
                    reject(new Error('Failed to parse response: ' + error.message));
                }
            });
        }).on('error', (error) => {
            reject(error);
        });
    });
}

async function main() {
    const imageUrl = 'https://miro.medium.com/v2/resize:fit:720/format/webp/1*AkKIRQNiuy2q7at1nJynbA.jpeg';
    
    // Note: You'll need to sign up for SerpApi and get your API key
    // For testing purposes, we'll show the URL that would be called
    console.log('To use this service, you need to:');
    console.log('1. Sign up at https://serpapi.com/');
    console.log('2. Get your free API key from the dashboard');
    console.log('3. Replace YOUR_API_KEY below with your actual key');
    console.log('');
    
    const testApiKey = 'YOUR_API_KEY'; // Replace with actual API key
    
    if (testApiKey === 'YOUR_API_KEY') {
        console.log('API URL that would be called:');
        console.log(`https://serpapi.com/search.json?engine=yandex_images&url=${encodeURIComponent(imageUrl)}&api_key=YOUR_API_KEY`);
        console.log('');
        console.log('Manual test: You can paste this URL in your browser (with real API key) to see results');
        return;
    }
    
    try {
        console.log('Searching for reverse image matches...');
        const result = await searchYandexImages(imageUrl, testApiKey);
        
        console.log('=== YANDEX REVERSE IMAGE SEARCH RESULTS ===');
        
        // Extract relevant information
        if (result.image_results) {
            console.log(`Found ${result.image_results.length} similar images:`);
            result.image_results.slice(0, 5).forEach((img, index) => {
                console.log(`${index + 1}. ${img.title || 'No title'}`);
                console.log(`   Source: ${img.source || 'Unknown'}`);
                console.log(`   Link: ${img.link || 'No link'}`);
                console.log('');
            });
        }
        
        // Look for pages that contain this image
        if (result.search_information) {
            console.log('Search Information:');
            console.log(`Total results: ${result.search_information.total_results || 'Unknown'}`);
        }
        
        // Save full results to file for analysis
        require('fs').writeFileSync('./yandex_results.json', JSON.stringify(result, null, 2));
        console.log('Full results saved to yandex_results.json');
        
    } catch (error) {
        console.error('Search failed:', error.message);
    }
}

main();