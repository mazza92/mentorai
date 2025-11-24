const captionFetcher = require('./services/captionFetcher');

async function testTranscript() {
  console.log('Testing Python youtube-transcript-api...\n');

  // Test with a popular video that definitely has captions
  const testVideoIds = [
    'dQw4w9WgXcQ', // Rick Roll - definitely has captions
    'jNQXAC9IVRw', // Me at the zoo (first YouTube video)
    'NY3y0V9UDwM', // One of your test videos
  ];

  for (const videoId of testVideoIds) {
    console.log(`\n--- Testing video: ${videoId} ---`);

    try {
      const result = await captionFetcher.fetchTranscript(videoId);

      if (result.success) {
        console.log(`✅ SUCCESS!`);
        console.log(`   Segments: ${result.segments.length}`);
        console.log(`   Characters: ${result.charCount}`);
        console.log(`   Language: ${result.language}`);
        console.log(`   Auto-generated: ${result.isGenerated}`);
        console.log(`   First 200 chars: ${result.text.substring(0, 200)}...`);
      } else {
        console.log(`❌ FAILED: ${result.error}`);
      }
    } catch (error) {
      console.log(`❌ ERROR: ${error.message}`);
    }
  }

  console.log('\n\n=== Batch Test ===');
  const batchResult = await captionFetcher.fetchMultiple(testVideoIds, 3);
  const successful = batchResult.filter(r => r.success).length;
  console.log(`\nBatch complete: ${successful}/${testVideoIds.length} successful`);
}

testTranscript().catch(console.error);
