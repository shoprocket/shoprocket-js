#!/usr/bin/env node

/**
 * Migration Script: Custom CSS Variables → shadcn Standard
 *
 * This script updates the widget CSS to use shadcn/ui standard variable names.
 *
 * Usage:
 *   node migrate-css-variables.js [--dry-run]
 *
 * Options:
 *   --dry-run    Preview changes without modifying files
 */

const fs = require('fs');
const path = require('path');

const STYLES_PATH = path.join(__dirname, 'packages/widget/src/styles.css');
const DRY_RUN = process.argv.includes('--dry-run');

// Migration mapping - ORDER MATTERS!
// Most specific patterns first to avoid partial matches
const MIGRATIONS = [
  // === PHASE 1: Specific patterns (avoid partial matches) ===
  {
    from: '--color-on-surface',
    to: '--card-foreground',
    count: 0,
    note: 'HIGH IMPACT - most used variable (55 uses)'
  },
  {
    from: '--color-surface-hover',
    to: '--muted',
    count: 0,
    note: 'SEMANTIC FIX - was used incorrectly for static backgrounds'
  },
  {
    from: '--color-surface-rgb',
    to: '--card-rgb',
    count: 0,
    note: 'RGB variant for card'
  },
  {
    from: '--color-surface',
    to: '--card',
    count: 0,
    note: 'Surface → Card (shadcn semantic)'
  },

  // === PHASE 2: Text/foreground colors ===
  {
    from: '--color-text-muted',
    to: '--muted-foreground',
    count: 0,
    note: 'Reorder: text-muted → muted-foreground'
  },
  {
    from: '--color-text-rgb',
    to: '--foreground-rgb',
    count: 0,
    note: 'RGB variant for foreground'
  },
  {
    from: '--color-text',
    to: '--foreground',
    count: 0,
    note: 'Text → Foreground (shadcn standard)'
  },

  // === PHASE 3: Primary colors ===
  {
    from: '--color-on-primary',
    to: '--primary-foreground',
    count: 0,
    note: 'on-primary → primary-foreground'
  },
  {
    from: '--color-primary-rgb',
    to: '--primary-rgb',
    count: 0,
    note: 'Remove color- prefix from RGB variant'
  },
  {
    from: '--color-primary',
    to: '--primary',
    count: 0,
    note: 'Remove color- prefix'
  },

  // === PHASE 4: Error/destructive ===
  {
    from: '--color-on-error',
    to: '--destructive-foreground',
    count: 0,
    note: 'Error → Destructive (shadcn semantic)'
  },
  {
    from: '--color-error',
    to: '--destructive',
    count: 0,
    note: 'Error → Destructive (shadcn semantic)'
  },
  {
    from: '--color-danger',
    to: '--destructive',
    count: 0,
    note: 'Danger is alias for error'
  },

  // === PHASE 5: Simple prefix removals (do last) ===
  {
    from: '--color-border',
    to: '--border',
    count: 0,
    note: 'Remove color- prefix'
  },
  {
    from: '--color-hover',
    to: '--secondary',
    count: 0,
    note: 'Hover state → secondary background'
  },
  {
    from: '--color-card-bg',
    to: '--card',
    count: 0,
    note: 'Duplicate of surface, use card'
  },

  // === PHASE 6: Update custom variables (keep names but remove color- prefix) ===
  {
    from: '--color-success',
    to: '--success',
    count: 0,
    note: 'CUSTOM - not in shadcn, but remove prefix for consistency'
  },
  {
    from: '--color-on-success',
    to: '--success-foreground',
    count: 0,
    note: 'CUSTOM - not in shadcn, but align pattern'
  },
  {
    from: '--color-warning',
    to: '--warning',
    count: 0,
    note: 'CUSTOM - not in shadcn, but remove prefix'
  },
  {
    from: '--color-info',
    to: '--info',
    count: 0,
    note: 'CUSTOM - not in shadcn, but remove prefix'
  },
  {
    from: '--color-overlay',
    to: '--overlay',
    count: 0,
    note: 'CUSTOM - for modals, remove prefix'
  },
];

// Variables to SKIP (keep as-is)
const SKIP_VARIABLES = [
  '--color-warning-bg',      // Utility color
  '--color-warning-text',    // Utility color
  '--sr-',                   // All ShopRocket custom vars
  '--tw-',                   // All Tailwind internal vars
  '--cart-',                 // Layout vars
  '--cols',                  // Layout vars
  '--spacing',               // Layout vars
  '--shadow-',               // Utility vars
  '--skeleton-',             // Utility vars
];

/**
 * Check if a variable should be skipped
 */
function shouldSkip(varName) {
  return SKIP_VARIABLES.some(skip => varName.startsWith(skip));
}

/**
 * Perform the migration
 */
