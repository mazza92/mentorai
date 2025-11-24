const tripleIndexService = require('./services/tripleLayeredIndexService');

/**
 * Test Phase 1 Only - No API key needed!
 * Demonstrates instant channel indexing with Tier 1 + Tier 2
 */

async function testPhase1Only() {
  console.log('='.repeat(80));
  console.log('🎯 TRIPLE-LAYERED INDEX - PHASE 1 TEST (FREE, NO API KEY NEEDED)');
  console.log('='.repeat(80));
  console.log();

  // Test with a very small channel
  const testChannelId = 'UCW5YeuERMmlnqo4oq8vwUpg'; // Fireship

  console.log('📚 Testing: PHASE 1 - Immediate Ingestion');
  console.log('-'.repeat(80));
  console.log('What happens:');
  console.log('  1. Fetch all video metadata from YouTube API (Tier 1)');
  console.log('  2. Attempt to get captions for each video (Tier 2)');
  console.log('  3. Store everything in Firestore');
  console.log('  4. Channel becomes INSTANTLY SEARCHABLE');
  console.log();
  console.log('Cost: $0.00 (100% free!)');
  console.log();

  try {
    const startTime = Date.now();

    const result = await tripleIndexService.ingestChannelImmediate(
      testChannelId,
      'test-user-123'
    );

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log('\n' + '='.repeat(80));
    console.log('✅ PHASE 1 SUCCESS!');
    console.log('='.repeat(80));
    console.log();
    console.log(`Channel Name: ${result.channelName}`);
    console.log(`Total Videos: ${result.videoCount}`);
    console.log(`Processing Time: ${elapsed} seconds`);
    console.log();
    console.log('TIER COVERAGE:');
    console.log(`  📊 Tier 1 (Metadata):      ${result.tierStats.tier1Percentage}% ✓`);
    console.log(`  📝 Tier 2 (Captions):      ${result.tierStats.tier2Percentage}%`);
    console.log(`  🎤 Tier 3 (Transcription): ${result.tierStats.tier3Percentage}% (on-demand)`);
    console.log();
    console.log('💰 COST ANALYSIS:');
    console.log(`  Potential cost (transcribe all): ${result.estimatedSavings.potentialCost}`);
    console.log(`  Actual cost so far: $0.00`);
    console.log(`  Savings: ${result.estimatedSavings.potentialCost} (100%!)`);
    console.log();
    console.log('🎯 KEY INSIGHT:');
    console.log('  The channel is now FULLY SEARCHABLE with metadata + captions!');
    console.log('  Users can start asking questions immediately.');
    console.log('  High-accuracy transcription (Tier 3) is only done when needed.');
    console.log();
    console.log('='.repeat(80));
    console.log('NEXT STEPS:');
    console.log('='.repeat(80));
    console.log();
    console.log('1. To test on-demand transcription (Phase 2):');
    console.log('   - Add AssemblyAI API key to .env:');
    console.log('     ASSEMBLYAI_API_KEY=your_key_here');
    console.log('   - Run: node test-triple-index.js');
    console.log();
    console.log('2. To integrate with your app:');
    console.log('   - Use: POST /api/triple-index/channel/import');
    console.log('   - Body: { "channelUrl": "https://youtube.com/@channel", "userId": "..." }');
    console.log();
    console.log('3. To process videos on-demand (when user asks deep question):');
    console.log('   - Use: POST /api/triple-index/video/process');
    console.log('   - Body: { "videoId": "...", "channelId": "...", "userId": "..." }');
    console.log();

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error('\nStack trace:', error.stack);
  }
}

console.log('🚀 Starting Phase 1 test (this will take 30-60 seconds)...\n');

testPhase1Only()
  .then(() => {
    console.log('✓ Test complete!');
    process.exit(0);
  })
  .catch(error => {
    console.error('✗ Fatal error:', error);
    process.exit(1);
  });
