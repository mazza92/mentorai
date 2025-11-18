#!/usr/bin/env node

/**
 * Test cookies with yt-dlp directly (run on Railway)
 */

const youtubedl = require('youtube-dl-exec');
const fs = require('fs');
const path = require('path');

async function test() {
  console.log('Testing YouTube cookies...\n');

  if (!process.env.YOUTUBE_COOKIES) {
    console.log('❌ YOUTUBE_COOKIES not set');
    process.exit(1);
  }

  const cookiesPath = '/tmp/test_cookies.txt';
  const cookiesContent = Buffer.from(process.env.YOUTUBE_COOKIES, 'base64').toString('utf-8');
  fs.writeFileSync(cookiesPath, cookiesContent);

  const testUrl = 'https://www.youtube.com/watch?v=jNQXAC9IVRw'; // "Me at the zoo" - first YouTube video

  try {
    console.log('🔍 Testing with cookies...');
    const info = await youtubedl(testUrl, {
      dumpSingleJson: true,
      cookies: cookiesPath,
      noWarnings: true,
    });

    console.log('✅ SUCCESS! Cookies are working!');
    console.log('   Video title:', info.title);
    console.log('   Duration:', info.duration, 'seconds');
  } catch (error) {
    console.log('❌ FAILED!');
    console.log('   Error:', error.message);

    if (error.stderr) {
      console.log('   stderr:', error.stderr.substring(0, 200));
    }

    // Try without cookies to see if it's IP blocking
    try {
      console.log('\n🔍 Testing WITHOUT cookies...');
      const info2 = await youtubedl(testUrl, {
        dumpSingleJson: true,
        noWarnings: true,
      });
      console.log('⚠️  Works without cookies! Railway IP might not be blocked.');
      console.log('   Your cookies may be expired/invalid.');
    } catch (error2) {
      console.log('❌ Also fails without cookies.');
      console.log('   Railway\'s IP is likely blocked by YouTube.');
    }
  }
}

test();
