#!/usr/bin/env node

/**
 * String Extraction Script
 * Scans widget components for t() calls and hardcoded strings
 *
 * Usage:
 *   node scripts/extract-strings.js           # Extract wrapped strings only
 *   node scripts/extract-strings.js --all     # Extract all candidate strings
 */

import pkg from 'glob';
const { glob } = pkg;
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const args = process.argv.slice(2);
const extractAll = args.includes('--all');

// Regex to find t('key', 'fallback') calls (including multi-line with optional third param)
// Matches: t('key', 'fallback') or t('key', 'fallback', {...})
const wrappedStringPattern = /t\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]\s*(?:,\s*\{[^}]*\})?\s*\)/gs;

// Regex to find potential user-facing strings (for --all mode)
const candidateStringPattern = /['"]([A-Z][a-zA-Z\s,!?.'-]{2,})['"]/g;

// Patterns to ignore (code strings, not user-facing)
const ignorePatterns = [
  /^sr-/,                    // CSS classes
  /^data-/,                  // HTML attributes
  /^aria-/,                  // ARIA attributes (unless they're values)
  /^http/,                   // URLs
  /^\w+$/,                   // Single words without spaces (likely code)
  /^[A-Z_]+$/,              // CONSTANTS
  /^\d+/,                    // Numbers
  /^#[0-9a-fA-F]{3,6}$/,    // Hex colors
  /viewBox/,                 // SVG attributes
  /stroke/,                  // SVG attributes
  /fill/,                    // SVG attributes
  /path/,                    // SVG paths
  /\.\//,                    // Relative paths
];

// Find all component files
const componentFiles = glob.sync('src/components/**/*.ts', {
  cwd: path.resolve(__dirname, '..'),
  absolute: true
});

const wrappedStrings = new Map(); // key -> fallback
const candidateStrings = new Set(); // potential strings not yet wrapped
const fileStats = new Map(); // file -> count

console.log('🔍 Scanning widget components...\n');

// Process each file
componentFiles.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const relativePath = path.relative(path.resolve(__dirname, '../src'), file);
  let wrappedCount = 0;
  let candidateCount = 0;

  // Extract wrapped strings
  let match;
  while ((match = wrappedStringPattern.exec(content)) !== null) {
    const [, key, fallback] = match;
    wrappedStrings.set(key, fallback);
    wrappedCount++;
  }

  // Extract candidate strings (if --all mode)
  if (extractAll) {
    wrappedStringPattern.lastIndex = 0; // Reset regex

    while ((match = candidateStringPattern.exec(content)) !== null) {
      const [, text] = match;

      // Skip if it's an ignored pattern
      const shouldIgnore = ignorePatterns.some(pattern => pattern.test(text));
      if (shouldIgnore) continue;

      // Skip if already wrapped
      const isWrapped = Array.from(wrappedStrings.values()).includes(text);
      if (isWrapped) continue;

      candidateStrings.add(text);
      candidateCount++;
    }
  }

  if (wrappedCount > 0 || (extractAll && candidateCount > 0)) {
    fileStats.set(relativePath, { wrapped: wrappedCount, candidates: candidateCount });
  }
});

// Generate output
const output = {
  summary: {
    totalWrapped: wrappedStrings.size,
    totalCandidates: extractAll ? candidateStrings.size : 0,
    filesProcessed: componentFiles.length,
    filesWithStrings: fileStats.size
  },
  wrapped: Object.fromEntries(
    Array.from(wrappedStrings.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  ),
  candidates: extractAll ? Array.from(candidateStrings).sort() : undefined,
  fileStats: Object.fromEntries(
    Array.from(fileStats.entries()).sort((a, b) => {
      const aTotal = a[1].wrapped + a[1].candidates;
      const bTotal = b[1].wrapped + b[1].candidates;
      return bTotal - aTotal; // Sort by total descending
    })
  )
};

// Write to file
const outputPath = path.resolve(__dirname, '../strings-extracted.json');
fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));

// Console summary
console.log('✅ Extraction complete!\n');
console.log(`📊 Summary:`);
console.log(`   • Wrapped strings: ${output.summary.totalWrapped}`);
if (extractAll) {
  console.log(`   • Candidate strings: ${output.summary.totalCandidates}`);
}
console.log(`   • Files processed: ${output.summary.filesProcessed}`);
console.log(`   • Files with strings: ${output.summary.filesWithStrings}\n`);

console.log(`📄 Output written to: strings-extracted.json\n`);

// Show top files
console.log('📈 Top files by string count:');
const topFiles = Array.from(fileStats.entries())
  .sort((a, b) => (b[1].wrapped + b[1].candidates) - (a[1].wrapped + a[1].candidates))
  .slice(0, 10);

topFiles.forEach(([file, stats]) => {
  const total = stats.wrapped + stats.candidates;
  console.log(`   ${file.padEnd(50)} ${stats.wrapped} wrapped, ${stats.candidates} candidates`);
});

console.log('\n💡 Next steps:');
console.log('   1. Review strings-extracted.json');
console.log('   2. Compare with database strings');
console.log('   3. Continue migrating hardcoded strings\n');
