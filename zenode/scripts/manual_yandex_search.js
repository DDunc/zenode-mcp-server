const puppeteer = require('puppeteer');

async function manualYandexReverseSearch(imageUrl) {
    console.log('Attempting manual Yandex reverse image search...');
    
    const browser = await puppeteer.launch({ 
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    
    const page = await browser.newPage();
    
    // Set human-like user agent
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    try {
        // Go directly to Yandex Images reverse search URL
        const yandexUrl = `https://yandex.com/images/search?url=${encodeURIComponent(imageUrl)}&rpt=imageview`;
        console.log('Visiting:', yandexUrl);
        
        await page.goto(yandexUrl, { waitUntil: 'networkidle2', timeout: 30000 });
        
        // Wait for page to load
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Try to extract search results
        const results = await page.evaluate(() => {
            const results = [];
            
            // Look for various result containers
            const selectors = [
                '.serp-item',
                '.other-sites__item',
                '.sites__item',
                '[data-bem*="serp-item"]',
                '.serp-list__item'
            ];
            
            for (const selector of selectors) {
                const items = document.querySelectorAll(selector);
                console.log(`Found ${items.length} items with selector: ${selector}`);
                
                for (let i = 0; i < Math.min(10, items.length); i++) {
                    const item = items[i];
                    const link = item.querySelector('a');
                    const title = item.querySelector('.serp-item__title, .other-sites__title, .sites__title');
                    const snippet = item.querySelector('.serp-item__text, .other-sites__snippet');
                    
                    if (link) {
                        results.push({
                            url: link.href,
                            title: title ? title.textContent.trim() : 'No title',
                            snippet: snippet ? snippet.textContent.trim() : 'No snippet',
                            selector: selector
                        });
                    }
                }
            }
            
            // Also try to get page title and any other metadata
            const pageTitle = document.title;
            const searchInfo = document.querySelector('.serp-header__found');
            
            return {
                results: results,
                pageTitle: pageTitle,
                searchInfo: searchInfo ? searchInfo.textContent.trim() : null,
                totalSelectors: selectors.length,
                pageUrl: window.location.href
            };
        });
        
        console.log('Yandex Search Results:', JSON.stringify(results, null, 2));
        return results;
        
    } catch (error) {
        console.error('Yandex search error:', error.message);
        
        // Take a screenshot for debugging
        try {
            await page.screenshot({ path: 'yandex_debug.png', fullPage: true });
            console.log('Debug screenshot saved as yandex_debug.png');
        } catch (screenshotError) {
            console.log('Could not save screenshot');
        }
        
        return { error: error.message };
        
    } finally {
        await browser.close();
    }
}

async function main() {
    const imageUrl = 'https://miro.medium.com/v2/resize:fit:720/format/webp/1*AkKIRQNiuy2q7at1nJynbA.jpeg';
    
    const results = await manualYandexReverseSearch(imageUrl);
    
    console.log('\n=== FINAL YANDEX RESULTS ===');
    if (results.results && results.results.length > 0) {
        console.log(`Found ${results.results.length} potential matches:`);
        results.results.forEach((result, index) => {
            console.log(`\n${index + 1}. ${result.title}`);
            console.log(`   URL: ${result.url}`);
            if (result.snippet) {
                console.log(`   Snippet: ${result.snippet}`);
            }
        });
    } else {
        console.log('No results found or search failed');
        console.log('Results object:', results);
    }
}

main().catch(console.error);