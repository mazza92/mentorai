#!/usr/bin/env node

/**
 * Generate public insights in batch for channels (for SEO indexing).
 *
 * Usage:
 *   node scripts/generate-insights-batch.js [channelId] [options]
 *
 * Modes:
 *   <channelId>       Process a specific channel
 *   --crawl-all       Process ALL imported channels automatically
 *
 * Options:
 *   --count=N         Max insights per channel (default: 10, max: 200)
 *   --all             Process all available videos per channel (sets count=200)
 *   --publish         Auto-publish generated insights
 *   --skip-existing   Skip videos that already have insights (recommended)
 *   --stats           Show stats only (no generation)
 *   --no-revalidate   Skip cache revalidation after generation
 *
 * Examples:
 *   # Process single channel
 *   node scripts/generate-insights-batch.js UCloXqLhp_KGhHBe1kwaL2Tg --stats
 *   node scripts/generate-insights-batch.js UCloXqLhp_KGhHBe1kwaL2Tg --all --skip-existing --publish
 *
 *   # Process ALL channels automatically
 *   node scripts/generate-insights-batch.js --crawl-all --stats
 *   node scripts/generate-insights-batch.js --crawl-all --all --skip-existing --publish
 *
 * Env:
 *   BACKEND_URL   Base URL of the backend API (default: production Railway)
 *   FRONTEND_URL  Base URL of the frontend (default: production Vercel)
 */

const channelId = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : null;
const crawlAll = process.argv.includes('--crawl-all');
const countArg = process.argv.find((a) => a.startsWith('--count='));
const useAll = process.argv.includes('--all');
const count = useAll ? 200 : (countArg ? parseInt(countArg.split('=')[1], 10) || 10 : 10);
const publish = process.argv.includes('--publish');
const skipExisting = process.argv.includes('--skip-existing');
const statsOnly = process.argv.includes('--stats');
const noRevalidate = process.argv.includes('--no-revalidate');

const defaultBackendUrl = 'https://mentorai-production.up.railway.app';
const defaultFrontendUrl = 'https://lurnia.app';
const backendUrl = (process.env.BACKEND_URL || defaultBackendUrl).replace(/\/$/, '');
const frontendUrl = (process.env.FRONTEND_URL || defaultFrontendUrl).replace(/\/$/, '');

// ANSI colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
  magenta: '\x1b[35m'
};

function c(color, text) {
  return `${colors[color]}${text}${colors.reset}`;
}

if (!channelId && !crawlAll) {
  console.error('Usage: node scripts/generate-insights-batch.js [channelId] [options]\n');
  console.error('Modes:');
  console.error('  <channelId>       Process a specific channel');
  console.error('  --crawl-all       Process ALL imported channels automatically\n');
  console.error('Options:');
  console.error('  --count=N         Max insights per channel (default: 10, max: 200)');
  console.error('  --all             Process all available videos per channel (sets count=200)');
  console.error('  --publish         Auto-publish generated insights');
  console.error('  --skip-existing   Skip videos that already have insights (recommended)');
  console.error('  --stats           Show channel stats only (no generation)');
  console.error('  --no-revalidate   Skip cache revalidation after generation\n');
  console.error('Examples:');
  console.error('  # Single channel');
  console.error('  node scripts/generate-insights-batch.js UCloXqLhp_KGhHBe1kwaL2Tg --stats');
  console.error('  node scripts/generate-insights-batch.js UCloXqLhp_KGhHBe1kwaL2Tg --all --skip-existing --publish\n');
  console.error('  # All channels');
  console.error('  node scripts/generate-insights-batch.js --crawl-all --stats');
  console.error('  node scripts/generate-insights-batch.js --crawl-all --all --skip-existing --publish');
  process.exit(1);
}

async function getAllChannels() {
  const url = `${backendUrl}/api/public-insights/all-channels`;
  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || res.statusText);
  }

  return data;
}

async function getChannelStats(chId) {
  const url = `${backendUrl}/api/public-insights/channel-stats/${chId}`;
  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || res.statusText);
  }

  return data.data;
}

async function generateBatch(chId) {
  const url = `${backendUrl}/api/public-insights/generate-batch`;
  const body = JSON.stringify({ channelId: chId, count, publish, skipExisting });

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || res.statusText);
  }

  return data.data;
}

