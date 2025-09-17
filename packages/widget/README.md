# Shoprocket Widget

Drop-in eCommerce widget for Shoprocket platform. This is the official widget that merchants can embed on their websites with just a few lines of code.

## License

This package is proprietary software. The source code is available for inspection and debugging purposes only.

Copyright © 2025 Shoprocket Ltd. All rights reserved.

## Usage (For Merchants)

### Quick Start

Add this single line to your website:

```html
<script src="https://cdn.shoprocket.io/v3/shoprocket.js?pk=YOUR_PUBLIC_KEY"></script>
```

That's it! The widget will:
- Automatically render a floating cart button
- Create a session for the user
- Load your store configuration
- Be ready to display products

### Features

#### Auto-Rendering Cart
By default, a floating cart button appears in the bottom-right corner of your site. Users can click it to view their cart and checkout.

To disable the automatic cart:
```html
<script src="https://cdn.shoprocket.io/v3/shoprocket.js?pk=YOUR_PUBLIC_KEY" data-no-cart></script>
```

To manually place the cart in a specific location:
```html
<div data-shoprocket="cart" data-position="top-left"></div>
```

Position options: `bottom-right` (default), `bottom-left`, `top-right`, `top-left`

#### Product Catalog
Display your full product catalog with pagination:

```html
<div data-shoprocket="catalog"></div>
```

Optional attributes:
- `data-limit="12"` - Products per page (default: 24)
- `data-style="grid"` - Display style: `grid` or `list`

#### Single Product View
Embed a specific product:

```html
<div data-shoprocket="product-view" data-product-id="prod_123"></div>
```

Or use the product slug:
```html
<div data-shoprocket="product-view" data-product-slug="awesome-tshirt"></div>
```

#### Feature Control
Show/hide specific features using data attributes:

```html
<!-- Hide specific features -->
<div data-shoprocket="product-view" 
     data-product-id="prod_123"
     data-hide="reviews,share">
</div>

<!-- Show only specific features -->
<div data-shoprocket="catalog" 
     data-show="title,price,add-to-cart">
</div>
```

### Navigation

The widget supports hash-based navigation:
- `#!/` - Product catalog
- `#!/page=2` - Catalog page 2
- `#!/product-slug` - Individual product view

### Theming

Customize colors using CSS variables:

```css
shoprocket-widget {
  --color-primary: #007bff;
  --color-surface: #ffffff;
  --color-text: #333333;
  /* See test-semantic-theming.html for all variables */
}
```

### Advanced Features

#### Preventing Duplicate Scripts
The widget automatically prevents issues from multiple script inclusions. If you accidentally include the script multiple times, you'll see a warning in the console, but the widget will continue to work correctly.

#### Empty States
The widget provides friendly messages when:
- No products are available in the catalog
- A product is not found (404)
- The cart is empty

#### Stock Display
Products show real-time inventory status:
- In stock quantity
- Low stock warnings
- Out of stock indicators

Configure stock display with data attributes:
```html
<div data-shoprocket="product" 
     data-product-id="123"
     data-stock-display="low-only"
     data-low-stock-threshold="5">
</div>
```

Stock display options:
- `always` - Always show stock quantity
- `low-only` - Only show when stock is low
- `off` - Never show stock

#### Widget Types Summary

| Widget | Purpose | Example |
|--------|---------|---------|
| `catalog` | Product listing with pagination | `<div data-shoprocket="catalog"></div>` |
| `product-view` | Standalone product embed | `<div data-shoprocket="product-view" data-product-id="123"></div>` |
| `cart` | Shopping cart (auto-rendered by default) | `<div data-shoprocket="cart"></div>` |

## Development

This package is part of the Shoprocket monorepo and is built using the `@shoprocket/core` SDK.

### Building

#### Development Build
```bash
npm run build:dev
# or simply
npm run build
```

#### Production Build (for deployment)
```bash
npm run build:production
# or
npm run build:prod
```

The production build:
- Removes all console.log statements
- Removes development-only code (localhost/test URL detection)
- Uses more aggressive minification (3 compression passes)
- Mangles private properties (those starting with _)
- Results in ~6KB smaller bundle

This creates:
- `dist/shoprocket.js` - Lightweight loader (0.68KB production, 1KB dev)
- `dist/shoprocket-bundle.js` - Main widget bundle (35KB gzipped production, 37KB dev)

### Size Target

- Maximum bundle size: **50KB** (gzipped, including styles)
- Current size: Check with `npm run size`

## For Shoprocket Team

### Deployment

Both files must be deployed to the CDN:
- Production: 
  - `https://cdn.shoprocket.io/v3/shoprocket.js` (loader)
  - `https://cdn.shoprocket.io/v3/shoprocket-bundle.js` (main bundle)

### Version Strategy

Widget versions are locked to the API version for compatibility:
- v3 widget works with v3 API
- Breaking changes require new major version