const apiScraper = require('./services/youtubeApiScraper');

async function test() {
  console.log('🧪 Testing YouTube API Scraper\n');

  // Test with Will Cannon video
  const videoId = 'DfiqXX7R5Fw';
  console.log(`Testing video: https://www.youtube.com/watch?v=${videoId}\n`);

  const result = await apiScraper.fetchTranscript(videoId);

  if (result.success) {
    console.log('\n✅ SUCCESS!\n');
    console.log(`Text preview: ${result.text.substring(0, 200)}...`);
    console.log(`\nWord count: ${result.wordCount}`);
    console.log(`Language: ${result.language}`);
    console.log(`Segments: ${result.segments.length}`);
    console.log(`Fetch time: ${result.fetchTime}s`);
  } else {
    console.log('\n❌ FAILED\n');
    console.log(`Error: ${result.error}`);
  }
}

test().catch(console.error);
