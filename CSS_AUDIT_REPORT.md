# Shoprocket Widget CSS Audit Report
**Date:** 2025-11-16
**File Analyzed:** `packages/widget/src/styles.css` (3,947 lines)

## Executive Summary

🔴 **Critical Issues Found:** 3
🟡 **Warnings:** 4
🟢 **Total CSS Variables:** 75
📊 **Hardcoded Colors:** 86 instances

---

## 🔴 Critical Issues

### 1. Invalid `rgba()` Syntax with CSS Variables
**Location:** Line 1456-1457
**Severity:** CRITICAL - This CSS will not work

```css
/* BROKEN - CSS variables contain hex colors, not RGB values */
.sr-zoom-lens {
  border-color: rgba(var(--color-surface), 0.5);  /* ❌ INVALID */
  background: rgba(var(--color-surface), 0.1);     /* ❌ INVALID */
}
```

**Problem:** `--color-surface: #ffffff` is a hex value. You cannot use it in `rgba()` which expects RGB triplets.

**Solutions:**
```css
/* Option A: Use opacity property */
.sr-zoom-lens {
  border-color: var(--color-surface);
  opacity: 0.5;
}

/* Option B: Define RGB variables (recommended) */
:host {
  --color-surface-rgb: 255 255 255;  /* RGB triplet */
}
.sr-zoom-lens {
  border-color: rgba(var(--color-surface-rgb), 0.5);
}

/* Option C: Modern CSS color-mix (best but newer) */
.sr-zoom-lens {
  border-color: color-mix(in srgb, var(--color-surface) 50%, transparent);
}
```

### 2. Duplicate/Inconsistent Background Variables
**Location:** Lines 129 (--color-surface) vs 136 (--color-input-bg)
**Severity:** CRITICAL - Causes theming inconsistencies

```css
/* Two variables for the same concept */
--color-surface: #ffffff;      /* Used 18 times */
--color-input-bg: #f8fafc;     /* Used 1 time only */
```

**Impact:**
- Catalog filters use `--color-surface` → themed correctly ✅
- Cart/checkout forms use `--color-input-bg` → NOT themed ❌

**Current Usage:**
```css
/* Catalog filters - THEMED */
.sr-catalog-filters .sr-field-input {
  background-color: var(--color-surface);  /* Changes with theme */
}

/* Cart forms - NOT THEMED */
.sr-field-input {
  background: var(--color-input-bg);  /* Fixed value, no theming */
}
```

**Recommended Fix:** Eliminate `--color-input-bg` and use `--color-surface` everywhere.

### 3. Inconsistent Component Scoping Strategy
**Severity:** CRITICAL - Makes CSS unpredictable

**Current State:**
- **Catalog:** Uses scoped overrides (`.sr-catalog-filters .sr-field-input`)
- **Cart/Checkout:** NO scoping - relies on global `.sr-field-input`
- **Result:** Cart forms don't inherit theme properly

**Component Scoping Breakdown:**
- `.sr-catalog-*`: 5 selectors
- `.sr-cart-*`: 15 selectors
- `.sr-checkout-*`: 8 selectors
- Global `.sr-*`: ~200 selectors

**Problem:** Mix of global and scoped makes it unclear which styles apply where.

---

## 🟡 Warnings

### 4. Hardcoded Color Values
**Count:** 86 instances (excluding variable definitions)

**Examples:**
```css
background: rgba(0, 0, 0, 0.5);           /* Line 572 - should use --color-overlay */
background: rgba(251, 191, 36, 0.1);      /* Line 1071 - magic number */
color: rgb(180, 83, 9);                    /* Line 1072 - magic number */
```

**Impact:** These colors won't respond to theme changes.

**Recommendation:** Create semantic variables:
```css
--color-overlay: rgba(0, 0, 0, 0.5);
--color-warning-bg: rgba(251, 191, 36, 0.1);
--color-warning-text: rgb(180, 83, 9);
```

### 5. Fallback Values in var() May Mask Theme Issues
**Examples:**
```css
background: var(--color-success, #15803d);  /* Lines 547, 1399, 1404 */
color: var(--color-on-success, #ffffff);    /* Lines 548, 1400 */
```

**Concern:** If `--color-success` isn't defined in a theme, fallback hides the problem.

**Best Practice:** Either:
1. Remove fallbacks and fail loudly (forces theme completeness)
2. Document that all fallbacks must match default theme

### 6. Missing Component Scopes for Cart/Checkout
**Components without scoped overrides:**
- `.sr-cart` - only 15 style selectors, mostly animations
- `.sr-checkout` - only 8 style selectors
- NO `.sr-cart .sr-field-input` override
- NO `.sr-checkout .sr-field-input` override

**Result:** Cart/checkout forms use global field styles which don't theme properly.

### 7. Potential Shadow DOM CSS Variable Inheritance Issues
**Concern:** Shadow DOM blocks CSS variable inheritance past one level.

**Current Architecture:**
- Catalog has Shadow DOM ✓
- Cart has Shadow DOM ✓
- Product Detail uses Light DOM (nested in catalog)

**Question:** Can nested components access theme variables?

---

## 📊 CSS Variable Analysis

