require('dotenv').config();
const youtubeBotBypass = require('./services/youtubeBotBypass');
const youtubeDlpScraper = require('./services/youtubeDlpScraper');

/**
 * Test YouTube Bot Bypass System
 *
 * This script tests:
 * 1. Fresh cookie extraction from YouTube using Puppeteer
 * 2. Cookie caching and rotation
 * 3. Transcript fetching with bot bypass
 * 4. Retry logic and fallback mechanisms
 */
async function testBotBypass() {
  console.log('='.repeat(80));
  console.log('Testing YouTube Bot Bypass System');
  console.log('='.repeat(80));
  console.log('');

  try {
    // Test 1: Extract fresh cookies
    console.log('📝 Test 1: Extracting fresh cookies from YouTube...');
    console.log('-'.repeat(80));

    const cookieResult = await youtubeBotBypass.extractFreshCookies();

    if (cookieResult.success) {
      console.log('✅ Cookie extraction successful!');
      console.log(`   - Extracted cookies length: ${cookieResult.cookies.length} chars`);
      console.log(`   - User agent: ${cookieResult.userAgent}`);
      console.log(`   - Cookie count: ${cookieResult.cookiesArray.length}`);

      // Show first few cookies
      const firstCookies = cookieResult.cookiesArray.slice(0, 5);
      console.log('\n   First 5 cookies:');
      firstCookies.forEach(cookie => {
        console.log(`     - ${cookie.name}: ${cookie.value.substring(0, 20)}... (expires: ${cookie.expires || 'session'})`);
      });
    } else {
      console.log('❌ Cookie extraction failed:', cookieResult.error);
      return;
    }

    console.log('');

    // Test 2: Get cached cookies
    console.log('📝 Test 2: Testing cookie caching...');
    console.log('-'.repeat(80));

    const cachedCookies = await youtubeBotBypass.getFreshCookies();
    console.log('✅ Retrieved cached cookies (should be instant)');

    console.log('');

    // Test 3: Fetch transcript with bot bypass
    const testVideoId = 'dQw4w9WgXcQ'; // Rick Astley - Never Gonna Give You Up
    console.log(`📝 Test 3: Fetching transcript with bot bypass for video: ${testVideoId}`);
    console.log('-'.repeat(80));

    const transcriptResult = await youtubeDlpScraper.fetchTranscript(testVideoId);

    if (transcriptResult.success) {
      console.log('✅ Transcript fetched successfully!');
      console.log(`   - Source: ${transcriptResult.source}`);
      console.log(`   - Used bot bypass: ${transcriptResult.usedBotBypass ? 'YES' : 'NO'}`);
      console.log(`   - Word count: ${transcriptResult.wordCount}`);
      console.log(`   - Segments: ${transcriptResult.segments.length}`);
      console.log(`   - Fetch time: ${transcriptResult.fetchTime}s`);
      console.log(`   - Language: ${transcriptResult.language}`);

      // Show first few words
      const preview = transcriptResult.text.substring(0, 200);
      console.log(`\n   Preview: "${preview}..."`);
    } else {
      console.log('❌ Transcript fetch failed:', transcriptResult.error);
    }

    console.log('');

    // Test 4: Test retry mechanism
    console.log('📝 Test 4: Testing retry mechanism with executeWithRetry...');
    console.log('-'.repeat(80));

    const command = 'yt-dlp --cookies "{{cookies}}" --get-title --get-duration https://www.youtube.com/watch?v=dQw4w9WgXcQ';

    const execResult = await youtubeBotBypass.executeWithRetry(command, {
      timeout: 15000,
      maxRetries: 2,
      baseDelay: 1000
    });

    if (execResult.stdout) {
      console.log('✅ Command execution successful!');
      console.log(`   Output: ${execResult.stdout.trim()}`);
    }

    console.log('');
    console.log('='.repeat(80));
    console.log('✅ All tests passed!');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('');
    console.error('='.repeat(80));
    console.error('❌ Test failed:', error.message);
    console.error('='.repeat(80));
    console.error(error.stack);
  } finally {
    // Cleanup
    console.log('\n🧹 Cleaning up...');
    await youtubeBotBypass.cleanup();
    console.log('✅ Cleanup complete');
  }
}

// Run tests
testBotBypass().catch(console.error);
