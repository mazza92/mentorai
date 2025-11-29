const axios = require('axios');

/**
 * Test script to debug YouTube transcript scraping
 * Tests a single video ID to see what's going wrong
 */

async function testVideoScraping(videoId) {
  console.log(`\n🔍 Testing video: ${videoId}`);
  console.log(`URL: https://www.youtube.com/watch?v=${videoId}\n`);

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'DNT': '1',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Cache-Control': 'max-age=0'
  };

  try {
    // Step 1: Fetch page
    console.log('Step 1: Fetching video page...');
    const response = await axios.get(`https://www.youtube.com/watch?v=${videoId}`, {
      headers,
      timeout: 15000
    });

    const html = response.data;
    console.log(`✓ Page fetched: ${html.length} characters\n`);

    // Step 2: Try to find ytInitialPlayerResponse
    console.log('Step 2: Looking for ytInitialPlayerResponse...');

    // Check if the string exists at all
    if (html.includes('ytInitialPlayerResponse')) {
      console.log('✓ Found "ytInitialPlayerResponse" in HTML\n');

      // Try different extraction patterns
      const patterns = [
        { name: 'Pattern 1 (var, non-greedy)', regex: /var ytInitialPlayerResponse\s*=\s*({.+?});/ },
        { name: 'Pattern 2 (no var, non-greedy)', regex: /ytInitialPlayerResponse\s*=\s*({.+?});/ },
        { name: 'Pattern 3 (var, greedy)', regex: /var ytInitialPlayerResponse\s*=\s*({.+});/s },
        { name: 'Pattern 4 (no var, greedy)', regex: /ytInitialPlayerResponse\s*=\s*({.+});/s },
      ];

      for (const { name, regex } of patterns) {
        console.log(`\nTrying ${name}...`);
        const match = html.match(regex);

        if (match && match[1]) {
          const jsonStr = match[1];
          console.log(`  - Match found: ${jsonStr.substring(0, 100)}...`);
          console.log(`  - Length: ${jsonStr.length} characters`);

          try {
            const parsed = JSON.parse(jsonStr);
            console.log(`  ✓ Successfully parsed JSON!`);

            // Check for captions
            const captions = parsed?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
            if (captions && captions.length > 0) {
              console.log(`  ✓ Found ${captions.length} caption tracks:`);
              captions.forEach((track, i) => {
                console.log(`    ${i + 1}. ${track.languageCode} (${track.kind || 'standard'})`);
              });
            } else {
              console.log(`  ✗ No caption tracks found in parsed data`);
              console.log(`  - Has captions object: ${!!parsed?.captions}`);
              console.log(`  - Has playerCaptionsTracklistRenderer: ${!!parsed?.captions?.playerCaptionsTracklistRenderer}`);
            }

            // This pattern worked, stop here
            break;

          } catch (parseError) {
            console.log(`  ✗ Failed to parse JSON: ${parseError.message}`);
          }
        } else {
          console.log(`  ✗ No match found`);
        }
      }

    } else {
      console.log('✗ "ytInitialPlayerResponse" not found in HTML');
      console.log('\nSearching for alternative patterns...');

      if (html.includes('captions')) {
        console.log('✓ Found "captions" somewhere in HTML');
      }

      if (html.includes('captionTracks')) {
        console.log('✓ Found "captionTracks" somewhere in HTML');
      }
    }

  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
    if (error.response) {
      console.error(`Response status: ${error.response.status}`);
    }
  }
}

// Test with one of the failing video IDs from the logs
const testVideoId = 'DfiqXX7R5Fw'; // From Will Cannon's channel

testVideoScraping(testVideoId)
  .then(() => {
    console.log('\n✅ Test complete\n');
  })
  .catch(err => {
    console.error('\n❌ Test failed:', err);
  });
