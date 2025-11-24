const tripleIndexService = require('./services/tripleLayeredIndexService');

/**
 * Test caption fetching for a single video
 * No API key needed - just tests the caption fetchers
 */

async function testCaptionFetch() {
  console.log('='.repeat(80));
  console.log('🎯 TESTING CAPTION FETCHING');
  console.log('='.repeat(80));
  console.log();

  // Test with a popular video that should have captions
  const testVideoId = 'dQw4w9WgXcQ'; // Rick Astley - Never Gonna Give You Up

  console.log(`Testing video: ${testVideoId}`);
  console.log('Methods to try:');
  console.log('  1. Puppeteer (real browser)');
  console.log('  2. Python youtube-transcript-api');
  console.log();

  try {
    const startTime = Date.now();

    const captions = await tripleIndexService.fetchCaptionsBestEffort(testVideoId);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    if (captions && captions.length > 0) {
      console.log('\n' + '='.repeat(80));
      console.log('✅ SUCCESS! Captions fetched');
      console.log('='.repeat(80));
      console.log();
      console.log(`Segments: ${captions.length}`);
      console.log(`Processing Time: ${elapsed} seconds`);
      console.log();
      console.log('First 3 segments:');
      captions.slice(0, 3).forEach((seg, i) => {
        console.log(`  ${i + 1}. [${(seg.offset / 1000).toFixed(1)}s] ${seg.text}`);
      });
      console.log();
      console.log('Total text length:', captions.map(s => s.text).join(' ').length, 'characters');
    } else {
      console.log('\n' + '='.repeat(80));
      console.log('⚠️  NO CAPTIONS AVAILABLE');
      console.log('='.repeat(80));
      console.log();
      console.log('This could mean:');
      console.log('  - The video has no captions/subtitles');
      console.log('  - YouTube is blocking the requests (bot detection)');
      console.log('  - Network/connectivity issues');
    }

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error('\nStack trace:', error.stack);
  }
}

console.log('🚀 Starting caption fetch test...\n');

testCaptionFetch()
  .then(() => {
    console.log('\n✓ Test complete!');
    process.exit(0);
  })
  .catch(error => {
    console.error('✗ Fatal error:', error);
    process.exit(1);
  });
