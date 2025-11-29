const axios = require('axios');

/**
 * Comprehensive test to discover where YouTube stores auto-generated transcripts
 */

async function discoverTranscriptLocation(videoId) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`Testing: https://www.youtube.com/watch?v=${videoId}`);
  console.log('='.repeat(70));

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9'
  };

  try {
    // Fetch page
    const response = await axios.get(`https://www.youtube.com/watch?v=${videoId}`, {
      headers,
      timeout: 15000
    });

    const html = response.data;

    console.log(`\n✓ Page fetched: ${html.length} characters\n`);

    // 1. Check ytInitialPlayerResponse (what we're currently using)
    console.log('1️⃣  Checking ytInitialPlayerResponse...');
    const playerMatch = html.match(/var ytInitialPlayerResponse\s*=\s*({.+?});/);
    if (playerMatch) {
      const playerResponse = JSON.parse(playerMatch[1]);
      const captionTracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;

      if (captionTracks && captionTracks.length > 0) {
        console.log(`   ✓ Found ${captionTracks.length} caption tracks:`);
        captionTracks.forEach(track => {
          console.log(`     - ${track.languageCode} (kind: ${track.kind || 'manual'}${track.kind === 'asr' ? ' ← AUTO-GENERATED!' : ''})`);
        });
      } else {
        console.log('   ✗ No caption tracks found');
      }
    }

    // 2. Check ytInitialData (contains engagement panels like transcript button)
    console.log('\n2️⃣  Checking ytInitialData for engagement panels...');
    const dataMatch = html.match(/var ytInitialData\s*=\s*({.+?});/);
    if (dataMatch) {
      const initialData = JSON.parse(dataMatch[1]);

      // Look for engagement panels
      const panels = initialData?.engagementPanels || [];
      console.log(`   Found ${panels.length} engagement panels`);

      for (const panel of panels) {
        const panelRenderer = panel.engagementPanelSectionListRenderer;
        if (!panelRenderer) continue;

        const identifier = panelRenderer.panelIdentifier;
        console.log(`   - Panel: ${identifier}`);

        if (identifier === 'engagement-panel-searchable-transcript') {
          console.log('     ✓ FOUND TRANSCRIPT PANEL!');

          // Try to extract transcript data
          const content = panelRenderer.content;
          if (content) {
            console.log('     ✓ Panel has content data');
            console.log('     Structure:', JSON.stringify(content).substring(0, 200));
          }
        }
      }
    }

    // 3. Search for "Show transcript" text
    console.log('\n3️⃣  Searching for transcript-related text...');
    if (html.includes('Show transcript')) {
      console.log('   ✓ Found "Show transcript" text in page');
    } else {
      console.log('   ✗ "Show transcript" not found');
    }

    if (html.includes('Transcript')) {
      console.log('   ✓ Found "Transcript" text in page');
    }

    // 4. Check for timedtext endpoints
    console.log('\n4️⃣  Checking for timedtext URLs...');
    const timedtextMatches = html.match(/timedtext[^"']*/g);
    if (timedtextMatches) {
      console.log(`   ✓ Found ${timedtextMatches.length} timedtext references`);
      console.log(`   Example: ${timedtextMatches[0]}`);
    } else {
      console.log('   ✗ No timedtext URLs found');
    }

  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
  }
}

// Test with both videos
async function runTests() {
  console.log('\n🧪 TRANSCRIPT DISCOVERY TEST\n');

  // Video that worked (Will Cannon - has ASR captions)
  await discoverTranscriptLocation('DfiqXX7R5Fw');

  // Video that failed (Instantly - might have transcript panel)
  await discoverTranscriptLocation('jpThCV6qak8');

  console.log('\n' + '='.repeat(70));
  console.log('ANALYSIS COMPLETE');
  console.log('='.repeat(70));
}

runTests().catch(console.error);
