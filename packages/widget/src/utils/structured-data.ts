/**
 * Structured Data (Schema.org JSON-LD) Utilities
 *
 * Injects structured data into the document head for SEO and rich results.
 * Even though our widgets use Shadow DOM, Google can still read JSON-LD
 * when it's injected into the document head.
 *
 * @see https://developers.google.com/search/docs/appearance/structured-data/product
 * @see https://schema.org/Product
 */

import type { Product, Store, ShoprocketCore } from '@shoprocket/core';
import { getMediaUrl } from './formatters';

/**
 * Schema.org Product type
 */
interface ProductSchema {
  '@context': 'https://schema.org';
  '@type': 'Product';
  name: string;
  image: string[]; // Required by Google - must have at least one URL
  description?: string;
  sku?: string;
  brand?: {
    '@type': 'Brand';
    name: string;
  };
  offers: {
    '@type': 'Offer';
    price: string;
    priceCurrency: string;
    availability: string;
    url: string;
  };
  aggregateRating?: {
    '@type': 'AggregateRating';
    ratingValue: number;
    reviewCount: number;
  };
}

/**
 * Schema.org availability values
 */
const AVAILABILITY = {
  IN_STOCK: 'https://schema.org/InStock',
  OUT_OF_STOCK: 'https://schema.org/OutOfStock',
  PRE_ORDER: 'https://schema.org/PreOrder',
  DISCONTINUED: 'https://schema.org/Discontinued',
} as const;

/**
 * Generate product URL for schema
 */
function getProductUrl(product: Product): string {
  const baseUrl = window.location.href.split('#')[0];
  const productSlug = product.slug || product.id;
  return `${baseUrl}#product/${productSlug}`;
}

/**
 * Get availability status based on inventory
 */
function getAvailability(product: Product): string {
  // Check if tracking inventory
  if (product.trackInventory === false) {
    return AVAILABILITY.IN_STOCK;
  }

  // Check inventory count
  const count = product.inventoryCount ?? 0;
  return count > 0 ? AVAILABILITY.IN_STOCK : AVAILABILITY.OUT_OF_STOCK;
}

/**
 * Format price for schema (must be string without currency symbol)
 */
function formatPrice(product: Product): string {
  if (typeof product.price === 'number') {
    // Price in cents, convert to decimal
    return (product.price / 100).toFixed(2);
  }

  if (product.price && typeof product.price === 'object' && 'amount' in product.price) {
    return (product.price.amount / 100).toFixed(2);
  }

  return '0.00';
}

/**
 * Get currency code from product price
 */
function getCurrency(product: Product): string {
  if (product.price && typeof product.price === 'object' && 'currency' in product.price) {
    return product.price.currency.toUpperCase();
  }
  return 'USD'; // Default fallback
}

/**
 * Generate Schema.org Product JSON-LD
 */
export function generateProductSchema(product: Product, sdk: ShoprocketCore, store?: Store): ProductSchema {
  const schema: ProductSchema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    offers: {
      '@type': 'Offer',
      price: formatPrice(product),
      priceCurrency: getCurrency(product),
      availability: getAvailability(product),
      url: getProductUrl(product),
    },
  };

  // Add description if available
  if (product.description) {
    schema.description = product.description;
  }

  // Add images - REQUIRED by Google (must have at least one URL)
  // Use getMediaUrl() helper to properly extract image URLs (same logic as widget rendering)
  const images = product.media && product.media.length > 0
    ? product.media
        .slice(0, 5) // Google recommends max 5 images
        .map(m => getMediaUrl(sdk, m))
        .filter(url => url && !url.includes('placeholder.svg')) // Exclude placeholders
    : [];

  // Always include image field with at least one URL
  // Use 1x1 transparent GIF placeholder if no images (minimal 43 bytes)
  schema.image = images.length > 0
    ? images
    : ['data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'];

  // Add SKU if available
  if (product.sku) {
    schema.sku = product.sku;
  }

  // Add brand (store name) if available
  if (store?.name) {
    schema.brand = {
      '@type': 'Brand',
      name: store.name,
    };
  }

  // Add aggregate rating if available
  // Note: This would need to be added to the Product type in the future
  // if (product.rating && product.review_count) {
  //   schema.aggregateRating = {
  //     '@type': 'AggregateRating',
  //     ratingValue: product.rating,
  //     reviewCount: product.review_count,
  //   };
  // }

  return schema;
}

/**
 * Inject Product schema into document head
 *
 * @param product - Product data
 * @param sdk - Shoprocket SDK instance for media URL construction
 * @param store - Optional store data for brand info
 */
export function injectProductSchema(product: Product, sdk: ShoprocketCore, store?: Store): void {
  // Check if schema already exists for this product
  const existingSchema = document.querySelector(`script[data-shoprocket-schema="${product.id}"]`);
  if (existingSchema) {
    return; // Already injected
  }

  const schema = generateProductSchema(product, sdk, store);

  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.setAttribute('data-shoprocket-schema', product.id);
  script.setAttribute('data-shoprocket-type', 'product');
  script.textContent = JSON.stringify(schema, null, 0); // Minified

  // Inject into document head (NOT shadow root)
  document.head.appendChild(script);
}

/**
 * Remove product schema from document head
 *
 * @param productId - Product ID to remove
 */
export function removeProductSchema(productId: string): void {
  const script = document.querySelector(`script[data-shoprocket-schema="${productId}"]`);
  if (script) {
    script.remove();
  }
}

/**
 * Update existing product schema
 *
 * @param product - Updated product data
 * @param sdk - Shoprocket SDK instance for media URL construction
 * @param store - Optional store data
 */
export function updateProductSchema(product: Product, sdk: ShoprocketCore, store?: Store): void {
  removeProductSchema(product.id);
  injectProductSchema(product, sdk, store);
}

/**
 * Remove all Shoprocket schemas from document
 * Useful for cleanup when unmounting all widgets
 */
export function removeAllSchemas(): void {
  const scripts = document.querySelectorAll('script[data-shoprocket-schema]');
  scripts.forEach(script => script.remove());
}

/**
 * Get all injected schema IDs
 * Useful for debugging and tracking
 */
export function getInjectedSchemaIds(): string[] {
  const scripts = document.querySelectorAll('script[data-shoprocket-schema]');
  return Array.from(scripts).map(script => script.getAttribute('data-shoprocket-schema') || '');
}
