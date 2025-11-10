# Enhanced Theme System - Implementation Guide

## What I've Created

### 1. **Enhanced Theme Config** (`/shoprocketv3/config/widget-themes-enhanced.php`)

A complete replacement for your current theme system with:
- **5 complete themes** (each with light + dark modes)
- **40+ CSS variables per theme** (vs current 7-9)
- **Semantic naming** following shadcn/ui conventions
- **Backward compatibility** with legacy variable names

### Themes Included:
1. **Modern Minimal** - Clean professional (matches your current "default")
2. **Neo Brutalism** - Bold, harsh borders, zero radius
3. **Cosmic Night** - Deep purples and space vibes
4. **Ocean Breeze** - Fresh blues and teals
5. **Retro Arcade** - Neon 80s nostalgia

---

## Variable System

### Color Tokens (~30 variables)

#### Base Colors
- `--color-background` / `--color-foreground`

#### Interactive
- `--color-primary` / `--color-primary-foreground`
- `--color-secondary` / `--color-secondary-foreground`

#### UI Elements
- `--color-card` / `--color-card-foreground`
- `--color-popover` / `--color-popover-foreground`
- `--color-muted` / `--color-muted-foreground`
- `--color-accent` / `--color-accent-foreground`

#### States
- `--color-destructive` / `--color-destructive-foreground`
- `--color-success` / `--color-success-foreground`
- `--color-warning` / `--color-warning-foreground`

#### Borders & Inputs
- `--color-border`
- `--color-input`
- `--color-ring`

#### Cart/Drawer Specific
- `--color-drawer`
- `--color-drawer-foreground`
- `--color-drawer-primary` / `--color-drawer-primary-foreground`
- `--color-drawer-border`

### Radius Tokens (~6 variables)
- `--radius-sm` (0.25rem)
- `--radius-md` (0.375rem)
- `--radius-lg` (0.5rem)
- `--radius-button`
- `--radius-card`
- `--radius-input`

### Shadow Tokens (~6 variables)
- `--shadow-color` (HSL color)
- `--shadow-opacity` (0-1)
- `--shadow-blur` (px)
- `--shadow-spread` (px)
- `--shadow-offset-x` (px)
- `--shadow-offset-y` (px)

### Typography Tokens (~3 variables)
- `--font-sans`
- `--font-serif` (optional)
- `--font-mono`

### Legacy Compatibility (~4 variables)
Maps old names to new system:
- `--color-surface` → `--color-background`
- `--color-text` → `--color-foreground`
- `--color-error` → `--color-destructive`
- `--sr-radius` → `--radius-md`

---

## Implementation Steps

### Phase 1: Backend - Theme Generation

**1. Update Theme CSS Generator**

Current location: Likely in a controller or service that generates CSS from config.

**Current approach (assumed):**
```php
// Generate CSS like:
.shoprocket[data-theme="ocean"] {
    --color-primary: #2563eb;
    --color-surface: #ffffff;
    // ... 7-9 variables
}
```

**New approach:**
```php
// Generate CSS like:
.shoprocket[data-theme="ocean-breeze"][data-mode="light"] {
    --color-background: #f0f9ff;
    --color-foreground: #0c4a6e;
    --color-primary: #0ea5e9;
    // ... 40+ variables
}

.shoprocket[data-theme="ocean-breeze"][data-mode="dark"] {
    --color-background: #082f49;
    --color-foreground: #e0f2fe;
    // ... 40+ variables
}
```

**Implementation:**
```php
// In your theme CSS generation service/controller
public function generateThemeCSS(string $themeId, string $mode = 'light'): string
{
    $config = config('widget-themes-enhanced');
    $theme = $config['presets'][$themeId] ?? null;

    if (!$theme) {
        return '';
    }

    $variables = $theme[$mode] ?? $theme['light'];

    $css = ".shoprocket[data-theme=\"{$themeId}\"][data-mode=\"{$mode}\"] {\n";
    foreach ($variables as $property => $value) {
        $css .= "    {$property}: {$value};\n";
    }
    $css .= "}\n";

    return $css;
}
```

