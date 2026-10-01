require('dotenv').config();
const { chromium } = require('playwright');

async function runBrowserWatcher() {
  const email = process.env.VTU_EMAIL;
  const password = process.env.VTU_PASSWORD;
  const courseSlug = process.env.VTU_COURSE_SLUG || '1-natural-language-processing';
  const speed = 16.0; // HTML5 maximum playback rate

  console.log(`
======================================================
🌐 VTU ONLINE BROWSER AUTOMATION (PLAYWRIGHT)
======================================================
Target: https://online.vtu.ac.in/student/learning/${courseSlug}
Playback Speed: ${speed}x
`);

  if (!email || !password || email.includes('example.com')) {
    console.error('❌ Error: VTU_EMAIL and VTU_PASSWORD must be configured in .env for browser automation.');
    process.exit(1);
  }

  const browser = await chromium.launch({
    headless: false, // Set to true if you do not want the browser window to open
    args: ['--autoplay-policy=no-user-gesture-required']
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 }
  });

  const page = await context.newPage();

  try {
    console.log(`🔐 Navigating to login page...`);
    await page.goto('https://online.vtu.ac.in/auth/login', { waitUntil: 'networkidle' });

    // Fill login credentials
    console.log(`🔑 Entering credentials for ${email}...`);
    await page.fill('input[type="email"], input[name="email"], input[placeholder*="email" i]', email);
    await page.fill('input[type="password"], input[name="password"]', password);
    
    // Submit form
    await Promise.all([
      page.waitForNavigation({ timeout: 15000 }).catch(() => {}),
      page.click('button[type="submit"]')
    ]);

    console.log(`✅ Logged in! Navigating to course learning player...`);
    await page.goto(`https://online.vtu.ac.in/student/learning/${courseSlug}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    console.log(`🎬 Learning portal loaded. Injecting auto-player and speed controller...`);

    // Loop watching lectures
    let watching = true;
    let completedLectures = 0;

    while (watching) {
      // Inject video speed and play listener
      await page.evaluate((playbackSpeed) => {
        // Handle HTML5 video tags
        const videos = document.querySelectorAll('video');
        videos.forEach(v => {
          v.playbackRate = playbackSpeed;
          v.muted = true; // Mute to allow auto-play without browser restrictions
          if (v.paused) v.play().catch(() => {});
        });

        // Handle YouTube iframe API if present
        const iframes = document.querySelectorAll('iframe');
        iframes.forEach(iframe => {
          try {
            iframe.contentWindow.postMessage(JSON.stringify({
              event: 'command',
              func: 'setPlaybackRate',
              args: [playbackSpeed]
            }), '*');
            iframe.contentWindow.postMessage(JSON.stringify({
              event: 'command',
              func: 'playVideo',
              args: []
            }), '*');
          } catch (e) {}
        });
      }, speed);

      // Check for 'Next' lecture button or progress completion
      await page.waitForTimeout(4000);

      const nextButton = await page.$('button:has-text("Next"), button:has-text("Next Lecture"), [aria-label*="next" i]');
      const isVideoEnded = await page.evaluate(() => {
        const v = document.querySelector('video');
        return v ? (v.ended || (v.currentTime / v.duration) >= 0.95) : false;
      });

      if (isVideoEnded && nextButton) {
        console.log(`   ⏭️ Video reached 100%. Clicking Next Lecture...`);
        completedLectures++;
        await nextButton.click();
        await page.waitForTimeout(3000);
      } else {
        // Monitor current playback time
        const status = await page.evaluate(() => {
          const v = document.querySelector('video');
          if (!v) return null;
          return {
            current: Math.round(v.currentTime),
            total: Math.round(v.duration || 0),
            speed: v.playbackRate
          };
        });

        if (status) {
          console.log(`   ⏱️ Video Playback: ${status.current}s / ${status.total}s (${status.speed}x speed)`);
        }
      }
    }

  } catch (err) {
    console.error(`❌ Browser automation error:`, err);
  } finally {
    await browser.close();
  }
}

if (require.main === module) {
  runBrowserWatcher();
}

module.exports = { runBrowserWatcher };
