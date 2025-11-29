const ytdlp = require('./services/youtubeDlpScraper');

async function test() {
  console.log('🧪 Testing yt-dlp Scraper\n');

  const testVideos = [
    { id: 'DfiqXX7R5Fw', name: 'Will Cannon' },
    { id: 'jpThCV6qak8', name: 'Instantly' }
  ];

  for (const video of testVideos) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Testing: ${video.name} (${video.id})`);
    console.log('='.repeat(60));

    const result = await ytdlp.fetchTranscript(video.id);

    if (result.success) {
      console.log(`\n✅ SUCCESS!`);
      console.log(`   Language: ${result.language}`);
      console.log(`   Words: ${result.wordCount}`);
      console.log(`   Segments: ${result.segments.length}`);
      console.log(`   Preview: ${result.text.substring(0, 200)}...`);
    } else {
      console.log(`\n❌ FAILED: ${result.error}`);
    }

    ytdlp.clearCache();
  }

  console.log('\n' + '='.repeat(60));
  console.log('If this works, we have our solution!');
  console.log('='.repeat(60));
}

test().catch(console.error);