**2. Update API Responses**

Add `mode` field to embed config:
```php
// EmbedConfigResource.php
return [
    'widgetType' => $this->widget_type,
    'theme' => $this->theme_id,
    'themeMode' => $this->theme_mode ?? 'light', // NEW
    'themeCssUrl' => $this->theme_css_url,
    'configuration' => $this->configuration,
];
```

**3. Update Database (Optional)**

If you want to store mode preference per embed:
```php
// Migration
Schema::table('store_embeds', function (Blueprint $table) {
    $table->enum('theme_mode', ['light', 'dark', 'auto'])->default('light');
});
```

**4. Update Dashboard UI**

Add mode selector in embed manager:
```html
<!-- manage-embed.blade.php -->
<x-dashboard.common.form.select-field
    name="theme_mode"
    wire:model.live="theme_mode"
    :config="[
        'label' => __('Theme Mode'),
        'options' => [
            ['value' => 'light', 'label' => __('Light')],
            ['value' => 'dark', 'label' => __('Dark')],
            ['value' => 'auto', 'label' => __('Auto (match user preference)')],
        ],
    ]"
/>
```

---

### Phase 2: Frontend - Widget Updates

**1. Update Widget Manager**

```typescript
// widget-manager.ts - mountEmbed() method

const mode = embedConfig.themeMode || 'light';

// Set both theme and mode attributes
if (embedConfig.theme) {
    component.setAttribute('data-theme', embedConfig.theme);
    component.setAttribute('data-mode', mode);
}
```

**2. Update Widget CSS**

Your widget already has most variables defined! Just need to map them:

```css
/* styles.css - Update existing usage */

/* OLD */
.sr-button {
    background: var(--color-primary);
    color: var(--color-text); /* ❌ Not semantic */
}

/* NEW */
.sr-button {
    background: var(--color-primary);
    color: var(--color-primary-foreground); /* ✅ Semantic */
}

/* Cards */
.sr-product-card {
    background: var(--color-card);
    color: var(--color-card-foreground);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-card);
}

/* Inputs */
.sr-input {
    background: var(--color-background);
    border: 1px solid var(--color-input);
    border-radius: var(--radius-input);
    color: var(--color-foreground);
}

/* Drawer/Cart */
.sr-cart-panel {
    background: var(--color-drawer);
    color: var(--color-drawer-foreground);
    border: 1px solid var(--color-drawer-border);
}

/* Shadows using new granular system */
.sr-card-elevated {
    box-shadow:
        var(--shadow-offset-x, 0px)
        var(--shadow-offset-y, 2px)
        var(--shadow-blur, 10px)
        var(--shadow-spread, 0px)
        color-mix(in srgb, var(--shadow-color, #000) var(--shadow-opacity, 0.1), transparent);
}
```

**3. Add Auto Mode Support**

```typescript
// Add to widget initialization
function detectPreferredMode(): 'light' | 'dark' {
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
    }
    return 'light';
}

// In mount logic
let mode = embedConfig.themeMode;
if (mode === 'auto') {
    mode = detectPreferredMode();
}
component.setAttribute('data-mode', mode);

// Listen for changes
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (embedConfig.themeMode === 'auto') {
        component.setAttribute('data-mode', e.matches ? 'dark' : 'light');
    }
});
```

---

### Phase 3: Preview Updates

**1. Update Preview Blade Template**

```javascript
// preview.blade.php
iframe.contentWindow.SHOPROCKET_PREVIEW_CONFIG = {
    'preview-embed': {
        widgetType: @json($widgetType),
        theme: @json($themeId),
        themeMode: @json($themeMode ?? 'light'), // NEW
        themeCssUrl: @json($themeCssUrl),
        configuration: camelConfig
    }
};
```

**2. Add Live Mode Toggle**

```html
<!-- In dashboard preview UI -->
<div x-data="{ mode: @entangle('theme_mode') }">
    <button @click="mode = mode === 'light' ? 'dark' : 'light'">
        <span x-show="mode === 'light'">🌙 Dark</span>
        <span x-show="mode === 'dark'">☀️ Light</span>
    </button>
</div>
```

