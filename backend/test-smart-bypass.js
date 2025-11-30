require('dotenv').config();
const smartBypass = require('./services/youtubeSmartBypass');

/**
 * Test YouTube Smart Bypass System
 *
 * Tests all 4 strategies:
 * 1. iOS Mobile API
 * 2. Android Mobile API
 * 3. Embed Player
 * 4. TV HTML5
 */
async function testSmartBypass() {
  console.log('='.repeat(80));
  console.log('Testing YouTube Smart Bypass - Multi-Strategy Bot Evasion');
  console.log('='.repeat(80));
  console.log('');

  // Test videos
  const testVideos = [
    { id: 'dQw4w9WgXcQ', title: 'Rick Astley - Never Gonna Give You Up' },
    { id: 'jNQXAC9IVRw', title: 'Me at the zoo (first YouTube video)' },
    { id: '9bZkp7q19f0', title: 'PSY - GANGNAM STYLE' }
  ];

  let totalSuccess = 0;
  let totalTests = 0;

  for (const video of testVideos) {
    console.log(`📝 Testing: ${video.title}`);
    console.log(`   Video ID: ${video.id}`);
    console.log('-'.repeat(80));

    totalTests++;

    try {
      const result = await smartBypass.fetchTranscript(video.id);

      if (result.success) {
        totalSuccess++;
        console.log(`✅ SUCCESS!`);
        console.log(`   Strategy: ${result.strategy}`);
        console.log(`   Word count: ${result.wordCount}`);
        console.log(`   Fetch time: ${result.fetchTime}s`);
        console.log(`   Preview: "${result.text.substring(0, 150)}..."`);
      } else {
        console.log(`❌ FAILED: ${result.error}`);
      }

    } catch (error) {
      console.log(`❌ ERROR: ${error.message}`);
    }

    console.log('');
  }

  console.log('='.repeat(80));
  console.log(`Results: ${totalSuccess}/${totalTests} videos fetched successfully`);
  console.log('='.repeat(80));
  console.log('');

  // Print strategy stats
  smartBypass.printStats();

  console.log('');
  console.log('='.repeat(80));
  if (totalSuccess === totalTests) {
    console.log('✅ All tests passed! Smart bypass is working perfectly.');
  } else if (totalSuccess > 0) {
    console.log(`⚠️ Partial success: ${totalSuccess}/${totalTests} videos fetched.`);
  } else {
    console.log('❌ All tests failed. Check YouTube API status.');
  }
  console.log('='.repeat(80));
}

// Run tests
testSmartBypass().catch(console.error);
