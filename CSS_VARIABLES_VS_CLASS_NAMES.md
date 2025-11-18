# CSS Variables vs Class Names - What Needs to Change?

## The Confusion

**CSS Variables (Theme Configuration):**
```css
:root {
  --primary: #3b82f6;
  --card-foreground: #333333;
}
```
These are what **themes define** - the COLOR VALUES.

**CSS Class Names (Component Styling):**
```html
<div class="sr-field-input">
  <div class="sr-returning-notice">
```
These are what **we apply in HTML** - the COMPONENT NAMES.

## What We Need to Change

### ✅ YES - Change CSS Variables

**Before (our current mess):**
```css
:root {
  --color-on-surface: #111827;
  --color-text-muted: #6b7280;
  --color-surface: #ffffff;
}
```

**After (shadcn standard):**
```css
:root {
  --card-foreground: #111827;
  --muted-foreground: #6b7280;
  --card: #ffffff;
}
```

### ✅ YES - Update CSS That USES Variables

**Before:**
```css
.sr-returning-notice {
  background: var(--color-surface-hover);
  color: var(--color-on-surface);
}
```

**After:**
```css
.sr-returning-notice {
  background: var(--muted);
  color: var(--card-foreground);
}
```

### ❌ NO - Keep Our Class Names

**Our class names are FINE:**
```css
.sr-field-input
.sr-cart-panel
.sr-returning-notice
.sr-checkout-step
```

**Why?**
- These are **component identifiers**, not theme variables
- shadcn doesn't dictate class names (it's not a framework)
- Our `sr-` prefix prevents conflicts (good practice!)
- Class names are for **structure**, variables are for **colors**

## Example Migration

### Template (NO CHANGE)
```html
<!-- HTML/Lit templates stay EXACTLY the same -->
<div class="sr-returning-notice">
  <svg class="sr-notice-icon">...</svg>
  <p class="sr-notice-text">Welcome back!</p>
</div>
```

### CSS (CHANGE VARIABLES ONLY)
```css
/* Before */
.sr-returning-notice {
  background: var(--color-surface-hover);  /* ❌ OLD */
  border: 1px solid var(--color-border);   /* ✅ KEEP (shadcn has this) */
}

.sr-notice-text {
  color: var(--color-on-surface);          /* ❌ OLD */
}

/* After */
.sr-returning-notice {
  background: var(--muted);                /* ✅ NEW */
  border: 1px solid var(--border);         /* ✅ KEEP (shadcn has this) */
}

.sr-notice-text {
  color: var(--card-foreground);           /* ✅ NEW */
}
```

## What shadcn Actually Is

**shadcn/ui provides:**
- ✅ CSS variable naming convention (what we're adopting)
- ✅ Pre-built React components (we don't use - we use Lit)
- ✅ Theme color palette standard

**shadcn does NOT provide:**
- ❌ CSS class naming rules
- ❌ Component structure requirements
- ❌ Framework opinions (works with anything)

## Migration Scope

| Component | Needs Change? | Why? |
|-----------|--------------|------|
| **Template HTML** | ❌ No | Class names stay the same |
| **CSS class names** | ❌ No | Our naming is fine |
| **CSS variable definitions** | ✅ Yes | Align with shadcn |
| **CSS variable usage** | ✅ Yes | Reference new variable names |
| **Backend theme config** | ✅ Yes | Change variable names in themes |
| **Database themes** | ✅ Yes | Migrate stored theme data |

## Work Breakdown

### Phase 1: Widget CSS (3000 lines)
Find/replace variable usage in `styles.css`:
```bash
--color-on-surface → --card-foreground
--color-text-muted → --muted-foreground
--color-surface → --card
--color-text → --foreground
--color-surface-hover → --muted  # (delete this entirely)
```

### Phase 2: Backend Config
Update `widget-themes.php` (41 themes × 2 modes = 82 configs):
```php
// Before
'--color-primary' => '#3b82f6',
'--color-on-surface' => '#333333',

// After
'--primary' => '#3b82f6',
'--card-foreground' => '#333333',
```

### Phase 3: Database Migration
Bulk update `store_themes.css_variables` JSON column.

### Phase 4: Remove Fallbacks
Clean up any temporary compatibility aliases.

## Estimated Work

- **Widget CSS updates:** ~2-3 hours (search/replace + testing)
- **Backend theme conversion:** ~1 hour (script to convert)
- **Database migration:** ~30 mins (SQL script)
- **Testing:** ~2 hours (verify all themes work)

**Total:** ~1 day of focused work

## Key Takeaway

**You only need to change:**
1. CSS variable **names** (definitions)
2. CSS variable **references** (usage)

**You do NOT need to change:**
1. HTML class names
2. Component structure
3. Template files (except variable refs in inline styles)