---

## Testing Checklist

### Backend
- [ ] Theme CSS generates correctly for each mode
- [ ] API returns themeMode in embed config
- [ ] Dashboard preview shows mode selector
- [ ] Mode toggle updates preview in real-time
- [ ] Cache invalidates when mode changes

### Frontend
- [ ] Widget reads data-mode attribute
- [ ] Auto mode detects system preference
- [ ] Auto mode updates on preference change
- [ ] All colors have proper contrast (foreground variants)
- [ ] Shadows render correctly with new system
- [ ] Radius applies to all components
- [ ] Fonts load correctly per theme

### Visual Regression
- [ ] Test each theme in light mode
- [ ] Test each theme in dark mode
- [ ] Compare against current themes
- [ ] Check accessibility (contrast ratios)
- [ ] Test on light and dark backgrounds

---

## Migration Strategy

### Option A: Big Bang (Recommended)
1. Swap config file (`widget-themes.php` → `widget-themes-enhanced.php`)
2. Update all backend code
3. Update all frontend code
4. Deploy both simultaneously
5. Legacy variables still work (backward compatible)

### Option B: Gradual
1. Add new themes alongside old ones
2. Support both old and new variable names
3. Migrate themes one by one
4. Deprecate old system after 3 months

---

## Marketing Opportunities

### Before vs After

**Before:**
- 7 basic themes
- 7-9 customization options
- Light mode only
- Basic styling

**After:**
- 10+ professional themes (5 complete, 5+ coming)
- 40+ customization options
- Light + Dark mode for every theme
- Advanced styling (shadows, fonts, semantic colors)
- One-click dark mode toggle
- Auto-detect user preference

### Messaging Ideas
- "17 Beautiful Themes (10 new!)"
- "Advanced Dark Mode Support"
- "40+ Customization Options"
- "Professional Design System"
- "Match Any Brand"

---

## Next Steps Priority

1. **High Priority:**
   - [ ] Update theme CSS generator (backend)
   - [ ] Test one theme end-to-end (modern-minimal)
   - [ ] Update widget-manager.ts for mode support

2. **Medium Priority:**
   - [ ] Add mode selector to dashboard
   - [ ] Update widget CSS to use semantic tokens
   - [ ] Add auto mode detection

3. **Low Priority:**
   - [ ] Create 5 more themes (total 10)
   - [ ] Theme preview gallery
   - [ ] Custom theme builder UI

---

## Files to Update

### Backend (`/shoprocketv3`)
- [ ] `config/widget-themes-enhanced.php` (✅ created)
- [ ] Theme CSS generation service/controller
- [ ] `app/Http/Resources/Api/V3/EmbedConfigResource.php`
- [ ] `resources/views/livewire/dashboard/store/manage-embed.blade.php`
- [ ] `resources/views/livewire/dashboard/embeds/preview.blade.php`
- [ ] Migration (optional, if storing mode in DB)

### Frontend (`/shoprocket-js`)
- [ ] `packages/widget/src/core/widget-manager.ts`
- [ ] `packages/widget/src/styles.css` (update color usage)
- [ ] `packages/widget/src/components/cart.ts` (drawer colors)
- [ ] `packages/widget/src/components/product-catalog.ts` (card colors)

---

## Questions to Decide

1. **Storage:** Store theme_mode in database or just in config?
   - DB = Persistent preference per embed
   - Config = Lighter, uses global default

2. **Auto Mode:** Enable by default?
   - Yes = Better UX, respects user preference
   - No = More predictable for sellers

3. **Theme Count:** Launch with 5 or wait for 10?
   - 5 = Ship faster, iterate
   - 10 = Bigger splash, more options

4. **Naming:** Keep "ocean-breeze" or shorten to "ocean"?
   - Descriptive names = Clearer intent
   - Short names = Easier to type/remember

5. **Backward Compat:** Support old themes indefinitely?
   - Yes = No breaking changes
   - Deprecate = Cleaner codebase long-term