async function revalidateCache(slugs = []) {
  const url = `${frontendUrl}/api/revalidate`;

  // Always revalidate the directory page
  const paths = ['/guides'];

  // Also revalidate individual new pages (limit to first 10 to avoid huge requests)
  slugs.slice(0, 10).forEach(slug => {
    paths.push(`/guides/${slug}`);
  });

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paths })
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      console.log(c('yellow', `  Cache revalidation warning: ${data.error || res.statusText}`));
      return false;
    }

    return data.revalidated || [];
  } catch (error) {
    console.log(c('yellow', `  Cache revalidation skipped: ${error.message}`));
    return false;
  }
}

async function notifyIndexNow(slugs = []) {
  if (slugs.length === 0) return false;

  const url = `${frontendUrl}/api/indexnow`;

  // Build URLs for new pages
  const urls = ['/guides', ...slugs.map(slug => `/guides/${slug}`)];

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls })
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      console.log(c('yellow', `  IndexNow warning: ${data.error || res.statusText}`));
      return false;
    }

    return data.submitted || 0;
  } catch (error) {
    console.log(c('yellow', `  IndexNow skipped: ${error.message}`));
    return false;
  }
}

function printStats(stats) {
  console.log('\n' + c('bold', '=== Channel Stats ==='));
  console.log(`Channel: ${c('cyan', stats.channelName)} (${stats.channelId})`);
  console.log('');
  console.log(`  Total videos:            ${c('bold', stats.totalVideos)}`);
  console.log(`  With transcript:         ${c('green', stats.videosWithTranscript)}`);
  console.log(`  Without transcript:      ${c('dim', stats.videosWithoutTranscript)}`);
  console.log('');
  console.log(`  Existing insights:       ${c('blue', stats.existingInsights)}`);
  console.log(`    - Published:           ${c('green', stats.publishedInsights)}`);
  console.log(`    - Draft:               ${c('yellow', stats.draftInsights)}`);
  console.log('');
  console.log(`  ${c('magenta', 'Available for generation:')} ${c('bold', stats.availableForGeneration)}`);
  console.log('');
}

function printAllChannelsStats(data) {
  console.log('\n' + c('bold', '=== All Channels Overview ==='));
  console.log('');
  console.log(`  Total channels:          ${c('bold', data.summary.totalChannels)}`);
  console.log(`  Channels with videos:    ${c('green', data.summary.channelsWithAvailable)}`);
  console.log(`  Channels complete:       ${c('blue', data.summary.channelsComplete)}`);
  console.log(`  Total videos available:  ${c('magenta', data.summary.totalAvailableVideos)}`);
  console.log('');

  // Print table of channels
  console.log(c('bold', 'Channels:'));
  console.log(c('dim', '─'.repeat(90)));
  console.log(`  ${c('bold', 'Channel Name'.padEnd(40))} ${c('bold', 'Videos'.padStart(8))} ${c('bold', 'With Tr.'.padStart(10))} ${c('bold', 'Insights'.padStart(10))} ${c('bold', 'Available'.padStart(10))} ${c('bold', 'Status'.padStart(10))}`);
  console.log(c('dim', '─'.repeat(90)));

  for (const ch of data.data) {
    const name = ch.channelName.length > 38 ? ch.channelName.slice(0, 35) + '...' : ch.channelName;
    const status = ch.isComplete ? c('green', '✓ Done') : c('yellow', 'Pending');
    const available = ch.availableForGeneration > 0 ? c('magenta', String(ch.availableForGeneration).padStart(10)) : c('dim', '0'.padStart(10));

    console.log(`  ${name.padEnd(40)} ${String(ch.totalVideos).padStart(8)} ${String(ch.videosWithTranscript).padStart(10)} ${String(ch.existingInsights).padStart(10)} ${available} ${status.padStart(10)}`);
  }
  console.log(c('dim', '─'.repeat(90)));
  console.log('');
}

