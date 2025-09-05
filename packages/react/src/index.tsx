/**
 * @shoprocket/react
 * React components and hooks for Shoprocket
 */

// Hooks
export { useShoprocket } from './hooks/useShoprocket';
export { useProducts } from './hooks/useProducts';
export { useCart } from './hooks/useCart';
export { useProduct } from './hooks/useProduct';

// Components
export { ProductList } from './components/ProductList';
export { ProductCard } from './components/ProductCard';
export { AddToCartButton } from './components/AddToCartButton';
export { Cart } from './components/Cart';

// Context Provider
export { ShoprocketProvider } from './contexts/ShoprocketContext';

// Types
export type { ShoprocketConfig } from '@shoprocket/core';