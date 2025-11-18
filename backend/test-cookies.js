#!/usr/bin/env node

/**
 * Test YouTube Cookies Configuration
 *
 * This script verifies that YouTube cookies are properly configured
 * Run this on Railway to diagnose cookie issues
 */

require('dotenv').config();

console.log('═══════════════════════════════════════');
console.log('🧪 YouTube Cookies Configuration Test');
console.log('═══════════════════════════════════════\n');

// Check if YOUTUBE_COOKIES env var exists
console.log('1. Environment Variable Check:');
console.log('   YOUTUBE_COOKIES exists:', !!process.env.YOUTUBE_COOKIES);

if (!process.env.YOUTUBE_COOKIES) {
  console.log('   ❌ YOUTUBE_COOKIES is not set!');
  console.log('   ');
  console.log('   Action Required:');
  console.log('   1. Go to Railway Dashboard → Your Project → Variables');
  console.log('   2. Add: YOUTUBE_COOKIES = <your base64 string>');
  console.log('   3. Redeploy');
  console.log('   ');
  console.log('   See YOUTUBE_COOKIES_GUIDE.md for instructions');
  process.exit(1);
}

// Check cookie format
console.log('   ✅ YOUTUBE_COOKIES is set');
console.log('   Length:', process.env.YOUTUBE_COOKIES.length, 'characters\n');

// Try to decode base64
console.log('2. Base64 Decoding Test:');
try {
  const decoded = Buffer.from(process.env.YOUTUBE_COOKIES, 'base64').toString('utf-8');
  console.log('   ✅ Successfully decoded from base64');
  console.log('   Decoded length:', decoded.length, 'bytes\n');

  // Check if it looks like Netscape cookies
  console.log('3. Cookie Format Validation:');
  const hasNetscapeHeader = decoded.includes('# Netscape HTTP Cookie File');
  const hasYouTubeDomain = decoded.includes('.youtube.com') || decoded.includes('youtube.com');

  console.log('   Has Netscape header:', hasNetscapeHeader ? '✅' : '⚠️  (not required)');
  console.log('   Contains YouTube domain:', hasYouTubeDomain ? '✅' : '❌');

  if (!hasYouTubeDomain) {
    console.log('   ❌ Cookies don\'t appear to be from YouTube!');
    console.log('   Make sure you exported cookies while logged into YouTube.com');
    process.exit(1);
  }

  // Count cookie lines (rough estimate)
  const cookieLines = decoded.split('\n').filter(line =>
    !line.startsWith('#') && line.trim().length > 0
  ).length;

  console.log('   Estimated cookie count:', cookieLines);

  if (cookieLines < 3) {
    console.log('   ⚠️  Very few cookies found - may not work');
    console.log('   Expected at least 5-10 cookies from YouTube');
  }

  console.log('\n4. Sample Cookie Preview:');
  const lines = decoded.split('\n');
  const sampleLines = lines.slice(0, 5);
  sampleLines.forEach((line, i) => {
    if (line.trim()) {
      console.log(`   ${i + 1}. ${line.substring(0, 80)}${line.length > 80 ? '...' : ''}`);
    }
  });

  console.log('\n═══════════════════════════════════════');
  console.log('✅ All checks passed!');
  console.log('═══════════════════════════════════════');
  console.log('\nYour YouTube cookies appear to be configured correctly.');
  console.log('If you\'re still getting bot detection errors:');
  console.log('1. The cookies may have expired (regenerate monthly)');
  console.log('2. You weren\'t logged into YouTube when extracting');
  console.log('3. YouTube may be blocking the Railway IP address');
  console.log('\nTry uploading a video to test.');

} catch (error) {
  console.log('   ❌ Failed to decode base64');
  console.log('   Error:', error.message);
  console.log('   ');
  console.log('   The YOUTUBE_COOKIES value is not valid base64.');
  console.log('   Please re-encode your cookies.txt file:');
  console.log('   node scripts/convert-cookies.js cookies.txt');
  process.exit(1);
}
