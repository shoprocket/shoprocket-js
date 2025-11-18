# CSS Variable & Class Audit - ShopRocket Widget

## 1. Current State vs. tweakcn/shadcn Standard

### Our Variables (Used Most)
| Variable | Usage Count | tweakcn Equivalent | Status |
|----------|-------------|-------------------|--------|
| `--color-on-surface` | 55 | ❌ None (our invention) | **INVENTED** |
| `--color-primary` | 49 | `--primary` | ✅ CLOSE (has prefix) |
| `--color-text-muted` | 42 | `--muted-foreground` | ❌ WRONG NAME |
| `--color-border` | 30 | `--border` | ✅ CLOSE (has prefix) |
| `--color-text` | 23 | `--foreground` | ❌ WRONG NAME |
| `--sr-radius` | 22 | `--radius` | ✅ CLOSE (has prefix) |
| `--color-surface` | 17 | `--card` or `--secondary` | ❌ INVENTED |
| `--color-surface-hover` | 7 | ❌ None | ❌ INVENTED |

### Key Differences

**Naming Convention:**
- **tweakcn:** No prefix (e.g., `--primary`, `--foreground`)
- **Us:** `--color-` prefix (e.g., `--color-primary`, `--color-text`)

**Semantic Concepts:**
| Concept | tweakcn | Us | Issue |
|---------|---------|-----|-------|
| Main background | `background` | `background` | ✅ Same |
| Main text | `foreground` | `text` | ❌ Different |
| Muted text | `muted-foreground` | `text-muted` | ❌ Reversed order |
| Card background | `card` | `surface` | ❌ Different |
| Text on primary | `primary-foreground` | `on-primary` | ❌ Different pattern |
| Text on card | `card-foreground` | `on-surface` | ❌ Invented concept |

### Variables We Invented (Not in shadcn/tweakcn)

1. **`--color-on-surface`** (55 uses!)
   - **Purpose:** Text color for card/surface backgrounds
   - **Problem:** shadcn/tweakcn uses `card-foreground` for this
   - **Impact:** HIGH - most used variable

2. **`--color-surface`** (17 uses)
   - **Purpose:** Card/panel background
   - **Problem:** shadcn/tweakcn uses `card` or `secondary`
   - **Impact:** MEDIUM

3. **`--color-surface-hover`** (7 uses)
   - **Purpose:** Hover/elevated backgrounds (but we use it for static notices!)
   - **Problem:** No equivalent - should probably use `muted` or `accent`
   - **Impact:** LOW (recent addition)

4. **RGB variants** (`--color-surface-rgb`, `--color-primary-rgb`)
   - **Purpose:** For rgba() opacity
   - **Problem:** Not in tweakcn, probably fine for our use

5. **Custom prefixed vars** (`--sr-radius`, `--sr-button-font-size`)
   - **Purpose:** ShopRocket-specific customization
   - **Problem:** Fine - these are our additions beyond the theme system

## 2. tweakcn Standard Variables

**Core Palette:**
```
background / foreground
card / card-foreground
popover / popover-foreground
primary / primary-foreground
secondary / secondary-foreground
muted / muted-foreground
accent / accent-foreground
destructive / destructive-foreground
border
input
ring
radius
```

