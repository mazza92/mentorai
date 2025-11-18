#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const routesDir = path.join(__dirname, 'routes');

const files = ['qa.js', 'projects.js', 'subscriptions.js', 'transcribe.js', 'edit.js', 'upload.js', 'export.js'];

files.forEach(filename => {
  const filePath = path.join(routesDir, filename);

  if (!fs.existsSync(filePath)) {
    console.log(`⏭️  Skipped (not found): ${filename}`);
    return;
  }

  let content = fs.readFileSync(filePath, 'utf-8');

  // Pattern to match
  const regex = /(\s+)firestore = new Firestore\(\{\s+projectId: process\.env\.GOOGLE_CLOUD_PROJECT_ID,?\s+\}\);/g;

  // Replacement with credentials handling
  const replacement = `$1const firestoreConfig = {
$1  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
$1};

$1// Handle credentials from Railway environment variable
$1if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
$1  try {
$1    const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
$1    firestoreConfig.credentials = credentials;
$1  } catch (error) {
$1    console.error('❌ Failed to parse GOOGLE_APPLICATION_CREDENTIALS_JSON');
$1    throw error;
$1  }
$1}

$1firestore = new Firestore(firestoreConfig);`;

  const newContent = content.replace(regex, replacement);

  if (newContent === content) {
    console.log(`⏭️  No changes needed: ${filename}`);
    return;
  }

  fs.writeFileSync(filePath, newContent, 'utf-8');
  console.log(`✅ Updated: ${filename}`);
});

console.log('\n✅ All files processed!');
