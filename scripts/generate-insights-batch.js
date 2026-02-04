#!/usr/bin/env node

/**
 * Generate public insights in batch for a channel (for SEO indexing).
 *
 * Usage:
 *   node scripts/generate-insights-batch.js <channelId> [--count=10] [--publish]
 *
 * Examples:
 *   node scripts/generate-insights-batch.js UCloXqLhp_KGhHBe1kwaL2Tg
 *   node scripts/generate-insights-batch.js UCloXqLhp_KGhHBe1kwaL2Tg --count=10 --publish
 *
 * Env:
 *   BACKEND_URL  Base URL of the API (default: production)
 */

const channelId = process.argv[2];
const countArg = process.argv.find((a) => a.startsWith('--count='));
const count = countArg ? parseInt(countArg.split('=')[1], 10) || 10 : 10;
const publish = process.argv.includes('--publish');

const defaultUrl = 'https://mentorai-production.up.railway.app';
const baseUrl = (process.env.BACKEND_URL || defaultUrl).replace(/\/$/, '');

if (!channelId || channelId.startsWith('--')) {
  console.error('Usage: node scripts/generate-insights-batch.js <channelId> [--count=10] [--publish]');
  console.error('Example: node scripts/generate-insights-batch.js UCloXqLhp_KGhHBe1kwaL2Tg --count=10 --publish');
  process.exit(1);
}

async function main() {
  const url = `${baseUrl}/api/public-insights/generate-batch`;
  const body = JSON.stringify({ channelId, count, publish });

  console.log(`Calling ${url}`);
  console.log(`Channel: ${channelId}, count: ${count}, publish: ${publish}\n`);

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    console.error('Error:', data.error || res.statusText);
    process.exit(1);
  }

  console.log('Success:', data.data.generated, 'insights generated');
  if (data.data.generatedList?.length) {
    data.data.generatedList.forEach((r) => {
      console.log('  -', r.videoTitle?.slice(0, 50) + (r.videoTitle?.length > 50 ? '…' : ''), `[${r.status}]`);
    });
  }
  if (data.data.errorsList?.length) {
    console.log('Errors:', data.data.errorsList);
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
