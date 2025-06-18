// SerpApi Reverse Image Search Implementation
// Free tier: 100 searches per month

const https = require('https');
const fs = require('fs');

async function searchWithSerpApi(imageUrl, apiKey) {
    const params = new URLSearchParams({
        engine: 'yandex_images',
        url: imageUrl,
        api_key: apiKey,
        tab: 'about' // Focus on pages containing the image
    });
    
    const apiUrl = `https://serpapi.com/search.json?${params.toString()}`;
    console.log('API Request URL:', apiUrl.replace(apiKey, 'API_KEY_HIDDEN'));
    
    return new Promise((resolve, reject) => {
        https.get(apiUrl, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    
                    if (result.error) {
                        reject(new Error(`SerpApi Error: ${result.error}`));
                        return;
                    }
                    
                    resolve(result);
                } catch (error) {
                    reject(new Error('Failed to parse API response: ' + error.message));
                }
            });
        }).on('error', (error) => {
            reject(error);
        });
    });
}

function extractWebsiteResults(apiResult) {
    const websites = [];
    
    // Extract from various result sections
    if (apiResult.image_results) {
        apiResult.image_results.forEach((result, index) => {
            if (result.original && result.original.includes('http')) {
                websites.push({
                    url: result.original,
                    title: result.title || `Image Result ${index + 1}`,
                    source: result.source || 'Unknown',
                    type: 'image_source'
                });
            }
        });
    }
    
    // Look for "sites" or "pages" containing the image
    if (apiResult.sites) {
        apiResult.sites.forEach((site, index) => {
            websites.push({
                url: site.link,
                title: site.title || `Site ${index + 1}`,
                snippet: site.snippet || '',
                type: 'containing_site'
            });
        });
    }
    
    // Look for similar images from different sites
    if (apiResult.similar_images) {
        apiResult.similar_images.slice(0, 5).forEach((img, index) => {
            if (img.source_url) {
                websites.push({
                    url: img.source_url,
                    title: img.title || `Similar Image ${index + 1}`,
                    source: img.source || 'Unknown',
                    type: 'similar_image'
                });
            }
        });
    }
    
    return websites;
}

async function main() {
    const imageUrl = 'https://miro.medium.com/v2/resize:fit:720/format/webp/1*AkKIRQNiuy2q7at1nJynbA.jpeg';
    
    // Check if API key is provided via environment variable
    const apiKey = process.env.SERPAPI_KEY;
    
    if (!apiKey) {
        console.log('🔑 SerpApi Setup Required');
        console.log('=========================');
        console.log('');
        console.log('To use SerpApi reverse image search:');
        console.log('1. Visit: https://serpapi.com/users/sign_up');
        console.log('2. Sign up with GitHub or Google (free tier: 100 searches/month)');
        console.log('3. Get your API key from the dashboard');
        console.log('4. Run: export SERPAPI_KEY="your_api_key_here"');
        console.log('5. Then run this script again');
        console.log('');
        console.log('Example API call URL (with your key):');
        console.log(`https://serpapi.com/search.json?engine=yandex_images&url=${encodeURIComponent(imageUrl)}&api_key=YOUR_KEY&tab=about`);
        return;
    }
    
    try {
        console.log('🔍 Performing reverse image search via SerpApi...');
        console.log('Image URL:', imageUrl);
        console.log('');
        
        const apiResult = await searchWithSerpApi(imageUrl, apiKey);
        
        // Save full API response for analysis
        fs.writeFileSync('./serpapi_full_response.json', JSON.stringify(apiResult, null, 2));
        console.log('📄 Full API response saved to: serpapi_full_response.json');
        
        // Extract website results
        const websites = extractWebsiteResults(apiResult);
        
        console.log('');
        console.log('🌐 WEBSITES CONTAINING OR USING THIS IMAGE:');
        console.log('===========================================');
        
        if (websites.length === 0) {
            console.log('❌ No websites found containing this specific image.');
            console.log('');
            console.log('This could mean:');
            console.log('- The image is unique/original to Medium');
            console.log('- The image is new and not widely distributed');
            console.log('- The search didn\'t find matches yet');
        } else {
            websites.forEach((site, index) => {
                console.log(`\n${index + 1}. ${site.title}`);
                console.log(`   Type: ${site.type}`);
                console.log(`   URL: ${site.url}`);
                if (site.snippet) {
                    console.log(`   Context: ${site.snippet}`);
                }
                if (site.source) {
                    console.log(`   Source: ${site.source}`);
                }
            });
        }
        
        // Basic search statistics
        if (apiResult.search_information) {
            console.log('\n📊 Search Statistics:');
            console.log(`Total time: ${apiResult.search_information.time_taken_displayed || 'N/A'}`);
            console.log(`Engine: ${apiResult.search_information.engine_results_state || 'N/A'}`);
        }
        
        console.log('\n✅ Reverse image search completed via SerpApi');
        return websites;
        
    } catch (error) {
        console.error('❌ Search failed:', error.message);
        
        if (error.message.includes('API key')) {
            console.log('\n💡 Tip: Make sure your API key is valid and has available searches.');
            console.log('Check your usage at: https://serpapi.com/dashboard');
        }
        
        return [];
    }
}

// Run if called directly
if (require.main === module) {
    main().catch(console.error);
}

module.exports = { searchWithSerpApi, extractWebsiteResults };