const apiScraper = require('./services/youtubeApiScraper');

async function verifyMultipleVideos() {
  console.log('🧪 Verifying YouTube Scraper with Multiple Videos\n');

  // Test videos from different channels
  const testVideos = [
    { id: 'DfiqXX7R5Fw', channel: 'Will Cannon', expectedCaptions: true },
    { id: 'jpThCV6qak8', channel: 'Instantly', expectedCaptions: false },
    { id: 'dQw4w9WgXcQ', channel: 'Rick Astley', expectedCaptions: true }, // Never Gonna Give You Up
  ];

  for (const video of testVideos) {
    console.log(`\n📹 Testing: ${video.channel} (${video.id})`);
    console.log(`Expected captions: ${video.expectedCaptions ? 'YES' : 'NO'}`);
    console.log(`URL: https://www.youtube.com/watch?v=${video.id}`);

    const result = await apiScraper.fetchTranscript(video.id);

    if (result.success) {
      console.log(`✅ SUCCESS - Found captions!`);
      console.log(`   Language: ${result.language}`);
      console.log(`   Words: ${result.wordCount}`);
      console.log(`   Preview: ${result.text.substring(0, 100)}...`);
    } else {
      console.log(`❌ NO CAPTIONS - ${result.error}`);
    }

    // Clear cache for next test
    apiScraper.clearCache();
  }

  console.log('\n' + '='.repeat(60));
  console.log('CONCLUSION:');
  console.log('If Will Cannon and Rick Astley succeed but Instantly fails,');
  console.log('then the scraper works - Instantly just has no captions.');
  console.log('='.repeat(60));
}

verifyMultipleVideos().catch(console.error);