**Sidebar (Dashboard-specific - we don't need):**
```
sidebar / sidebar-foreground
sidebar-primary / sidebar-primary-foreground
sidebar-accent / sidebar-accent-foreground
sidebar-border / sidebar-ring
```

**Charts (we don't need):**
```
chart-1 through chart-5
```

## 3. Recommendations

### Option A: Full Alignment (Breaking Change)
**Migrate to shadcn/tweakcn standard completely**

**Pros:**
- Standard conventions = easier for developers
- Can use tweakcn themes directly without conversion
- Better documentation (use shadcn docs)
- Future-proof (standard is well-maintained)

**Cons:**
- Breaking change for existing users
- Need to update ALL 41 themes in database
- Need to update entire widget CSS (3000+ lines)
- Migration complexity

**Mapping:**
```typescript
// Old → New
'--color-text' → '--foreground'
'--color-text-muted' → '--muted-foreground'
'--color-surface' → '--card'
'--color-on-surface' → '--card-foreground'
'--color-on-primary' → '--primary-foreground'
'--color-border' → '--border'
'--color-primary' → '--primary'
'--sr-radius' → '--radius'
```

### Option B: Hybrid Approach (Recommended)
**Keep our naming but align semantics**

**Pros:**
- Less breaking changes
- Can incrementally migrate
- Keep our `--sr-` customization namespace
- Easier deprecation path

**Cons:**
- Still not 100% standard
- Requires conversion when importing tweakcn themes

**Strategy:**
1. **Keep:** `--color-` prefix (our convention)
2. **Add aliases:** Support both `--color-surface` AND `--card` (fallback chain)
3. **Deprecate:** `--color-surface-hover` (use `--muted` instead)
4. **Map correctly:** Ensure our invented concepts map to shadcn equivalents

**Conversion layer:**
```css
:root {
  /* Standard shadcn names (primary) */
  --background: var(--color-background, #ffffff);
  --foreground: var(--color-text, #111827);
  --card: var(--color-surface, #ffffff);
  --card-foreground: var(--color-on-surface, #111827);
  --muted: var(--color-hover, #f3f4f6);
  --muted-foreground: var(--color-text-muted, #6b7280);
  
  /* Our names (backwards compat) */
  --color-background: var(--background);
  --color-text: var(--foreground);
  --color-surface: var(--card);
  --color-on-surface: var(--card-foreground);
}
```

### Option C: Status Quo + Documentation
**Document our conventions and keep them**

**Pros:**
- No breaking changes
- No migration work
- Already working

**Cons:**
- Harder to use tweakcn themes
- Non-standard = confusion for developers
- We invented concepts that don't exist elsewhere

## 4. Specific Issues Found

### Issue 1: `--color-surface-hover` Misuse
**Current:** Used for static notice backgrounds  
**Should be:** Use `--muted` or `--accent` (semantic for "de-emphasized content")

**Fix:**
```css
.sr-returning-notice {
  background: var(--color-muted, var(--color-hover, #f3f4f6));
}
```

### Issue 2: Drawer Variables
**Current:** We have `--color-drawer`, `--color-drawer-foreground`, etc.  
**shadcn equivalent:** `--popover` / `--popover-foreground`

**Are these the same?** YES - both are elevated overlays

**Fix:** Alias drawer → popover

### Issue 3: Class Naming
**Current:** Mix of BEM-ish (`sr-field-input`) and utility (`sr-field-error`)  
**Concern:** No clear pattern

**Needs audit:**
- Are we using `sr-` prefix consistently?
- Do we have conflicts with Tailwind classes?
- Can we simplify?

## 5. Action Items (Priority Order)

### Immediate (Do Now)
1. ✅ Add deprecation notice to `widget-themes.php` for `--color-surface-hover`
2. 🔄 Stop using `--color-surface-hover`, use `--muted` instead
3. 📝 Document our CSS variable conventions in `/CLAUDE.md`

### Short-term (This Sprint)
4. 🔍 Audit all 3000 lines of `styles.css` for variable consistency
5. 🗺️ Create mapping guide: Our vars ↔ shadcn vars
6. 🧪 Test theme import from tweakcn with conversion layer

### Medium-term (Next Sprint)
7. 🔄 Implement hybrid approach with fallback chains
8. 📊 Migrate high-use variables first (--color-on-surface → --card-foreground)
9. 🧹 Clean up unused variables

### Long-term (Backlog)
10. 💥 Consider full migration to shadcn standard (v2.0?)
11. 🤖 Build theme converter for tweakcn → our format
12. 📚 Write comprehensive theme documentation

## 6. Immediate Fix for Today's Issue

**The `--color-surface-hover` problem we just spent time on:**

**Wrong approach:** Add custom variable to all themes  
**Right approach:** Use existing `--muted` variable for notice backgrounds

**Change:**
```diff
.sr-returning-notice {
-  background: var(--color-surface-hover);
+  background: var(--color-muted, #f9fafb);
}
```

**Why better:**
- Uses standard shadcn semantic (muted = de-emphasized)
- Already defined in themes
- No database migration needed
- Correct intent (notices are muted content, not hover states)

---

**Decision needed:** Which option (A/B/C) should we pursue?