### Color Variables (21 total)
```
✅ --color-primary          (Primary brand color)
✅ --color-surface           (Card/surface backgrounds) - KEEP
✅ --color-surface-hover     (Hover state)
✅ --color-text              (Primary text)
✅ --color-text-muted        (Secondary text)
✅ --color-border            (Border color)
✅ --color-hover             (Generic hover)
❌ --color-input-bg          (Input backgrounds) - ELIMINATE
❌ --color-card-bg           (Seems duplicate of surface?) - CHECK
✅ --color-on-primary        (Text on primary)
✅ --color-on-surface        (Text on surface)
✅ --color-error             (Error state)
✅ --color-success           (Success state)
✅ --color-warning           (Warning state)
✅ --color-danger            (Danger state)
✅ --color-info              (Info state)
✅ --color-on-error          (Text on error)
✅ --color-on-success        (Text on success)
```

### Spacing/Layout Variables (15 total)
```
✅ --spacing                 (Base spacing unit)
✅ --sr-radius               (Border radius)
✅ --cols, --cols-md, --cols-sm  (Grid columns)
✅ --cart-panel-width        (Cart sidebar width)
✅ --cart-size, --cart-size-sm   (Cart icon size)
```

### Component-Specific Variables (8 total)
```
✅ --sr-button-*             (Button styles)
✅ --sr-product-*            (Product card styles)
✅ --sr-card-padding         (Card padding)
```

### Tailwind Utility Variables (~31 total)
```
--tw-shadow, --tw-blur, --tw-rotate, etc.
```

---

## 🎯 Recommended CSS Architecture

### Principle 1: Component-Scoped Overrides
**Pattern:**
```css
/* Base styles - minimal, structural only */
.sr-field-input {
  width: 100%;
  padding: /* ... */;
  border-radius: var(--sr-radius);
  border: 1px solid var(--color-border);
  /* NO background-color here */
}

/* Component-specific theming */
.sr-catalog .sr-field-input,
.sr-cart .sr-field-input,
.sr-checkout .sr-field-input {
  background-color: var(--color-surface);  /* All use same variable */
}

/* Component-specific sizes */
.sr-catalog-filters .sr-field-input {
  min-height: 48px;  /* Larger touch target in filters */
}

.sr-checkout .sr-field-input {
  min-height: 44px;  /* Standard in forms */
}
```

### Principle 2: Single Source of Truth for Colors
**Eliminate duplicates:**
```css
/* BEFORE */
--color-surface: #ffffff;
--color-input-bg: #f8fafc;
--color-card-bg: #f3f4f6;

/* AFTER */
--color-surface: #ffffff;        /* All backgrounds */
--color-surface-subtle: #f8fafc; /* Optional: slightly different shade */
```

### Principle 3: RGB Variants for Alpha Transparency
**Add RGB versions:**
```css
:host {
  /* Hex for solid colors */
  --color-surface: #ffffff;
  --color-primary: #111827;

  /* RGB triplets for alpha */
  --color-surface-rgb: 255 255 255;
  --color-primary-rgb: 17 24 39;
}

/* Usage */
.overlay {
  background: rgba(var(--color-surface-rgb), 0.9);
}
```

### Principle 4: Semantic Variable Names
**Create opacity/overlay variables:**
```css
--color-overlay-dark: rgba(0, 0, 0, 0.5);
--color-overlay-light: rgba(255, 255, 255, 0.5);
--opacity-disabled: 0.6;
--opacity-hover: 0.8;
```

---

## ✅ Action Items (Priority Order)

### Immediate (Critical Fixes)
1. ❌ **Fix invalid rgba() on lines 1456-1457** - This CSS doesn't work
2. ❌ **Eliminate --color-input-bg** - Replace with --color-surface
3. ❌ **Add component scoping for cart/checkout fields**

### High Priority (Theming Consistency)
4. 🔄 **Create RGB variable variants** for alpha transparency
5. 🔄 **Audit all hardcoded rgba() values** - convert to semantic variables
6. 🔄 **Standardize component scoping pattern** - all components follow same structure

### Medium Priority (Code Quality)
7. 📋 **Document CSS variable naming conventions** in CLAUDE.md
8. 📋 **Create theme validation** - ensure all themes define required variables
9. 📋 **Consolidate duplicate variables** (check if --color-card-bg needed)

### Low Priority (Nice to Have)
10. 🎨 **Consider CSS Cascade Layers** for better specificity control
11. 🎨 **Migrate to color-mix()** for modern alpha handling (when browser support allows)

---

## 🏗️ Proposed File Structure

**Current:** Single 3,947-line file
**Proposed:** Modular structure

```
src/styles/
├── base.css              (CSS resets, :host defaults)
├── variables.css         (All CSS variables)
├── utilities.css         (Tailwind utilities)
├── components/
│   ├── fields.css        (Form inputs, shared)
│   ├── catalog.css       (.sr-catalog scoped styles)
│   ├── cart.css          (.sr-cart scoped styles)
│   ├── checkout.css      (.sr-checkout scoped styles)
│   ├── buttons.css       (Button variants)
│   └── animations.css    (Keyframes, transitions)
└── index.css             (@import all modules)
```

**Benefits:**
- Easier to maintain
- Clear separation of concerns
- Faster to locate styles
- Better for code review

---

## 📝 Notes

- **Tailwind Usage:** Mix of utility classes and custom CSS is appropriate for this use case
- **Shadow DOM:** Current shadow strategy (top-level only) is correct
- **Bundle Size:** 3,947 lines will minify well with modern tools
- **Browser Support:** No major compatibility concerns detected

---

## 🔍 Next Steps

1. Review and approve recommendations
2. Create GitHub issues for critical fixes
3. Implement fixes in priority order
4. Update CLAUDE.md with CSS conventions
5. Add CSS linting rules to catch future issues

---

**Audited by:** Claude Code
**Estimated Fix Time:**
- Critical issues: 2-3 hours
- High priority: 4-6 hours
- Medium priority: 6-8 hours