function printResults(result) {
  console.log('\n' + c('bold', '=== Generation Results ==='));
  console.log(`Channel: ${c('cyan', result.channelName)}`);
  console.log('');

  // Stats table
  console.log('  Videos with transcript:  ' + c('bold', result.totalVideosWithTranscript));
  console.log('  Already have insights:   ' + c('dim', result.alreadyHaveInsights));
  console.log('  Processed this run:      ' + c('bold', result.candidatesProcessed));
  console.log('  Remaining available:     ' + c('magenta', result.remainingAvailable));
  console.log('');

  // Results
  console.log(c('green', `  NEW insights created:    ${result.newlyCreated}`));
  if (result.updated > 0) {
    console.log(c('yellow', `  Existing updated:        ${result.updated}`));
  }
  if (result.errors > 0) {
    console.log(c('red', `  Errors:                  ${result.errors}`));
  }
  console.log('');

  // List newly created
  if (result.newlyCreatedList?.length > 0) {
    console.log(c('green', 'New insights:'));
    result.newlyCreatedList.forEach((r, i) => {
      const title = r.videoTitle?.slice(0, 55) + (r.videoTitle?.length > 55 ? '...' : '');
      console.log(`  ${i + 1}. ${title}`);
      console.log(`     ${c('dim', frontendUrl + '/guides/' + r.slug)} [${r.status}]`);
    });
    console.log('');
  }

  // List updated (if any and not too many)
  if (result.updatedList?.length > 0 && result.updatedList.length <= 5) {
    console.log(c('yellow', 'Updated insights:'));
    result.updatedList.forEach((r) => {
      const title = r.videoTitle?.slice(0, 55) + (r.videoTitle?.length > 55 ? '...' : '');
      console.log(`  - ${title} [${r.status}]`);
    });
    console.log('');
  }

  // List errors
  if (result.errorsList?.length > 0) {
    console.log(c('red', 'Errors:'));
    result.errorsList.forEach((e) => {
      console.log(`  - ${e.videoId}: ${e.error}`);
    });
    console.log('');
  }

  // Summary
  const total = result.newlyCreated + result.updated;
  if (total > 0) {
    console.log(c('bold', `Total: ${total} insights generated/updated`));

    // Show helpful tips based on the situation
    const stillNeedInsights = result.videosStillNeedingInsights || 0;
    if (stillNeedInsights > 0 && !result.skipExistingUsed) {
      // User ran without --skip-existing and there are videos still without insights
      console.log(c('yellow', `\nNote: ${stillNeedInsights} video(s) still don't have insights.`));
      console.log(c('dim', `Run with --skip-existing to generate insights for them:`));
      console.log(c('cyan', `  node scripts/generate-insights-batch.js ${result.channelId} --count=${stillNeedInsights} --skip-existing --publish`));
    } else if (result.remainingAvailable > 0) {
      console.log(c('dim', `Tip: Run again to process ${result.remainingAvailable} more videos`));
    }
  } else if (result.remainingAvailable === 0 && result.alreadyHaveInsights > 0) {
    console.log(c('green', 'All available videos already have insights!'));
  }

  return result;
}

async function processChannel(chId, channelName = null) {
  // Show stats first
  console.log(`\nFetching stats for ${channelName ? c('cyan', channelName) : chId}...`);
  const stats = await getChannelStats(chId);
  printStats(stats);

  if (statsOnly) {
    return { skipped: true, reason: 'stats-only' };
  }

  // Check if there are videos available
  if (stats.availableForGeneration === 0 && skipExisting) {
    console.log(c('green', 'No new videos available for generation.'));
    console.log(c('dim', 'All videos with transcripts already have insights.'));
    return { skipped: true, reason: 'complete' };
  }

  // Show what we're about to do
  console.log(c('bold', '=== Starting Generation ==='));
  console.log(`  Target count: ${c('bold', count)}${useAll ? ' (--all)' : ''}`);
  console.log(`  Publish: ${publish ? c('green', 'yes') : c('dim', 'no')}`);
  console.log(`  Skip existing: ${skipExisting ? c('green', 'yes') : c('yellow', 'no (will re-generate)')}`);
  console.log('');
  console.log('Generating insights... (this may take a while)');

  const result = await generateBatch(chId);
  printResults(result);

  return result;
}

