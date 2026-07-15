const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer');
const { PuppeteerScreenRecorder } = require('puppeteer-screen-recorder');
const { getQualityPreset } = require('../config/qualityPresets');

/**
 * Auto-scroll the page smoothly
 * @param {Object} page - Puppeteer page
 * @param {Number} duration - Duration in seconds
 */
async function autoScrollPage(page, duration) {
  const scrollDuration = Math.max(duration - 2, 5) * 1000; // Leave 2 seconds buffer
  
  await page.evaluate(async (scrollDuration) => {
    await new Promise((resolve) => {
      let totalHeight = 0;
      const distance = 100;
      const delay = 100;
      const maxScroll = document.body.scrollHeight;
      
      const timer = setInterval(() => {
        window.scrollBy(0, distance);
        totalHeight += distance;
        
        if (totalHeight >= maxScroll || totalHeight >= scrollDuration * 10) {
          clearInterval(timer);
          resolve();
        }
      }, delay);
    });
  }, scrollDuration);
}

/**
 * Execute a list of interactions on the page
 * @param {Object} page - Puppeteer page
 * @param {Array} interactions - Array of interaction objects
 */
async function executeInteractions(page, interactions) {
  for (const [index, interaction] of interactions.entries()) {
    try {
      console.log(`  ${index + 1}. ${interaction.action}${interaction.selector ? ' ' + interaction.selector : ''}`);
      
      // Wait before action if delay specified
      if (interaction.delay) {
        await new Promise(resolve => setTimeout(resolve, interaction.delay));
      }
      
      switch (interaction.action) {
        case 'scroll':
          const scrollAmount = interaction.amount || 500;
          await page.evaluate((amount) => {
            window.scrollBy(0, amount);
          }, scrollAmount);
          break;
          
        case 'click':
          await page.waitForSelector(interaction.selector, { timeout: 10000 });
          await page.click(interaction.selector);
          break;
          
        case 'hover':
          await page.waitForSelector(interaction.selector, { timeout: 10000 });
          await page.hover(interaction.selector);
          break;
          
        case 'type':
          await page.waitForSelector(interaction.selector, { timeout: 10000 });
          await page.type(interaction.selector, interaction.text);
          break;
          
        case 'wait':
          const waitTime = interaction.time || 1000;
          await new Promise(resolve => setTimeout(resolve, waitTime));
          break;
          
        default:
          console.warn(`  ⚠️  Unknown action: ${interaction.action}`);
      }
      
      // Wait after action
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error) {
      console.error(`  ❌ Failed interaction ${index + 1}: ${error.message}`);
      // Continue with other interactions
    }
  }
}

/**
 * Capture a website as video
 * @param {Object} params - { url, duration, quality, interactions, options }
 * @returns {Object} - Capture result
 */
async function captureWebsite({ url, duration, quality, interactions, options }) {
  // Get quality preset settings
  const qualityConfig = getQualityPreset(quality, options);
  
  const jobId = uuidv4();
  const filename = `capture-${jobId}.mp4`;
  const outputPath = path.join(__dirname, '..', process.env.VIDEO_OUTPUT_DIR || './videos', filename);

  console.log(`🎬 Starting capture for ${url}`);
  console.log(`⏱️  Duration: ${duration}s`);
  console.log(`🎨 Quality: ${quality || 'high'}`);
  console.log(`📐 Resolution: ${qualityConfig.width}x${qualityConfig.height} @ ${qualityConfig.fps}fps`);
  console.log(`💾 Output: ${outputPath}`);

  let browser;
  let page;
  let recorder;

  try {
    // Launch browser
    const launchOptions = {
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        `--window-size=${qualityConfig.width},${qualityConfig.height}`
      ]
    };

    if (process.env.PUPPETEER_EXECUTABLE_PATH) {
      if (fs.existsSync(process.env.PUPPETEER_EXECUTABLE_PATH)) {
        launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
      } else {
        console.log(`⚠️  PUPPETEER_EXECUTABLE_PATH not found on disk ("${process.env.PUPPETEER_EXECUTABLE_PATH}"). Falling back to bundled browser.`);
      }
    }

    browser = await puppeteer.launch(launchOptions);

    page = await browser.newPage();

    // Set viewport
    await page.setViewport({
      width: qualityConfig.width,
      height: qualityConfig.height
    });

    console.log('🌐 Navigating to URL...');
    
    // Navigate to the URL
    try {
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      });
    } catch (navError) {
      console.warn('⚠️  Navigation timeout, but continuing...');
    }

    // Wait for page to settle
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('✅ Page loaded, starting recording...');

    // Configure recorder with quality preset
    const config = {
      followNewTab: false,
      fps: qualityConfig.fps,
      videoFrame: {
        width: qualityConfig.width,
        height: qualityConfig.height
      },
      videoCrf: qualityConfig.videoCrf,
      videoCodec: 'libx264',
      videoPreset: qualityConfig.videoPreset,
      videoBitrate: qualityConfig.videoBitrate,
      aspectRatio: '16:9'
    };

    recorder = new PuppeteerScreenRecorder(page, config);
    
    await recorder.start(outputPath);

    console.log(`⏳ Recording for ${duration} seconds...`);

    // Execute interactions if provided
    if (interactions && interactions.length > 0) {
      console.log(`🎮 Executing ${interactions.length} interaction(s)...`);
      await executeInteractions(page, interactions);
    } else if (qualityConfig.autoScroll || options.autoScroll) {
      console.log(`📜 Auto-scrolling page...`);
      await autoScrollPage(page, duration);
    }

    // Record for the remaining duration
    await new Promise(resolve => setTimeout(resolve, duration * 1000));

    console.log('🎬 Stopping recording...');

    // Stop recording
    await recorder.stop();

    // Wait for file to be finalized
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('✅ Recording complete!');

    // Get file size
    const stats = fs.statSync(outputPath);
    const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);

    console.log(`✅ Video saved: ${filename} (${fileSizeMB} MB)`);

    return {
      jobId,
      url,
      duration,
      quality: quality || 'high',
      filename,
      videoUrl: `/videos/${filename}`,
      filePath: outputPath,
      fileSize: `${fileSizeMB} MB`,
      resolution: `${qualityConfig.width}x${qualityConfig.height}`,
      fps: qualityConfig.fps,
      status: 'completed'
    };

  } catch (error) {
    console.error('❌ Capture failed:', error.message);
    
    // Cleanup on error
    if (recorder) {
      try { await recorder.stop(); } catch (e) {}
    }
    if (fs.existsSync(outputPath)) {
      try { fs.unlinkSync(outputPath); } catch (e) {}
    }
    
    throw new Error(`Failed to capture video: ${error.message}`);
  } finally {
    // Cleanup browser
    if (page) {
      try { await page.close(); } catch (e) {}
    }
    if (browser) {
      try { await browser.close(); } catch (e) {}
    }
  }
}

module.exports = {
  captureWebsite
};
