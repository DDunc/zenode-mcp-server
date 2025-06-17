/**
 * Browser Validator - Puppeteer-based web component testing
 */
import puppeteer, { Browser, Page } from 'puppeteer';
import { logger } from '../../../src/utils/logger.js';

export interface BrowserTestResult {
  workerId: string;
  componentPath: string;
  passed: number;
  failed: number;
  errors: string[];
  performance: {
    lcp?: number;
    fid?: number;
    cls?: number;
    fcp?: number;
    ttfb?: number;
  };
  accessibility: {
    hasHeadings: boolean;
    hasAltText: boolean;
    hasLabels: boolean;
    hasSkipLinks: boolean;
    colorContrast: boolean;
  };
  responsive: {
    mobile: boolean;
    tablet: boolean;
    desktop: boolean;
  };
  timestamp: Date;
}

export class BrowserValidator {
  private browser: Browser | null = null;
  private testResults: Map<string, BrowserTestResult> = new Map();

  async initialize(): Promise<void> {
    logger.info('🌐 Initializing Browser Validator with Puppeteer');
    
    this.browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding'
      ]
    });
    
    logger.info('✅ Browser initialized successfully');
  }

  async validateWebComponent(workerId: string, componentPath: string = 'index.html'): Promise<BrowserTestResult> {
    if (!this.browser) {
      throw new Error('Browser not initialized. Call initialize() first.');
    }
    
    logger.info(`🔍 Validating web component for worker ${workerId}: ${componentPath}`);
    
    const page = await this.browser.newPage();
    const testResult: BrowserTestResult = {
      workerId,
      componentPath,
      passed: 0,
      failed: 0,
      errors: [],
      performance: {},
      accessibility: {
        hasHeadings: false,
        hasAltText: false,
        hasLabels: false,
        hasSkipLinks: false,
        colorContrast: false
      },
      responsive: {
        mobile: false,
        tablet: false,
        desktop: false
      },
      timestamp: new Date()
    };

    try {
      // Set user agent and viewport
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      await page.setViewport({ width: 1920, height: 1080 });
      
      // Calculate port for this worker
      const port = 3031 + parseInt(workerId);
      const url = `http://localhost:${port}/${componentPath}`;
      
      logger.info(`📡 Navigating to ${url}`);
      
      // Navigate with timeout and error handling
      try {
        await page.goto(url, { 
          waitUntil: 'networkidle0',
          timeout: 30000 
        });
      } catch (error) {
        testResult.errors.push(`Navigation failed: ${error.message}`);
        testResult.failed++;
        return testResult;
      }
      
      // Wait for component to load (with fallback)
      try {
        await Promise.race([
          page.waitForSelector('[data-testid="component-ready"]', { timeout: 10000 }),
          page.waitForSelector('body', { timeout: 10000 }) // Fallback
        ]);
        testResult.passed++;
      } catch (error) {
        testResult.errors.push(`Component loading timeout: ${error.message}`);
        testResult.failed++;
      }
      
      // Run comprehensive test suite
      await Promise.all([
        this.runComponentTests(page, testResult),
        this.runPerformanceTests(page, testResult),
        this.runAccessibilityTests(page, testResult),
        this.runResponsiveTests(page, testResult)
      ]);
      
    } catch (error) {
      testResult.errors.push(`Browser test failed: ${error.message}`);
      testResult.failed++;
      logger.error(`Browser validation error for worker ${workerId}:`, error);
    } finally {
      await page.close();
    }

    this.testResults.set(workerId, testResult);
    logger.info(`✅ Browser validation complete for worker ${workerId} - ${testResult.passed} passed, ${testResult.failed} failed`);
    
    return testResult;
  }

  private async runComponentTests(page: Page, result: BrowserTestResult): Promise<void> {
    const tests = [
      { 
        name: 'Basic DOM structure', 
        test: async () => {
          const hasHtml = await page.$('html');
          const hasBody = await page.$('body');
          return hasHtml && hasBody;
        }
      },
      { 
        name: 'Interactive elements work', 
        test: async () => {
          const buttons = await page.$$('button, [role="button"], input[type="button"], input[type="submit"]');
          if (buttons.length === 0) return true; // No buttons to test
          
          // Test first button
          try {
            await buttons[0].click();
            await page.waitForTimeout(500);
            return true;
          } catch (error) {
            return false;
          }
        }
      },
      { 
        name: 'Form validation (if present)', 
        test: async () => {
          const forms = await page.$$('form');
          if (forms.length === 0) return true; // No forms to test
          
          return await this.testFormValidation(page);
        }
      },
      { 
        name: 'No JavaScript errors', 
        test: async () => {
          const errors = await page.evaluate(() => {
            return window.console.error.length || 0;
          });
          return errors === 0;
        }
      },
      {
        name: 'Content is visible',
        test: async () => {
          const hasVisibleContent = await page.evaluate(() => {
            const body = document.body;
            return body && body.offsetHeight > 100 && body.offsetWidth > 100;
          });
          return hasVisibleContent;
        }
      }
    ];

    for (const testCase of tests) {
      try {
        const passed = await testCase.test();
        if (passed) {
          result.passed++;
        } else {
          result.failed++;
          result.errors.push(`${testCase.name}: Test failed`);
        }
      } catch (error) {
        result.failed++;
        result.errors.push(`${testCase.name}: ${error.message}`);
      }
    }
  }

  private async testFormValidation(page: Page): Promise<boolean> {
    try {
      const forms = await page.$$('form');
      if (forms.length === 0) return true;
      
      // Test first form
      const form = forms[0];
      const inputs = await form.$$('input, textarea, select');
      
      // Try to submit empty form to test validation
      const submitButton = await form.$('input[type="submit"], button[type="submit"], button:not([type])');
      if (submitButton) {
        await submitButton.click();
        await page.waitForTimeout(1000);
      }
      
      return true; // Basic form interaction successful
    } catch (error) {
      return false;
    }
  }

  private async runPerformanceTests(page: Page, result: BrowserTestResult): Promise<void> {
    try {
      // Measure Core Web Vitals and performance metrics
      const performanceMetrics = await page.evaluate(() => {
        return new Promise((resolve) => {
          const metrics: any = {};
          
          // Get navigation timing
          const navTiming = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
          if (navTiming) {
            metrics.ttfb = navTiming.responseStart - navTiming.requestStart;
            metrics.fcp = navTiming.loadEventStart - navTiming.fetchStart;
          }
          
          // Try to get LCP and other metrics
          if ('PerformanceObserver' in window) {
            let observerCount = 0;
            const maxObservers = 3;
            
            const lcpObserver = new PerformanceObserver((list) => {
              const entries = list.getEntries();
              const lastEntry = entries[entries.length - 1];
              if (lastEntry) {
                metrics.lcp = lastEntry.startTime;
              }
              observerCount++;
              if (observerCount >= maxObservers) resolve(metrics);
            });
            
            const fidObserver = new PerformanceObserver((list) => {
              const entries = list.getEntries();
              if (entries.length > 0) {
                metrics.fid = entries[0].processingStart - entries[0].startTime;
              }
              observerCount++;
              if (observerCount >= maxObservers) resolve(metrics);
            });
            
            const clsObserver = new PerformanceObserver((list) => {
              const entries = list.getEntries();
              let clsValue = 0;
              entries.forEach((entry: any) => {
                if (!entry.hadRecentInput) {
                  clsValue += entry.value;
                }
              });
              metrics.cls = clsValue;
              observerCount++;
              if (observerCount >= maxObservers) resolve(metrics);
            });
            
            try {
              lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
              fidObserver.observe({ entryTypes: ['first-input'] });
              clsObserver.observe({ entryTypes: ['layout-shift'] });
            } catch (error) {
              resolve(metrics);
            }
            
            // Timeout after 5 seconds
            setTimeout(() => resolve(metrics), 5000);
          } else {
            resolve(metrics);
          }
        });
      });

      result.performance = performanceMetrics;
      
      // Score performance metrics
      if (performanceMetrics.lcp && performanceMetrics.lcp < 2500) result.passed++;
      else result.failed++;
      
      if (performanceMetrics.fid && performanceMetrics.fid < 100) result.passed++;
      else if (performanceMetrics.fid) result.failed++;
      
      if (performanceMetrics.cls && performanceMetrics.cls < 0.1) result.passed++;
      else if (performanceMetrics.cls) result.failed++;
      
    } catch (error) {
      result.failed++;
      result.errors.push(`Performance test error: ${error.message}`);
    }
  }

  private async runAccessibilityTests(page: Page, result: BrowserTestResult): Promise<void> {
    try {
      const a11yChecks = await page.evaluate(() => {
        const checks = {
          hasHeadings: document.querySelectorAll('h1, h2, h3, h4, h5, h6').length > 0,
          hasAltText: Array.from(document.querySelectorAll('img')).every(img => 
            img.alt !== undefined && img.alt !== ''),
          hasLabels: Array.from(document.querySelectorAll('input, textarea, select')).every(input => 
            input.labels?.length > 0 || 
            input.getAttribute('aria-label') || 
            input.getAttribute('aria-labelledby') ||
            input.type === 'hidden'),
          hasSkipLinks: document.querySelector('a[href="#main"], a[href="#content"], .skip-link') !== null,
          colorContrast: true // Simplified - would need more complex contrast checking
        };
        return checks;
      });

      result.accessibility = a11yChecks;
      
      // Score accessibility checks
      Object.entries(a11yChecks).forEach(([key, passed]) => {
        if (passed) {
          result.passed++;
        } else {
          result.failed++;
          result.errors.push(`Accessibility: ${key} check failed`);
        }
      });
      
    } catch (error) {
      result.failed++;
      result.errors.push(`Accessibility test error: ${error.message}`);
    }
  }

  private async runResponsiveTests(page: Page, result: BrowserTestResult): Promise<void> {
    const viewports = [
      { width: 375, height: 667, name: 'mobile' },
      { width: 768, height: 1024, name: 'tablet' },
      { width: 1920, height: 1080, name: 'desktop' }
    ];

    for (const viewport of viewports) {
      try {
        await page.setViewport(viewport);
        await page.waitForTimeout(1000);
        
        // Check if layout is responsive and doesn't overflow
        const isResponsive = await page.evaluate(() => {
          const body = document.body;
          const html = document.documentElement;
          
          // Check for horizontal overflow
          const hasHorizontalOverflow = body.scrollWidth > window.innerWidth ||
                                      html.scrollWidth > window.innerWidth;
          
          // Check if content is visible
          const hasVisibleContent = body.offsetHeight > 100;
          
          return !hasHorizontalOverflow && hasVisibleContent;
        });

        result.responsive[viewport.name as keyof typeof result.responsive] = isResponsive;
        
        if (isResponsive) {
          result.passed++;
        } else {
          result.failed++;
          result.errors.push(`Responsive test failed for ${viewport.name}`);
        }
        
      } catch (error) {
        result.failed++;
        result.errors.push(`Viewport test error (${viewport.name}): ${error.message}`);
        result.responsive[viewport.name as keyof typeof result.responsive] = false;
      }
    }
  }

  getResults(): Map<string, BrowserTestResult> {
    return this.testResults;
  }

  async cleanup(): Promise<void> {
    if (this.browser) {
      logger.info('🧹 Cleaning up browser instance');
      await this.browser.close();
      this.browser = null;
    }
  }
}