async function runCrawlAll() {
  console.log(c('bold', '\nLurnia Batch Insight Generator - CRAWL ALL MODE'));
  console.log(c('dim', `Backend: ${backendUrl}`));
  console.log(c('dim', `Frontend: ${frontendUrl}`));
  console.log('');

  // Get all channels
  console.log('Fetching all channels...');
  const allChannelsData = await getAllChannels();

  if (allChannelsData.data.length === 0) {
    console.log(c('yellow', 'No channels found in the database.'));
    return;
  }

  printAllChannelsStats(allChannelsData);

  if (statsOnly) {
    return;
  }

  // Filter channels that need processing
  const channelsToProcess = allChannelsData.data.filter(ch => ch.availableForGeneration > 0);

  if (channelsToProcess.length === 0) {
    console.log(c('green', 'All channels are complete! No videos need insight generation.'));
    return;
  }

  console.log(c('bold', `\n=== Processing ${channelsToProcess.length} channel(s) ===\n`));

  // Track overall stats
  const overallStats = {
    channelsProcessed: 0,
    channelsSkipped: 0,
    totalNewlyCreated: 0,
    totalUpdated: 0,
    totalErrors: 0,
    allNewSlugs: []
  };

  for (let i = 0; i < channelsToProcess.length; i++) {
    const channel = channelsToProcess[i];
    console.log(c('bold', `\n${'═'.repeat(60)}`));
    console.log(c('bold', `Channel ${i + 1}/${channelsToProcess.length}: ${c('cyan', channel.channelName)}`));
    console.log(c('bold', `${'═'.repeat(60)}`));

    try {
      const result = await processChannel(channel.channelId, channel.channelName);

      if (result.skipped) {
        overallStats.channelsSkipped++;
      } else {
        overallStats.channelsProcessed++;
        overallStats.totalNewlyCreated += result.newlyCreated || 0;
        overallStats.totalUpdated += result.updated || 0;
        overallStats.totalErrors += result.errors || 0;

        // Collect slugs for cache revalidation
        if (result.newlyCreatedList) {
          overallStats.allNewSlugs.push(...result.newlyCreatedList.map(r => r.slug));
        }
      }
    } catch (error) {
      console.error(c('red', `Error processing channel ${channel.channelName}: ${error.message}`));
      overallStats.totalErrors++;
    }

    // Small delay between channels to avoid overwhelming the API
    if (i < channelsToProcess.length - 1) {
      console.log(c('dim', '\nWaiting 2 seconds before next channel...'));
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  // Print overall summary
  console.log('\n' + c('bold', '═'.repeat(60)));
  console.log(c('bold', '=== OVERALL SUMMARY ==='));
  console.log(c('bold', '═'.repeat(60)));
  console.log('');
  console.log(`  Channels processed:      ${c('bold', overallStats.channelsProcessed)}`);
  console.log(`  Channels skipped:        ${c('dim', overallStats.channelsSkipped)}`);
  console.log('');
  console.log(`  ${c('green', 'Total NEW insights:')}       ${c('bold', overallStats.totalNewlyCreated)}`);
  console.log(`  ${c('yellow', 'Total updated:')}           ${c('bold', overallStats.totalUpdated)}`);
  if (overallStats.totalErrors > 0) {
    console.log(`  ${c('red', 'Total errors:')}            ${c('bold', overallStats.totalErrors)}`);
  }
  console.log('');

  // Revalidate cache for all new insights
  const totalGenerated = overallStats.totalNewlyCreated + overallStats.totalUpdated;
  if (totalGenerated > 0 && !noRevalidate) {
    console.log('Revalidating frontend cache...');
    const revalidated = await revalidateCache(overallStats.allNewSlugs.slice(0, 20));

    if (revalidated && revalidated.length > 0) {
      console.log(c('green', `  Cache cleared for ${revalidated.length} path(s)`));
    }

    // Notify search engines
    if (overallStats.allNewSlugs.length > 0) {
      console.log('Notifying search engines (IndexNow)...');
      const submitted = await notifyIndexNow(overallStats.allNewSlugs.slice(0, 50));
      if (submitted) {
        console.log(c('green', `  Submitted ${submitted} URL(s) to Bing/Yandex`));
      }
    }

    console.log(c('dim', `\nAll insights live at ${frontendUrl}/guides`));
  }
}

async function runSingleChannel() {
  console.log(c('bold', '\nLurnia Batch Insight Generator'));
  console.log(c('dim', `Backend: ${backendUrl}`));
  console.log(c('dim', `Frontend: ${frontendUrl}`));
  console.log('');

  const result = await processChannel(channelId);

  // Revalidate cache if we generated/updated anything
  if (!result.skipped) {
    const total = (result.newlyCreated || 0) + (result.updated || 0);
    if (total > 0 && !noRevalidate) {
      console.log('');
      console.log('Revalidating frontend cache...');

      const newSlugs = result.newlyCreatedList?.map(r => r.slug) || [];
      const revalidated = await revalidateCache(newSlugs);

      if (revalidated && revalidated.length > 0) {
        console.log(c('green', `  Cache cleared for ${revalidated.length} path(s)`));
      }

      if (newSlugs.length > 0) {
        console.log('Notifying search engines (IndexNow)...');
        const submitted = await notifyIndexNow(newSlugs);
        if (submitted) {
          console.log(c('green', `  Submitted ${submitted} URL(s) to Bing/Yandex`));
        }
      }

      console.log(c('dim', `New insights live at ${frontendUrl}/guides`));
    }
  }
}

async function main() {
  if (crawlAll) {
    await runCrawlAll();
  } else {
    await runSingleChannel();
  }
}

main().catch((e) => {
  console.error(c('red', '\nError: ') + (e.message || e));
  process.exit(1);
});
