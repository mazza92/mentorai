const channelTranscriptService = require('./services/channelTranscriptService');

/**
 * Test yt-dlp caption fetching with browser cookies
 * This is the REAL solution for YouTube bot detection
 */

async function testYtDlp() {
  console.log('='.repeat(80));
  console.log('🎯 TESTING YT-DLP WITH BROWSER COOKIES');
  console.log('='.repeat(80));
  console.log();

  // Test with a popular video that should have captions
  const testVideoId = 'dQw4w9WgXcQ'; // Rick Astley - Never Gonna Give You Up

  console.log(`Testing video: ${testVideoId}`);
  console.log('This will try:');
  console.log('  1. Puppeteer (real browser)');
  console.log('  2. Python youtube-transcript-api');
  console.log('  3. yt-dlp with Chrome cookies');
  console.log('  4. yt-dlp with Firefox cookies');
  console.log('  5. yt-dlp with Edge cookies');
  console.log('  6. Axios scraping fallback');
  console.log();
  console.log('⚠️  Make sure you are signed into YouTube in your browser!');
  console.log();

  try {
    const startTime = Date.now();

    const result = await channelTranscriptService.fetchTranscript(testVideoId);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    if (result.available && result.segments && result.segments.length > 0) {
      console.log('\n' + '='.repeat(80));
      console.log('✅ SUCCESS! Captions fetched');
      console.log('='.repeat(80));
      console.log();
      console.log(`Source: ${result.source}`);
      console.log(`Language: ${result.language}`);
      console.log(`Segments: ${result.segments.length}`);
      console.log(`Total characters: ${result.text.length}`);
      console.log(`Processing Time: ${elapsed} seconds`);
      console.log();
      console.log('First 5 segments:');
      result.segments.slice(0, 5).forEach((seg, i) => {
        console.log(`  ${i + 1}. [${(seg.start).toFixed(1)}s] ${seg.text.substring(0, 80)}...`);
      });
      console.log();
      console.log('🎉 Caption fetching is working! Your app can now:');
      console.log('  - Import channels with FREE captions (Tier 2)');
      console.log('  - Save 70-90% on transcription costs');
      console.log('  - Make channels instantly searchable');
    } else {
      console.log('\n' + '='.repeat(80));
      console.log('❌ FAILED - No captions available');
      console.log('='.repeat(80));
      console.log();
      console.log('Error:', result.error || 'Unknown error');
      console.log();
      console.log('Troubleshooting:');
      console.log('  1. Make sure yt-dlp is installed: pip install yt-dlp');
      console.log('  2. Sign into YouTube in Chrome/Firefox/Edge');
      console.log('  3. Check if yt-dlp can access cookies:');
      console.log('     yt-dlp --cookies-from-browser chrome --list-formats https://youtube.com/watch?v=' + testVideoId);
      console.log();
    }

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error('\nStack trace:', error.stack);
    console.log();
    console.log('Common issues:');
    console.log('  - yt-dlp not installed: pip install yt-dlp');
    console.log('  - Not signed into YouTube in browser');
    console.log('  - Browser cookies encrypted (Windows)');
    console.log();
    console.log('See YOUTUBE_CAPTION_FIX.md for detailed solutions');
  }
}

console.log('🚀 Starting yt-dlp caption test (may take 30-60 seconds)...\n');

testYtDlp()
  .then(() => {
    console.log('✓ Test complete!');
    process.exit(0);
  })
  .catch(error => {
    console.error('✗ Fatal error:', error);
    process.exit(1);
  });
