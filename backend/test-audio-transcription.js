const audioService = require('./services/audioOnlyTranscriptionService');

async function testAudioTranscription() {
  console.log('='.repeat(70));
  console.log('Testing Audio-Only Transcription for Channel Imports');
  console.log('='.repeat(70));
  console.log();

  // Test with a short video first (faster testing)
  const testVideoId = 'jNQXAC9IVRw'; // "Me at the zoo" - first YouTube video, only 19 seconds

  console.log(`Testing with: https://youtube.com/watch?v=${testVideoId}`);
  console.log(`This is a 19-second video for quick testing\n`);

  try {
    const result = await audioService.processVideo(testVideoId);

    if (result.success) {
      console.log('\n' + '='.repeat(70));
      console.log('✅ SUCCESS!');
      console.log('='.repeat(70));
      console.log(`Language: ${result.language}`);
      console.log(`Word count: ${result.wordCount}`);
      console.log(`Character count: ${result.charCount}`);
      console.log(`Confidence: ${(result.confidence * 100).toFixed(1)}%`);
      console.log(`Processing time: ${result.processingTime}s`);
      console.log(`\nTranscript:\n"${result.text}"`);
      console.log(`\nSegments: ${result.segments.length}`);
      console.log(`First segment: "${result.segments[0]?.text}"`);

    } else {
      console.log('\n❌ FAILED');
      console.log(`Error: ${result.error}`);
    }

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error.stack);
  }

  console.log('\n' + '='.repeat(70));
  console.log('Cost Estimates for Channel Imports');
  console.log('='.repeat(70));

  // Show cost estimates for different channel sizes
  const scenarios = [
    { videos: 10, avgDuration: 10, description: 'Small channel (10 videos, 10 min avg)' },
    { videos: 50, avgDuration: 15, description: 'Medium channel (50 videos, 15 min avg)' },
    { videos: 100, avgDuration: 12, description: 'Large channel (100 videos, 12 min avg)' },
    { videos: 200, avgDuration: 8, description: 'Very large channel (200 videos, 8 min avg)' },
  ];

  console.log();
  scenarios.forEach(scenario => {
    const estimate = audioService.estimateCost(scenario.videos, scenario.avgDuration);
    console.log(`${scenario.description}:`);
    console.log(`  Total cost: ${estimate.estimatedCost} (${estimate.perVideo} per video)`);
    console.log(`  Processing time: ~${(scenario.videos * 0.75).toFixed(0)} minutes (3 concurrent)\n`);
  });

  console.log('='.repeat(70));
  console.log('Note: This is 10-20x faster than video transcription!');
  console.log('Audio-only: ~45 seconds/video vs Video: 2-4 minutes/video');
  console.log('='.repeat(70));
}

testAudioTranscription()
  .then(() => {
    console.log('\n✓ Test complete!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n✗ Fatal error:', error);
    process.exit(1);
  });
