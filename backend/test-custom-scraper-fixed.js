const customScraper = require('./services/customYouTubeScraper');

async function testFixedScraper() {
  console.log('🧪 Testing Fixed Custom Scraper\n');

  const testVideos = [
    { id: 'DfiqXX7R5Fw', name: 'Will Cannon' },
    { id: 'jpThCV6qak8', name: 'Instantly' }
  ];

  for (const video of testVideos) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Testing: ${video.name} (${video.id})`);
    console.log('='.repeat(60));

    const result = await customScraper.fetchTranscript(video.id);

    if (result.success) {
      console.log(`\n✅ SUCCESS!`);
      console.log(`   Language: ${result.language}`);
      console.log(`   Words: ${result.wordCount}`);
      console.log(`   Segments: ${result.segments.length}`);
      console.log(`   Preview: ${result.text.substring(0, 150)}...`);
    } else {
      console.log(`\n❌ FAILED: ${result.error}`);
    }

    // Clear cache for next test
    customScraper.clearCache();
  }

  console.log('\n' + '='.repeat(60));
  console.log('If both succeed, the fix works!');
  console.log('='.repeat(60));
}

testFixedScraper().catch(console.error);
