#!/usr/bin/env node

/**
 * Generate public insights in batch for a channel (for SEO indexing).
 *
 * Usage:
 *   node scripts/generate-insights-batch.js <channelId> [options]
 *
 * Options:
 *   --count=N        Max insights to generate (default: 10, max: 200)
 *   --all            Process all available videos (sets count=200)
 *   --publish        Auto-publish generated insights
 *   --skip-existing  Skip videos that already have insights (recommended)
 *   --stats          Show channel stats only (no generation)
 *   --no-revalidate  Skip cache revalidation after generation
 *
 * Examples:
 *   node scripts/generate-insights-batch.js UCloXqLhp_KGhHBe1kwaL2Tg --stats
 *   node scripts/generate-insights-batch.js UCloXqLhp_KGhHBe1kwaL2Tg --all --skip-existing --publish
 *   node scripts/generate-insights-batch.js UCloXqLhp_KGhHBe1kwaL2Tg --count=50 --skip-existing --publish
 *
 * Env:
 *   BACKEND_URL   Base URL of the backend API (default: production Railway)
 *   FRONTEND_URL  Base URL of the frontend (default: production Vercel)
 */

const channelId = process.argv[2];
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

if (!channelId || channelId.startsWith('--')) {
  console.error('Usage: node scripts/generate-insights-batch.js <channelId> [options]\n');
  console.error('Options:');
  console.error('  --count=N        Max insights to generate (default: 10, max: 200)');
  console.error('  --all            Process all available videos (sets count=200)');
  console.error('  --publish        Auto-publish generated insights');
  console.error('  --skip-existing  Skip videos that already have insights (recommended)');
  console.error('  --stats          Show channel stats only (no generation)');
  console.error('  --no-revalidate  Skip cache revalidation after generation\n');
  console.error('Examples:');
  console.error('  node scripts/generate-insights-batch.js UCloXqLhp_KGhHBe1kwaL2Tg --stats');
  console.error('  node scripts/generate-insights-batch.js UCloXqLhp_KGhHBe1kwaL2Tg --all --skip-existing --publish');
  process.exit(1);
}

async function getChannelStats() {
  const url = `${backendUrl}/api/public-insights/channel-stats/${channelId}`;
  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || res.statusText);
  }

  return data.data;
}

async function generateBatch() {
  const url = `${backendUrl}/api/public-insights/generate-batch`;
  const body = JSON.stringify({ channelId, count, publish, skipExisting });

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

async function main() {
  console.log(c('bold', '\nLurnia Batch Insight Generator'));
  console.log(c('dim', `Backend: ${backendUrl}`));
  console.log(c('dim', `Frontend: ${frontendUrl}`));
  console.log('');

  // Always show stats first
  console.log('Fetching channel stats...');
  const stats = await getChannelStats();
  printStats(stats);

  if (statsOnly) {
    return;
  }

  // Check if there are videos available
  if (stats.availableForGeneration === 0 && skipExisting) {
    console.log(c('green', 'No new videos available for generation.'));
    console.log(c('dim', 'All videos with transcripts already have insights.'));
    return;
  }

  // Show what we're about to do
  console.log(c('bold', '=== Starting Generation ==='));
  console.log(`  Target count: ${c('bold', count)}${useAll ? ' (--all)' : ''}`);
  console.log(`  Publish: ${publish ? c('green', 'yes') : c('dim', 'no')}`);
  console.log(`  Skip existing: ${skipExisting ? c('green', 'yes') : c('yellow', 'no (will re-generate)')}`);
  console.log('');
  console.log('Generating insights... (this may take a while)');

  const result = await generateBatch();
  printResults(result);

  // Revalidate cache if we generated/updated anything
  const total = result.newlyCreated + result.updated;
  if (total > 0 && !noRevalidate) {
    console.log('');
    console.log('Revalidating frontend cache...');

    // Get slugs of newly created insights
    const newSlugs = result.newlyCreatedList?.map(r => r.slug) || [];
    const revalidated = await revalidateCache(newSlugs);

    if (revalidated && revalidated.length > 0) {
      console.log(c('green', `  Cache cleared for ${revalidated.length} path(s)`));
      console.log(c('dim', `  New insights should appear on ${frontendUrl}/guides immediately`));
    }
  }
}

main().catch((e) => {
  console.error(c('red', '\nError: ') + (e.message || e));
  process.exit(1);
});
