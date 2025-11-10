# Enhanced Theme System Proposal

## Current Limitations

### Variables Defined in Themes (7-9 total)
- Basic colors: primary, surface, text, border, error
- Layout: radius, cols
- Typography: title-size, button-font-size

### Variables Available in Widget (40+ total)
The widget supports many more variables that aren't being themed:
- Colors: hover, success, warning, text-muted, on-primary, on-surface, etc.
- Spacing: card-padding, grid-padding, section-gap, button-padding
- Visual: shadows, image-radius, modal-radius, opacity values
- Interactive: skeleton shimmer, ring colors

**Gap:** Only 20% of available customization is being used!

---

## Recommendations: shadcn/ui-Inspired Approach

### 1. **Semantic Color System** (like shadcn)

Instead of just "primary, surface, text", use semantic tokens:

```css
/* Base Colors */
--color-background     /* Page background */
--color-foreground     /* Main text */

/* Interactive Elements */
--color-primary        /* CTAs, links */
--color-primary-foreground  /* Text on primary */

--color-secondary      /* Less prominent actions */
--color-secondary-foreground

/* UI Elements */
--color-card           /* Card backgrounds */
--color-card-foreground

--color-popover        /* Dropdown, tooltip backgrounds */
--color-popover-foreground

--color-muted          /* Subtle backgrounds */
--color-muted-foreground

--color-accent         /* Highlights */
--color-accent-foreground

/* States */
--color-destructive    /* Delete, error actions */
--color-destructive-foreground

--color-success
--color-success-foreground

--color-warning
--color-warning-foreground

/* Borders & Dividers */
--color-border
--color-input         /* Input field borders */
--color-ring          /* Focus rings */
```

### 2. **Comprehensive Spacing System**

```css
/* Spacing Scale */
--spacing-xs: 0.25rem;
--spacing-sm: 0.5rem;
--spacing-md: 1rem;
--spacing-lg: 1.5rem;
--spacing-xl: 2rem;

/* Component Spacing */
--card-padding
--button-padding-x
--button-padding-y
--grid-gap
--section-gap
```

### 3. **Border Radius Tokens**

```css
--radius-sm: 0.25rem;
--radius-md: 0.5rem;
--radius-lg: 0.75rem;
--radius-xl: 1rem;
--radius-2xl: 1.5rem;
--radius-full: 9999px;

/* Component-specific */
--radius-button
--radius-card
--radius-input
--radius-image
```

### 4. **Typography Scale**

```css
/* Font Sizes */
--font-size-xs: 0.75rem;
--font-size-sm: 0.875rem;
--font-size-base: 1rem;
--font-size-lg: 1.125rem;
--font-size-xl: 1.25rem;
--font-size-2xl: 1.5rem;

/* Font Weights */
--font-weight-normal: 400;
--font-weight-medium: 500;
--font-weight-semibold: 600;
--font-weight-bold: 700;

/* Line Heights */
--line-height-tight: 1.25;
--line-height-normal: 1.5;
--line-height-relaxed: 1.75;
```

### 5. **Shadow System**

```css
--shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
--shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1);
--shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1);
--shadow-xl: 0 20px 25px -5px rgb(0 0 0 / 0.1);

/* Component shadows */
--shadow-card
--shadow-dropdown
--shadow-modal
```

### 6. **Animation/Transition Tokens**

```css
--transition-fast: 150ms;
--transition-base: 200ms;
--transition-slow: 300ms;

--ease-in: cubic-bezier(0.4, 0, 1, 1);
--ease-out: cubic-bezier(0, 0, 0.2, 1);
--ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
```

---

## Proposed Theme Structure

### Option A: Comprehensive (Recommended)
Define ALL variables in each theme preset for maximum control.

