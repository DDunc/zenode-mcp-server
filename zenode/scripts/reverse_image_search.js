const puppeteer = require('puppeteer');

async function searchTinEye(imageUrl) {
    console.log('Starting TinEye reverse image search...');
    
    const browser = await puppeteer.launch({ 
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    
    const page = await browser.newPage();
    
    // Set human-like user agent
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    try {
        // Navigate to TinEye
        await page.goto('https://tineye.com', { waitUntil: 'networkidle2' });
        
        // Wait for Cloudflare if needed
        console.log('Waiting 5 seconds for Cloudflare...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Find the URL input field and enter the image URL
        await page.waitForSelector('input[name="url"]', { timeout: 10000 });
        await page.type('input[name="url"]', imageUrl);
        
        // Click search button
        await page.click('input[type="submit"]');
        
        // Wait for results
        await new Promise(resolve => setTimeout(resolve, 5000));
        await page.waitForSelector('.match', { timeout: 15000 }).catch(() => {
            console.log('No matches found or selector not found');
        });
        
        // Extract results
        const results = await page.evaluate(() => {
            const matches = document.querySelectorAll('.match');
            return Array.from(matches).slice(0, 5).map(match => {
                const link = match.querySelector('a');
                const img = match.querySelector('img');
                return {
                    url: link ? link.href : null,
                    title: link ? link.textContent.trim() : 'No title',
                    thumbnail: img ? img.src : null
                };
            });
        });
        
        console.log('TinEye Results:', results);
        return results;
        
    } catch (error) {
        console.error('TinEye search error:', error);
        return [];
    } finally {
        await browser.close();
    }
}

async function searchGoogleImages(imageUrl) {
    console.log('Starting Google Images reverse search...');
    
    const browser = await puppeteer.launch({ 
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    
    const page = await browser.newPage();
    
    // Set human-like user agent
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    try {
        // Navigate to Google Images
        await page.goto('https://images.google.com', { waitUntil: 'networkidle2' });
        
        // Click the camera icon for reverse search
        await page.waitForSelector('[data-ved]', { timeout: 10000 });
        await page.click('[aria-label="Search by image"]');
        
        // Wait for the dialog and paste URL option
        await new Promise(resolve => setTimeout(resolve, 2000));
        await page.click('div[data-tab="3"]'); // Paste image URL tab
        
        // Enter the image URL
        await page.waitForSelector('input[type="url"]');
        await page.type('input[type="url"]', imageUrl);
        
        // Click search
        await page.click('input[type="submit"]');
        
        // Wait for results
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Extract results
        const results = await page.evaluate(() => {
            const results = [];
            
            // Look for "Pages that include matching images" section
            const links = document.querySelectorAll('h3 a');
            
            for (let i = 0; i < Math.min(5, links.length); i++) {
                const link = links[i];
                results.push({
                    url: link.href,
                    title: link.textContent.trim()
                });
            }
            
            return results;
        });
        
        console.log('Google Images Results:', results);
        return results;
        
    } catch (error) {
        console.error('Google Images search error:', error);
        return [];
    } finally {
        await browser.close();
    }
}

async function main() {
    const imageUrl = 'https://miro.medium.com/v2/resize:fit:720/format/webp/1*AkKIRQNiuy2q7at1nJynbA.jpeg';
    
    console.log('Performing reverse image search for:', imageUrl);
    
    // Try TinEye first
    const tineyeResults = await searchTinEye(imageUrl);
    
    // Then try Google Images
    const googleResults = await searchGoogleImages(imageUrl);
    
    const allResults = {
        tineye: tineyeResults,
        google: googleResults
    };
    
    console.log('\n=== FINAL RESULTS ===');
    console.log(JSON.stringify(allResults, null, 2));
    
    return allResults;
}

main().catch(console.error);