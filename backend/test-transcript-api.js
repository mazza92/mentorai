const apiScraper = require('./services/youtubeApiScraper');

async function testTranscriptAPI() {
  console.log('🧪 Testing get_transcript API\n');

  // Test with video that definitely has auto-generated transcript
  const videoId = 'jpThCV6qak8'; // Instantly channel video
  console.log(`Video: https://www.youtube.com/watch?v=${videoId}\n`);

  const result = await apiScraper.fetchTranscript(videoId);

  console.log('\n' + '='.repeat(60));
  if (result.success) {
    console.log('✅ SUCCESS - Got auto-generated transcript!');
    console.log(`Words: ${result.wordCount}`);
    console.log(`Segments: ${result.segments.length}`);
    console.log(`Preview: ${result.text.substring(0, 200)}...`);
  } else {
    console.log('❌ FAILED');
    console.log(`Error: ${result.error}`);
    console.log('\nThis means we need to implement the params encoding.');
  }
  console.log('='.repeat(60));
}

testTranscriptAPI().catch(console.error);
