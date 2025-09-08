# Shoprocket JavaScript SDK

Modern, lightweight JavaScript SDK and embeddable widgets for Shoprocket v3.

## 🚀 Overview

This monorepo contains the JavaScript packages for Shoprocket's API-first eCommerce platform:

- **[@shoprocket/core](packages/core)** - Core SDK for API communication
- **[@shoprocket/widget](packages/widget)** - Embeddable eCommerce widgets (proprietary)
- **[@shoprocket/react](packages/react)** - React hooks and components

## 📦 Quick Start

Add eCommerce to any website with our embed system:

```html
<!-- Buy Button -->
<div data-shoprocket="buy-button" data-product="{prod_id}"></div>

<!-- Single Product Display -->
<div data-shoprocket="product" data-id="{prod_id}" data-style="card"></div>

<!-- Product Collection -->
<div data-shoprocket="products" data-category="{category_id}"></div>

<!-- Multiple Categories (comma-separated) -->
<div data-shoprocket="products" data-category="{category_id1},{category_id2}"></div>

<!-- Shopping Cart - Multiple Styles & Positions -->
<!-- Bubble style (mobile: sidebar, desktop: bubble) -->
<div data-shoprocket="cart" data-position="bottom-right" data-style="bubble"></div>

<!-- Sidebar style (slides from edge) -->
<div data-shoprocket="cart" data-position="bottom-left" data-style="sidebar"></div>

<!-- Include loader (each embed works standalone) -->
<script src="https://cdn.shoprocket.io/v3/loader.js?pk={public_key}" async></script>
```

### Available Cart Positions
- `bottom-right` (default)
- `bottom-left`
- `top-right` 
- `top-left`
- `middle-right`
- `middle-left`

### Available Cart Styles
- `bubble` - Responsive: sidebar on mobile, bubble on desktop
- `sidebar` - Always slides from screen edge

### Product Collection Options
- **Single category**: `data-category="{category_id}"`
- **Multiple categories**: `data-category="{cat1},{cat2},{cat3}"` (comma-separated)
- **All products**: Omit `data-category` attribute

## 👩‍💻 For Developers

### Core SDK

Lightweight API client for custom integrations:

```bash
npm install @shoprocket/core
```

```javascript
import { ShoprocketCore } from '@shoprocket/core';

const sr = new ShoprocketCore({ publicKey: 'pk_...' });
const products = await sr.products.list();
```

### React Components

Pre-built components for React apps:

```bash
npm install @shoprocket/react
```

```jsx
import { ShoprocketProvider, ProductList } from '@shoprocket/react';

function App() {
  return (
    <ShoprocketProvider publicKey="pk_...">
      <ProductList />
    </ShoprocketProvider>
  );
}
```

## 🎯 Design Philosophy

- **API-First**: Everything happens through our API
- **Lightweight**: Core SDK < 10KB, Widget < 50KB
- **Framework Agnostic**: Use with any tech stack
- **No Bloat**: You only load what you need

## 📊 Bundle Sizes

| Package | Size (min) | Size (gzip) |
|---------|-----------|-------------|
| @shoprocket/core | < 10KB | < 3KB |
| @shoprocket/react | < 15KB | < 5KB |
| Widget | < 50KB | < 15KB |

## 🏗️ Repository Structure

This is a monorepo managed with npm workspaces:

```
packages/
├── core/       # Public npm package (MIT)
├── widget/     # Proprietary widget (CDN only)
└── react/      # Public npm package (MIT)
```

## 🛠️ Development

### Prerequisites

- Node.js >= 18
- npm >= 9

### Setup

```bash
# Clone the repository
git clone https://github.com/shoprocket/shoprocket-js.git
cd shoprocket-js

# Install dependencies
npm install

# Start development
npm run dev
```

### Building

```bash
# Build all packages
npm run build

# Build specific package
npm run build --workspace=@shoprocket/core
```

## 📄 License

- **@shoprocket/core** - MIT License
- **@shoprocket/react** - MIT License  
- **Widget** - Proprietary (see [LICENSE](packages/widget/LICENSE))

## 🔗 Links

- [Documentation](https://docs.shoprocket.io)
- [API Reference](https://api.shoprocket.io/docs)
- [Dashboard](https://app.shoprocket.io)
- [Website](https://shoprocket.io)

## 🤝 Contributing

While the widget is proprietary, we welcome contributions to our open-source packages! 

However, we're currently focused on core development and not accepting PRs. Feel free to:
- Report bugs via [Issues](https://github.com/shoprocket/shoprocket-js/issues)
- Star the repo to show support
- Share feedback

## 💬 Support

- Email: support@shoprocket.io
- Discord: [Join our community](https://discord.gg/shoprocket)
- Twitter: [@shoprocket](https://twitter.com/shoprocket)

---

© 2025 Shoprocket Ltd. All rights reserved.