function migrate() {
  console.log('🚀 Starting CSS Variable Migration to shadcn Standard\n');
  console.log(`Mode: ${DRY_RUN ? '🔍 DRY RUN (preview only)' : '✏️  WRITE MODE'}\n`);

  // Read the styles file
  let content = fs.readFileSync(STYLES_PATH, 'utf8');
  const originalContent = content;

  // Apply migrations in order
  MIGRATIONS.forEach(migration => {
    // Count occurrences using both var() and bare definitions
    const varRegex = new RegExp(`var\\(${escapeRegex(migration.from)}[,)]`, 'g');
    const defRegex = new RegExp(`^\\s*${escapeRegex(migration.from)}:`, 'gm');

    const varMatches = content.match(varRegex) || [];
    const defMatches = content.match(defRegex) || [];
    const totalMatches = varMatches.length + defMatches.length;

    if (totalMatches > 0) {
      migration.count = totalMatches;

      // Replace var() usage
      content = content.replace(
        new RegExp(`var\\(${escapeRegex(migration.from)}(,|\\))`, 'g'),
        `var(${migration.to}$1`
      );

      // Replace definitions (with word boundary to avoid partial matches)
      content = content.replace(
        new RegExp(`(^\\s*)${escapeRegex(migration.from)}:`, 'gm'),
        `$1${migration.to}:`
      );

      console.log(`✅ ${migration.from} → ${migration.to}`);
      console.log(`   Replacements: ${totalMatches}`);
      console.log(`   Note: ${migration.note}\n`);
    }
  });

  // Summary
  console.log('\n📊 Migration Summary\n');
  console.log('═══════════════════════════════════════════════════════════\n');

  const totalReplacements = MIGRATIONS.reduce((sum, m) => sum + m.count, 0);
  const migratedVars = MIGRATIONS.filter(m => m.count > 0).length;

  console.log(`Variables migrated: ${migratedVars}/${MIGRATIONS.length}`);
  console.log(`Total replacements: ${totalReplacements}`);
  console.log(`File: ${STYLES_PATH}`);
  console.log(`Size: ${originalContent.length} → ${content.length} bytes\n`);

  // High-impact changes
  const highImpact = MIGRATIONS.filter(m => m.count >= 10).sort((a, b) => b.count - a.count);
  if (highImpact.length > 0) {
    console.log('🔥 High Impact Changes (≥10 replacements):\n');
    highImpact.forEach(m => {
      console.log(`   ${m.from} → ${m.to} (${m.count} uses)`);
    });
    console.log();
  }

  // Variables with no matches (might be already migrated or not used)
  const noMatches = MIGRATIONS.filter(m => m.count === 0);
  if (noMatches.length > 0) {
    console.log('ℹ️  Variables Not Found (may not be in use):\n');
    noMatches.forEach(m => {
      console.log(`   ${m.from}`);
    });
    console.log();
  }

  // Write changes
  if (DRY_RUN) {
    console.log('🔍 DRY RUN - No files modified');
    console.log('   Run without --dry-run to apply changes\n');

    // Show a diff sample
    const changes = findChangedLines(originalContent, content);
    if (changes.length > 0) {
      console.log('📝 Sample Changes (first 10):\n');
      changes.slice(0, 10).forEach(change => {
        console.log(`   Line ${change.line}:`);
        console.log(`   - ${change.old}`);
        console.log(`   + ${change.new}\n`);
      });
    }
  } else {
    // Create backup
    const backupPath = STYLES_PATH + '.backup';
    fs.writeFileSync(backupPath, originalContent, 'utf8');
    console.log(`💾 Backup created: ${backupPath}`);

    // Write migrated content
    fs.writeFileSync(STYLES_PATH, content, 'utf8');
    console.log(`✅ Migration complete: ${STYLES_PATH}\n`);

    console.log('Next steps:');
    console.log('1. Review changes: git diff packages/widget/src/styles.css');
    console.log('2. Test the widget: npm run build && open test page');
    console.log('3. Verify all themes render correctly');
    console.log('4. If issues, restore backup: mv styles.css.backup styles.css\n');
  }
}

/**
 * Escape special regex characters
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Find changed lines for diff preview
 */
function findChangedLines(oldContent, newContent) {
  const oldLines = oldContent.split('\n');
  const newLines = newContent.split('\n');
  const changes = [];

  for (let i = 0; i < Math.min(oldLines.length, newLines.length); i++) {
    if (oldLines[i] !== newLines[i]) {
      changes.push({
        line: i + 1,
        old: oldLines[i].trim(),
        new: newLines[i].trim()
      });
    }
  }

  return changes;
}

// Run migration
try {
  migrate();
} catch (error) {
  console.error('❌ Migration failed:', error.message);
  process.exit(1);
}
