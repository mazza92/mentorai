#!/usr/bin/env node

/**
 * Diagnose YouTube Cookies Issues
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');

console.log('═══════════════════════════════════════');
console.log('🔍 YouTube Cookies Diagnostic Tool');
console.log('═══════════════════════════════════════\n');

if (!process.env.YOUTUBE_COOKIES) {
  console.log('❌ YOUTUBE_COOKIES environment variable not found!');
  process.exit(1);
}

try {
  // Decode from base64
  const decoded = Buffer.from(process.env.YOUTUBE_COOKIES, 'base64').toString('utf-8');

  console.log('✅ Successfully decoded base64');
  console.log('📏 Decoded length:', decoded.length, 'bytes\n');

  // Save to temp file for inspection
  const tempPath = path.join(__dirname, 'temp', 'decoded_cookies.txt');
  if (!fs.existsSync(path.join(__dirname, 'temp'))) {
    fs.mkdirSync(path.join(__dirname, 'temp'), { recursive: true });
  }
  fs.writeFileSync(tempPath, decoded);
  console.log('💾 Saved decoded cookies to:', tempPath, '\n');

  // Parse cookies
  const lines = decoded.split('\n');
  console.log('📄 Total lines:', lines.length);

  // Filter actual cookie lines (not comments or empty)
  const cookieLines = lines.filter(line => {
    const trimmed = line.trim();
    return trimmed.length > 0 && !trimmed.startsWith('#');
  });

  console.log('🍪 Cookie entries:', cookieLines.length, '\n');

  if (cookieLines.length === 0) {
    console.log('❌ No valid cookie entries found!');
    console.log('   The file may be incorrectly formatted.\n');
    process.exit(1);
  }

  // Check for important YouTube cookies
  const importantCookies = ['SID', 'HSID', 'SSID', 'LOGIN_INFO', 'SAPISID'];
  console.log('🔑 Checking for critical YouTube cookies:');

  const foundCookies = {};
  importantCookies.forEach(name => {
    const found = cookieLines.some(line => line.includes(`\t${name}\t`));
    foundCookies[name] = found;
    console.log(`   ${name}: ${found ? '✅' : '❌'}`);
  });

  const missingCount = Object.values(foundCookies).filter(v => !v).length;

  if (missingCount > 0) {
    console.log(`\n⚠️  ${missingCount} important cookie(s) missing!`);
    console.log('   This may cause authentication to fail.');
  }

  // Check cookie expiration
  console.log('\n📅 Checking cookie expiration:');
  const now = Math.floor(Date.now() / 1000);
  let expiredCount = 0;

  cookieLines.forEach((line, index) => {
    const parts = line.split('\t');
    if (parts.length >= 5) {
      const expiry = parseInt(parts[4]);
      if (!isNaN(expiry) && expiry !== 0 && expiry < now) {
        expiredCount++;
        if (expiredCount <= 3) { // Show first 3 expired
          const cookieName = parts.length >= 6 ? parts[5] : 'Unknown';
          const expiredDate = new Date(expiry * 1000).toISOString();
          console.log(`   ❌ ${cookieName} expired on ${expiredDate}`);
        }
      }
    }
  });

  if (expiredCount > 0) {
    console.log(`\n❌ ${expiredCount} cookie(s) have expired!`);
    console.log('   You need to re-extract fresh cookies from your browser.');
    console.log('   See YOUTUBE_COOKIES_GUIDE.md for instructions.\n');
  } else {
    console.log('   ✅ All cookies are still valid (not expired)');
  }

  // Check format
  console.log('\n📋 Cookie Format Check:');
  const hasNetscapeHeader = decoded.includes('# Netscape HTTP Cookie File');
  console.log('   Netscape header:', hasNetscapeHeader ? '✅' : '⚠️  Missing (may still work)');

  const hasYouTubeDomain = decoded.includes('.youtube.com');
  console.log('   YouTube domain:', hasYouTubeDomain ? '✅' : '❌ MISSING');

  // Sample first few lines
  console.log('\n📝 First 5 lines preview:');
  lines.slice(0, 5).forEach((line, i) => {
    console.log(`   ${i + 1}. ${line.substring(0, 80)}${line.length > 80 ? '...' : ''}`);
  });

  console.log('\n═══════════════════════════════════════');
  if (expiredCount > 0) {
    console.log('❌ DIAGNOSIS: Cookies have expired');
    console.log('   ACTION: Re-extract cookies from browser');
  } else if (missingCount > 0) {
    console.log('⚠️  DIAGNOSIS: Missing critical cookies');
    console.log('   ACTION: Make sure you\'re logged into YouTube');
  } else if (!hasYouTubeDomain) {
    console.log('❌ DIAGNOSIS: Wrong cookie domain');
    console.log('   ACTION: Extract cookies from youtube.com');
  } else {
    console.log('✅ Cookies appear valid');
    console.log('   If still failing, YouTube may be blocking Railway\'s IP');
  }
  console.log('═══════════════════════════════════════\n');

} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