```php
'presets' => [
    'modern-dark' => [
        'name' => 'Modern Dark',
        'description' => 'Contemporary dark theme with vibrant accents',
        'css_variables' => [
            // Base Colors
            '--color-background' => '#0a0a0a',
            '--color-foreground' => '#fafafa',

            // Primary
            '--color-primary' => '#3b82f6',
            '--color-primary-foreground' => '#ffffff',

            // Secondary
            '--color-secondary' => '#6366f1',
            '--color-secondary-foreground' => '#ffffff',

            // UI Elements
            '--color-card' => '#171717',
            '--color-card-foreground' => '#fafafa',
            '--color-popover' => '#262626',
            '--color-popover-foreground' => '#fafafa',
            '--color-muted' => '#262626',
            '--color-muted-foreground' => '#a3a3a3',
            '--color-accent' => '#1f1f1f',
            '--color-accent-foreground' => '#fafafa',

            // States
            '--color-destructive' => '#ef4444',
            '--color-destructive-foreground' => '#ffffff',
            '--color-success' => '#10b981',
            '--color-success-foreground' => '#ffffff',
            '--color-warning' => '#f59e0b',
            '--color-warning-foreground' => '#ffffff',

            // Borders
            '--color-border' => '#262626',
            '--color-input' => '#3f3f3f',
            '--color-ring' => '#3b82f6',

            // Radius
            '--radius-sm' => '0.25rem',
            '--radius-md' => '0.5rem',
            '--radius-lg' => '0.75rem',
            '--radius-button' => '0.5rem',
            '--radius-card' => '0.75rem',
            '--radius-input' => '0.5rem',
            '--radius-image' => '0.5rem',

            // Spacing
            '--spacing-xs' => '0.25rem',
            '--spacing-sm' => '0.5rem',
            '--spacing-md' => '1rem',
            '--spacing-lg' => '1.5rem',
            '--spacing-xl' => '2rem',

            // Shadows
            '--shadow-sm' => '0 1px 2px 0 rgb(0 0 0 / 0.3)',
            '--shadow-md' => '0 4px 6px -1px rgb(0 0 0 / 0.4)',
            '--shadow-lg' => '0 10px 15px -3px rgb(0 0 0 / 0.5)',

            // Typography
            '--font-size-xs' => '0.75rem',
            '--font-size-sm' => '0.875rem',
            '--font-size-base' => '1rem',
            '--font-size-lg' => '1.125rem',
        ],
    ],
]
```

### Option B: Layered (Easier maintenance)
Have a base theme with defaults, each preset only overrides what's different.

```php
'base' => [
    // All default values
    '--spacing-xs' => '0.25rem',
    // ... etc
],
'presets' => [
    'ocean' => [
        // Only override colors, inherit spacing/typography
        '--color-primary' => '#2563eb',
        '--color-background' => '#ffffff',
    ],
]
```

---

## New Theme Ideas (Inspired by Popular Designs)

### 1. **Nord** (Developer favorite)
- Cool blues and grays
- Excellent accessibility
- Calm, professional

### 2. **Dracula** (Popular dark theme)
- Purple and pink accents
- High contrast
- Modern, energetic

### 3. **Catppuccin Mocha** (Trendy pastel dark)
- Soft pastels on dark base
- Cozy, warm
- Great for lifestyle brands

### 4. **Tokyo Night** (Neon cyberpunk)
- Electric blues and purples
- High energy
- Tech-forward

### 5. **Gruvbox** (Retro warmth)
- Warm earth tones
- Nostalgic, organic
- Great for artisan/craft stores

### 6. **Rose Pine** (Elegant minimalism)
- Muted rose and pine
- Sophisticated
- Fashion/beauty brands

### 7. **Everforest** (Natural calm)
- Forest greens and browns
- Organic, sustainable vibe
- Eco-friendly brands

### 8. **Ayu** (Japanese simplicity)
- Clean, minimal
- Three variants: light, mirage, dark
- Universal appeal

### 9. **Solarized** (Classic accessibility)
- Scientific color theory
- Perfect contrast ratios
- Professional/enterprise

### 10. **Palenight** (Soft twilight)
- Purple-gray base
- Gentle on eyes
- Wellness/meditation products

---

## Implementation Strategy

### Phase 1: Expand Variable Support
1. Update widget CSS to use semantic color tokens
2. Map old variables to new system (backward compatible)
3. Add missing spacing/typography variables

### Phase 2: Create Comprehensive Presets
1. Update existing 7 themes with full variable set
2. Add 10 new popular themes
3. Ensure each theme has light + dark variant

### Phase 3: Theme Generator/Editor
1. Build dashboard UI for live theme customization
2. Real-time preview with current embed
3. Export custom theme as preset

### Phase 4: Community Themes
1. Allow users to share custom themes
2. Theme marketplace/gallery
3. Import themes from popular design systems

---

## Benefits

1. **Consistency**: Semantic naming makes themes predictable
2. **Flexibility**: 50+ variables vs current 7
3. **Accessibility**: Proper color contrast pairs (foreground variants)
4. **Professional**: Match popular design systems (shadcn, Tailwind)
5. **DX**: Easier for users to customize
6. **Marketing**: "17 beautiful themes" vs "7 basic themes"

---

## Next Steps

1. ✅ Document current limitations
2. ⏳ Choose approach (Comprehensive vs Layered)
3. ⏳ Update widget CSS to support new tokens
4. ⏳ Create enhanced theme presets
5. ⏳ Build theme preview in dashboard
6. ⏳ Launch with marketing push

---

## Questions to Decide

1. **Comprehensive or Layered approach?**
   - Comprehensive = Full control, larger file
   - Layered = DRY, easier maintenance, inheritance complexity

2. **How many initial themes?**
   - Keep 7 and enhance them?
   - Launch with 17+ themes?

3. **Light/Dark mode strategy?**
   - Separate themes (ocean-light, ocean-dark)?
   - Single theme with mode toggle?
   - Both?

4. **Custom theme builder priority?**
   - Phase 3 feature?
   - MVP requirement?
