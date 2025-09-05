# @shoprocket/core

Lightweight core SDK for Shoprocket eCommerce platform. This package provides a simple API client for interacting with Shoprocket stores.

## Installation

```bash
npm install @shoprocket/core
```

## Usage

```javascript
import { ShoprocketCore } from '@shoprocket/core';

// Initialize the SDK
const shoprocket = new ShoprocketCore({
  publicKey: 'pk_your_public_key'
});

// Get products
const products = await shoprocket.products.list();

// Add to cart
await shoprocket.cart.addItem('prod_123', 1);
```

## Bundle Size

This package is designed to be extremely lightweight:
- **< 10KB** minified
- **< 3KB** gzipped
- Zero dependencies

## API Reference

### Initialize

```javascript
const shoprocket = new ShoprocketCore({
  publicKey: 'pk_xxx',     // Required
  apiUrl: 'https://...',   // Optional custom API URL
  locale: 'en',            // Optional locale
  sessionToken: 'xxx'      // Optional session token
});
```

### Products

```javascript
// List products
const products = await shoprocket.products.list({
  page: 1,
  per_page: 12,
  sort: 'created_at'
});

// Get single product
const product = await shoprocket.products.get('prod_123');
```

### Cart

```javascript
// Get cart
const cart = await shoprocket.cart.get();

// Add item
await shoprocket.cart.addItem('prod_123', 2);

// Update quantity
await shoprocket.cart.updateItem('item_456', 3);

// Remove item
await shoprocket.cart.removeItem('item_456');
```

### Session

```javascript
// Create session
const session = await shoprocket.session.create();
shoprocket.setSessionToken(session.session_token);
```

## License

MIT © Shoprocket Ltd.