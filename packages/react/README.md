# @shoprocket/react

React components and hooks for building eCommerce experiences with Shoprocket.

## Installation

```bash
npm install @shoprocket/react @shoprocket/core
```

## Quick Start

### 1. Wrap your app with ShoprocketProvider

```jsx
import { ShoprocketProvider } from '@shoprocket/react';

function App() {
  return (
    <ShoprocketProvider publicKey="pk_your_public_key">
      <YourApp />
    </ShoprocketProvider>
  );
}
```

### 2. Use hooks and components

```jsx
import { useProducts, useCart, AddToCartButton } from '@shoprocket/react';

function Shop() {
  const { products, loading } = useProducts();
  const { cart } = useCart();

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      {products.map(product => (
        <div key={product.id}>
          <h3>{product.name}</h3>
          <p>${(product.price / 100).toFixed(2)}</p>
          <AddToCartButton productId={product.id} />
        </div>
      ))}
      
      <div>Cart items: {cart?.items?.length || 0}</div>
    </div>
  );
}
```

## Available Hooks

### useShoprocket()
Access the underlying SDK instance.

```jsx
const { sdk, initialized, error } = useShoprocket();
```

### useProducts(options)
Fetch and manage products.

```jsx
const { products, loading, error, meta } = useProducts({
  page: 1,
  perPage: 12,
  sort: 'created_at',
  filters: { category: 'shirts' }
});
```

### useProduct(productId)
Fetch a single product.

```jsx
const { product, loading, error } = useProduct('prod_123');
```

### useCart()
Manage shopping cart.

```jsx
const { 
  cart, 
  loading, 
  error,
  addItem, 
  updateItem, 
  removeItem 
} = useCart();

// Add item
await addItem('prod_123', 2);

// Update quantity
await updateItem('item_456', 3);

// Remove item
await removeItem('item_456');
```

## Available Components

### <ProductList />
Displays a grid of products.

```jsx
<ProductList 
  perPage={12}
  className="product-grid"
  renderProduct={(product) => <CustomProductCard product={product} />}
  onProductClick={(product) => console.log('Clicked:', product)}
/>
```

### <AddToCartButton />
Button to add products to cart.

```jsx
<AddToCartButton 
  productId="prod_123"
  variantId="var_456"
  quantity={1}
  className="btn btn-primary"
>
  Add to Bag
</AddToCartButton>
```

### <Cart />
Display current cart contents.

```jsx
<Cart className="shopping-cart" />
```

## TypeScript Support

This package includes TypeScript definitions. For better type inference:

```tsx
import type { Product, Cart } from '@shoprocket/react';
```

## License

MIT © Shoprocket Ltd.