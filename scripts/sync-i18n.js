#!/usr/bin/env node

/**
 * ScoreBoard i18n Synchronization & Drift Detection Script
 *
 * Synchronizes translation files from canonical source (scoreboard-web)
 * to scoreboard-mobile, or checks that both are in sync (--check).
 *
 * Usage:
 *   node scripts/sync-i18n.js          # Syncs files from web -> mobile
 *   node scripts/sync-i18n.js --check  # Verifies that both are identical
 */

const fs = require('fs');
const path = require('path');

const isCheck = process.argv.includes('--check');

// Candidate root directories
const currentDir = process.cwd();
let webDir, mobileDir;

if (fs.existsSync(path.join(currentDir, 'lib', 'i18n', 'locales'))) {
  // Running inside scoreboard-web
  webDir = currentDir;
  mobileDir = path.resolve(currentDir, '..', 'scoreboard-mobile');
} else if (fs.existsSync(path.join(currentDir, 'src', 'lib', 'i18n', 'locales'))) {
  // Running inside scoreboard-mobile
  mobileDir = currentDir;
  webDir = path.resolve(currentDir, '..', 'scoreboard-web');
} else if (fs.existsSync(path.join(currentDir, 'scoreboard-web')) && fs.existsSync(path.join(currentDir, 'scoreboard-mobile'))) {
  // Running from Sandbox root
  webDir = path.join(currentDir, 'scoreboard-web');
  mobileDir = path.join(currentDir, 'scoreboard-mobile');
} else {
  console.error('Error: Could not locate scoreboard-web or scoreboard-mobile from ' + currentDir);
  process.exit(1);
}

const sourceDir = path.join(webDir, 'lib', 'i18n');
const targetDir = path.join(mobileDir, 'src', 'lib', 'i18n');

if (!fs.existsSync(sourceDir)) {
  console.error(`Error: Source i18n directory not found: ${sourceDir}`);
  process.exit(1);
}

if (!fs.existsSync(targetDir)) {
  if (isCheck) {
    console.warn(`Target mobile i18n directory not found: ${targetDir} (skipped check in isolated environment)`);
    process.exit(0);
  } else {
    console.error(`Error: Target mobile i18n directory not found: ${targetDir}`);
    process.exit(1);
  }
}

const FILES_TO_SYNC = [
  'types.ts',
  path.join('locales', 'en.ts'),
  path.join('locales', 'pt.ts'),
];

let hasDrift = false;

for (const relFile of FILES_TO_SYNC) {
  const srcFile = path.join(sourceDir, relFile);
  const dstFile = path.join(targetDir, relFile);

  if (!fs.existsSync(srcFile)) {
    console.error(`Missing canonical file: ${srcFile}`);
    process.exit(1);
  }

  const srcContent = fs.readFileSync(srcFile, 'utf8');

  if (isCheck) {
    if (!fs.existsSync(dstFile)) {
      console.error(`[DRIFT DETECTED] Missing in mobile: ${dstFile}`);
      hasDrift = true;
      continue;
    }
    const dstContent = fs.readFileSync(dstFile, 'utf8');
    if (srcContent !== dstContent) {
      console.error(`[DRIFT DETECTED] File differs: ${relFile}`);
      hasDrift = true;
    }
  } else {
    // Ensure destination directory exists
    const destDir = path.dirname(dstFile);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    fs.writeFileSync(dstFile, srcContent, 'utf8');
    console.log(`Synced ${relFile} -> scoreboard-mobile`);
  }
}

if (isCheck) {
  if (hasDrift) {
    console.error('\n❌ i18n translations drift detected between web and mobile!');
    console.error('Run "npm run sync:i18n" to synchronize translation files.\n');
    process.exit(1);
  } else {
    console.log('✅ All i18n translation files are 100% in sync between web and mobile.');
    process.exit(0);
  }
} else {
  console.log('\n✅ Successfully synchronized all i18n files from scoreboard-web to scoreboard-mobile.\n');
}
