#!/usr/bin/env node

/**
 * rehash-skills.js — Update content hashes for drift detection
 * Usage: node scripts/rehash-skills.js
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SKILLS_DIR = path.join(__dirname, '..', 'skills');
const HASH_FILE = path.join(SKILLS_DIR, '.skill-hashes.json');

function hashFile(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath, 'utf-8').trim()).digest('hex').slice(0, 12);
}

function findSkillFiles(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...findSkillFiles(fullPath));
    else if (entry.name.endsWith('.skill.md')) files.push(fullPath);
  }
  return files;
}

const skillFiles = findSkillFiles(SKILLS_DIR);
const hashes = {};
for (const file of skillFiles) {
  const rel = path.relative(SKILLS_DIR, file);
  hashes[rel] = hashFile(file);
  console.log(`  ${rel}: ${hashes[rel]}`);
}

fs.writeFileSync(HASH_FILE, JSON.stringify(hashes, null, 2));
console.log(`\nRehashed ${skillFiles.length} skill files → ${HASH_FILE}`);
