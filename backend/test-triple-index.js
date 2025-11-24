const tripleIndexService = require('./services/tripleLayeredIndexService');

/**
 * Test script for Triple-Layered Index System
 *
 * Demonstrates:
 * - PHASE 1: Immediate ingestion (metadata + captions)
 * - PHASE 2: On-demand processing (audio transcription)
 * - PHASE 3: Background optimization (smart queue)
 */

async function runTripleIndexDemo() {
  console.log('='.repeat(80));
  console.log('🎯 TRIPLE-LAYERED INDEX SYSTEM - DEMONSTRATION');
  console.log('='.repeat(80));
  console.log();

  // Test with a small channel for demo purposes
  const testChannelId = 'UCW5YeuERMmlnqo4oq8vwUpg'; // Fireship (tech channel, good test)

  try {
    // ============================================================================
    // PHASE 1: IMMEDIATE INGESTION (Synchronous)
    // ============================================================================
    console.log('📚 PHASE 1: IMMEDIATE INGESTION');
    console.log('-'.repeat(80));
    console.log('Goal: Make channel instantly searchable with free data');
    console.log('Processing: Tier 1 (Metadata) + Tier 2 (Captions)');
    console.log();

    const phase1Start = Date.now();
    const phase1Result = await tripleIndexService.ingestChannelImmediate(
      testChannelId,
      'test-user-123'
    );
    const phase1Time = ((Date.now() - phase1Start) / 1000).toFixed(1);

    console.log('\n✅ PHASE 1 COMPLETE');
    console.log(`   Processing time: ${phase1Time}s`);
    console.log(`   Videos indexed: ${phase1Result.videoCount}`);
    console.log(`   Tier 1 (Metadata): ${phase1Result.tierStats.tier1Percentage}%`);
    console.log(`   Tier 2 (Captions): ${phase1Result.tierStats.tier2Percentage}%`);
    console.log(`   Tier 3 (Transcription): ${phase1Result.tierStats.tier3Percentage}%`);
    console.log(`   Estimated savings: ${phase1Result.estimatedSavings.actualSavings}`);
    console.log('\n💡 Channel is now INSTANTLY SEARCHABLE with metadata + captions!');
    console.log('   Cost so far: $0.00 (100% free)\n');

    // ============================================================================
    // PHASE 2: ON-DEMAND PROCESSING (User-Triggered)
    // ============================================================================
    console.log('\n' + '='.repeat(80));
    console.log('🎯 PHASE 2: ON-DEMAND PROCESSING');
    console.log('-'.repeat(80));
    console.log('Scenario: User asks deep question about specific video');
    console.log('Goal: Get high-accuracy transcript for better answers');
    console.log();

    // Simulate: User asks about a specific video that only has Tier 1/2 data
    console.log('User asks: "What exactly does the video say about authentication?"');
    console.log('System detects: Tier 1/2 insufficient (low confidence)');
    console.log('Action: Queue video for Tier 3 processing\n');

    // Get first video ID from result
    const { getFirestore } = require('./config/firestore');
    const { firestore } = getFirestore();
    const channelRef = firestore.collection('channels').doc(testChannelId);
    const videosSnapshot = await channelRef.collection('videos').limit(1).get();

    if (!videosSnapshot.empty) {
      const videoDoc = videosSnapshot.docs[0];
      const videoId = videoDoc.id;
      const videoData = videoDoc.data();

      console.log(`Processing video: "${videoData.title.substring(0, 60)}..."`);
      console.log(`Duration: ${(videoData.duration / 60).toFixed(1)} minutes`);
      console.log(`Estimated cost: $${tripleIndexService.calculateTranscriptionCost(videoData.duration)}\n`);

      console.log('⏳ Extracting audio + transcribing (this takes ~45 seconds)...');
      console.log('   User sees: "Retrieving deep knowledge for this video..."');
      console.log();

      const phase2Start = Date.now();
      const phase2Result = await tripleIndexService.processVideoOnDemand(
        videoId,
        testChannelId,
        'test-user-123'
      );
      const phase2Time = ((Date.now() - phase2Start) / 1000).toFixed(1);

      console.log('\n✅ PHASE 2 COMPLETE');
      console.log(`   Processing time: ${phase2Time}s`);
      console.log(`   Word count: ${phase2Result.wordCount}`);
      console.log(`   Confidence: ${(phase2Result.confidence * 100).toFixed(1)}%`);
      console.log(`   Cost: $${phase2Result.cost}`);
      console.log('\n💡 Video now has FULL HIGH-ACCURACY TRANSCRIPT!');
      console.log('   User gets detailed answer with exact quotes\n');
    }

    // ============================================================================
    // PHASE 3: BACKGROUND OPTIMIZATION (Idle Time Processing)
    // ============================================================================
    console.log('\n' + '='.repeat(80));
    console.log('🌙 PHASE 3: BACKGROUND OPTIMIZATION');
    console.log('-'.repeat(80));
    console.log('Scenario: 2 AM - System is idle');
    console.log('Goal: Pre-process videos to improve future response quality');
    console.log('Strategy: Smart prioritization (newest, shortest, caption failures)');
    console.log();

    console.log('Configuration:');
    console.log('  Budget: $10 per night');
    console.log('  Max videos: 5 per run');
    console.log('  Priority: Smart (newest → shortest → caption failures)');
    console.log();

    console.log('⏳ Processing background queue...\n');

    const phase3Start = Date.now();
    const phase3Result = await tripleIndexService.processBackgroundQueue(
      testChannelId,
      {
        maxVideos: 2, // Limit to 2 for demo
        maxCost: 5,   // $5 budget for demo
        priorityStrategy: 'smart'
      }
    );
    const phase3Time = ((Date.now() - phase3Start) / 60).toFixed(1);

    console.log('\n✅ PHASE 3 COMPLETE');
    console.log(`   Processing time: ${phase3Time} minutes`);
    console.log(`   Videos processed: ${phase3Result.processed}`);
    console.log(`   Videos failed: ${phase3Result.failed}`);
    console.log(`   Videos skipped: ${phase3Result.skipped} (budget limit)`);
    console.log(`   Total cost: $${phase3Result.totalCost.toFixed(2)}`);
    console.log();

    if (phase3Result.videos.length > 0) {
      console.log('   Processed videos:');
      phase3Result.videos.forEach(video => {
        const status = video.status === 'success' ? '✓' : '✗';
        const info = video.status === 'success'
          ? `$${video.cost}`
          : video.error;
        console.log(`     ${status} ${video.title.substring(0, 50)}... (${info})`);
      });
    }

    // ============================================================================
    // FINAL STATISTICS
    // ============================================================================
    console.log('\n' + '='.repeat(80));
    console.log('📊 FINAL CHANNEL STATISTICS');
    console.log('-'.repeat(80));

    const finalStats = await tripleIndexService.updateChannelTierStats(testChannelId);

    console.log(`Total videos: ${finalStats.totalVideos}`);
    console.log();
    console.log(`Tier 1 (Metadata):      ${finalStats.tier1Count}/${finalStats.totalVideos} (${finalStats.tier1Percentage}%) - FREE`);
    console.log(`Tier 2 (Captions):      ${finalStats.tier2Count}/${finalStats.totalVideos} (${finalStats.tier2Percentage}%) - FREE`);
    console.log(`Tier 3 (Transcription): ${finalStats.tier3Count}/${finalStats.totalVideos} (${finalStats.tier3Percentage}%) - PAID`);
    console.log();

    const totalSpent = phase2Result ? phase2Result.cost + phase3Result.totalCost : phase3Result.totalCost;
    const potentialCost = finalStats.totalVideos * 1.50;
    const savings = potentialCost - totalSpent;
    const savingsPercent = ((savings / potentialCost) * 100).toFixed(1);

    console.log('💰 COST ANALYSIS:');
    console.log(`   If transcribing ALL videos: $${potentialCost.toFixed(2)}`);
    console.log(`   Actual cost (smart strategy): $${totalSpent.toFixed(2)}`);
    console.log(`   Total savings: $${savings.toFixed(2)} (${savingsPercent}%)`);
    console.log();

    console.log('='.repeat(80));
    console.log('✅ TRIPLE-LAYERED INDEX DEMONSTRATION COMPLETE');
    console.log('='.repeat(80));
    console.log();
    console.log('KEY TAKEAWAYS:');
    console.log('  • Channel becomes searchable INSTANTLY (Tier 1+2)');
    console.log('  • High-accuracy transcripts processed ON-DEMAND (Tier 3)');
    console.log('  • Background optimization spreads cost over time');
    console.log('  • 80-90% cost savings vs. transcribing everything upfront');
    console.log('  • Users get fast responses with option for deeper answers');
    console.log();

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error.stack);
  }
}

// Run the demo
console.log('🚀 Starting Triple-Layered Index demonstration...\n');
console.log('⚠️  Note: This will:');
console.log('   1. Import a real YouTube channel (Tier 1+2)');
console.log('   2. Process 1-3 videos with audio transcription (Tier 3)');
console.log('   3. Cost: ~$3-5 (charged to your AssemblyAI account)');
console.log();
console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...\n');

setTimeout(() => {
  runTripleIndexDemo()
    .then(() => {
      console.log('✓ Demo complete!');
      process.exit(0);
    })
    .catch(error => {
      console.error('✗ Fatal error:', error);
      process.exit(1);
    });
}, 5000);
