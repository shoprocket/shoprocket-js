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
<div data-shoprocket="buy-button" data-product="123"></div>

<!-- Single Product -->
<div data-shoprocket="product" data-id="123" data-style="card"></div>

<!-- Product Collection -->
<div data-shoprocket="products" data-category="plants"></div>

<!-- Shopping Cart -->
<div data-shoprocket="cart" data-style="mini"></div>

<!-- Include loader (each embed works standalone) -->
<script src="https://cdn.shoprocket.io/v3/loader.js" async></script>
```

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