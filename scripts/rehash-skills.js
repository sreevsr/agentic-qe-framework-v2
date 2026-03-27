#!/usr/bin/env node

/**
 * rehash-skills.js — Update or check content hashes for skill drift detection
 *
 * Usage:
 *   node scripts/rehash-skills.js           # Rehash all skills + registry (update hashes)
 *   node scripts/rehash-skills.js --check   # Check for drift without updating (exit 1 if drifted)
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SKILLS_DIR = path.join(__dirname, '..', 'skills');
const HASH_FILE = path.join(SKILLS_DIR, '.skill-hashes.json');
const checkMode = process.argv.includes('--check');

function hashFile(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath, 'utf-8').trim()).digest('hex').slice(0, 12);
}

function findFiles(dir, pattern) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...findFiles(fullPath, pattern));
    else if (entry.name.match(pattern)) files.push(fullPath);
  }
  return files;
}

// Find all skill files AND registry.md
const skillFiles = findFiles(SKILLS_DIR, /\.skill\.md$/);
const registryFile = path.join(SKILLS_DIR, 'registry.md');
const allFiles = fs.existsSync(registryFile) ? [...skillFiles, registryFile] : skillFiles;

// Compute current hashes
const currentHashes = {};
for (const file of allFiles) {
  const rel = path.relative(SKILLS_DIR, file);
  currentHashes[rel] = hashFile(file);
}

if (checkMode) {
  // Check mode — compare against stored hashes, exit 1 if drift detected
  if (!fs.existsSync(HASH_FILE)) {
    console.error('No hash file found. Run without --check first to create it.');
    process.exit(1);
  }

  const storedHashes = JSON.parse(fs.readFileSync(HASH_FILE, 'utf-8'));
  let driftCount = 0;
  const newFiles = [];
  const removedFiles = [];

  for (const [rel, hash] of Object.entries(currentHashes)) {
    if (!storedHashes[rel]) {
      newFiles.push(rel);
    } else if (storedHashes[rel] !== hash) {
      console.log(`  DRIFT: ${rel} (was ${storedHashes[rel]}, now ${hash})`);
      driftCount++;
    }
  }

  for (const rel of Object.keys(storedHashes)) {
    if (!currentHashes[rel]) {
      removedFiles.push(rel);
    }
  }

  if (driftCount > 0 || newFiles.length > 0 || removedFiles.length > 0) {
    console.log(`\nDrift detected: ${driftCount} modified, ${newFiles.length} new, ${removedFiles.length} removed`);
    if (newFiles.length > 0) console.log(`  New: ${newFiles.join(', ')}`);
    if (removedFiles.length > 0) console.log(`  Removed: ${removedFiles.join(', ')}`);
    console.log('\nRun without --check to update hashes.');
    process.exit(1);
  } else {
    console.log(`All ${Object.keys(currentHashes).length} skill files match stored hashes. No drift.`);
    process.exit(0);
  }
} else {
  // Rehash mode — update the hash file
  for (const [rel, hash] of Object.entries(currentHashes)) {
    console.log(`  ${rel}: ${hash}`);
  }

  fs.writeFileSync(HASH_FILE, JSON.stringify(currentHashes, null, 2));
  console.log(`\nRehashed ${allFiles.length} files (${skillFiles.length} skills + registry) → ${HASH_FILE}`);
}
