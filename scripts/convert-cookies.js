#!/usr/bin/env node

/**
 * YouTube Cookies Converter
 *
 * This script converts a cookies.txt file to base64 format for Railway
 *
 * Usage:
 *   node convert-cookies.js cookies.txt
 */

const fs = require('fs');
const path = require('path');

// Get cookies file path from command line
const cookiesFile = process.argv[2];

if (!cookiesFile) {
  console.error('❌ Error: Please provide a cookies.txt file');
  console.log('');
  console.log('Usage:');
  console.log('  node convert-cookies.js cookies.txt');
  console.log('');
  console.log('Example:');
  console.log('  node convert-cookies.js ~/Downloads/cookies.txt');
  process.exit(1);
}

// Check if file exists
if (!fs.existsSync(cookiesFile)) {
  console.error(`❌ Error: File not found: ${cookiesFile}`);
  process.exit(1);
}

try {
  // Read cookies file
  const cookiesContent = fs.readFileSync(cookiesFile, 'utf-8');

  // Validate it looks like a Netscape cookies file
  if (!cookiesContent.includes('# Netscape HTTP Cookie File') && !cookiesContent.includes('.youtube.com')) {
    console.warn('⚠️  Warning: This doesn\'t look like a valid YouTube cookies file');
    console.warn('    Make sure you exported cookies from YouTube.com');
    console.log('');
  }

  // Convert to base64
  const base64 = Buffer.from(cookiesContent, 'utf-8').toString('base64');

  // Save to output file
  const outputFile = path.join(path.dirname(cookiesFile), 'cookies_base64.txt');
  fs.writeFileSync(outputFile, base64);

  // Display results
  console.log('✅ Success! Cookies converted to base64');
  console.log('');
  console.log('📄 Output saved to:', outputFile);
  console.log('');
  console.log('🚀 Next steps:');
  console.log('  1. Copy the base64 string from:', outputFile);
  console.log('  2. Go to Railway → Your Project → Variables');
  console.log('  3. Add variable: YOUTUBE_COOKIES = <paste base64 string>');
  console.log('  4. Redeploy your app');
  console.log('');
  console.log('📋 Base64 string (copy this):');
  console.log('─────────────────────────────────────');
  console.log(base64.substring(0, 100) + '...');
  console.log('─────────────────────────────────────');
  console.log(`(${base64.length} characters total)`);
  console.log('');
  console.log('💡 Tip: On Mac, run this to copy directly:');
  console.log(`   cat ${outputFile} | pbcopy`);
  console.log('');
  console.log('💡 On Windows, run this to copy directly:');
  console.log(`   Get-Content ${outputFile} | Set-Clipboard`);

} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
