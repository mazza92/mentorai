#!/usr/bin/env node

/**
 * Script to update all route files with Firestore credentials fix
 */

const fs = require('fs');
const path = require('path');

const routesDir = path.join(__dirname, 'routes');

const oldPattern = `  if (process.env.GOOGLE_CLOUD_PROJECT_ID && process.env.GOOGLE_CLOUD_PROJECT_ID !== 'your_project_id') {
    firestore = new Firestore({
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
    });`;

const newPattern = `  if (process.env.GOOGLE_CLOUD_PROJECT_ID && process.env.GOOGLE_CLOUD_PROJECT_ID !== 'your_project_id') {
    const firestoreConfig = {
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
    };

    // Handle credentials from Railway environment variable
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
      try {
        const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
        firestoreConfig.credentials = credentials;
      } catch (error) {
        console.error('❌ Failed to parse GOOGLE_APPLICATION_CREDENTIALS_JSON');
        throw error;
      }
    }

    firestore = new Firestore(firestoreConfig);`;

// Files to update
const filesToUpdate = [
  'subscriptions.js',
  'transcribe.js',
  'qa.js',
  'user.js',
  'projects.js',
  'edit.js',
  'upload.js',
  'export.js'
];

let updatedCount = 0;
let skippedCount = 0;

filesToUpdate.forEach(filename => {
  const filePath = path.join(routesDir, filename);

  if (!fs.existsSync(filePath)) {
    console.log(`⏭️  Skipped (not found): ${filename}`);
    skippedCount++;
    return;
  }

  let content = fs.readFileSync(filePath, 'utf-8');

  if (!content.includes(oldPattern)) {
    console.log(`⏭️  Skipped (already updated or different pattern): ${filename}`);
    skippedCount++;
    return;
  }

  content = content.replace(oldPattern, newPattern);
  fs.writeFileSync(filePath, content, 'utf-8');

  console.log(`✅ Updated: ${filename}`);
  updatedCount++;
});

console.log(`\n📊 Summary:`);
console.log(`   ✅ Updated: ${updatedCount} files`);
console.log(`   ⏭️  Skipped: ${skippedCount} files`);
