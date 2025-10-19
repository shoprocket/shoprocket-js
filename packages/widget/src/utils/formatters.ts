import type { Money, Media } from '../types/api';
import type { ShoprocketCore } from '@shoprocket/core';
import { getConfig } from '../core/config';
import { IMAGE_SIZES, RESPONSIVE_SIZES, WIDGET_EVENTS } from '../constants';

/**
 * Get store currency from SDK or widget data
 */
function getStoreCurrency(): string {
  // Try to get from stored data or default
  const store = (window as any).Shoprocket?.store?.get?.();
  return store?.base_currency_code || 'USD';
}

/**
 * Format price for display
 */
export function formatPrice(price: Money | undefined | null | number): string {
  if (!price && price !== 0) {
    const currency = getStoreCurrency();
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(0);
  }
  
  // If it's just a number (subtotal), format it
  if (typeof price === 'number') {
    const currency = getStoreCurrency();
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(price / 100); // Assuming amounts are in cents
  }
  
  // API always returns formatted price - use it directly
  if ((price as Money).formatted) {
    return (price as Money).formatted;
  }
  
  // Format if API didn't provide formatted string
  const priceObj = price as Money;
  const currency = priceObj.currency || getStoreCurrency();
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency
  }).format(priceObj.amount / 100);
}

/**
 * Format price with range support
 */
export function formatPriceRange(product: { price: Money; price_min?: number; price_max?: number }): string {
  const basePrice = product.price.amount;
  const hasRange = product.price_max && product.price_max > basePrice;
  
  if (hasRange) {
    return `From ${formatPrice(product.price)}`;
  }
  
  return formatPrice(product.price);
}

/**
 * Format product price with variant support
 */
export function formatProductPrice(
  product: { price: Money; price_min?: number; price_max?: number },
  selectedVariantPrice?: Money
): string {
  // If a specific variant is selected, show its price
  if (selectedVariantPrice) {
    return formatPrice(selectedVariantPrice);
  }
  
  // Otherwise show price range if applicable
  return formatPriceRange(product);
}

/**
 * Format date for display
 */
export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-US').format(d);
}

/**
 * Format number with thousands separators using user's locale
 * Examples:
 * - US/UK: 1,000
 * - French: 1 000 (space)
 * - German: 1.000 (dot)
 */
export function formatNumber(value: number): string {
  // Use browser locale, fallback to en-US
  const locale = navigator.language || 'en-US';
  return new Intl.NumberFormat(locale).format(value);
}

/**
 * Build media URL with transformations
 */
export function getMediaUrl(_sdk: ShoprocketCore, media: Media | null | undefined, transformations?: string): string {
  const config = getConfig();
  const baseUrl = config.cdnUrl;

  // Return placeholder if no media provided
  if (!media) {
    return `${baseUrl}/img/placeholder.svg`;
  }

  // If media has a direct URL, use it
  if (media.url) {
    return media.url;
  }

  // Otherwise construct the URL
  const mediaUrl = `${baseUrl}/media`;
  const transforms = transformations || media.transformations || IMAGE_SIZES.PLACEHOLDER;

  // The path already includes the filename in the API response
  const path = media.path || media.id;

  return `${mediaUrl}/${transforms}/${path}`;
}

/**
 * Generate srcset for responsive images
 * Returns a srcset string with multiple image sizes for different viewport widths
 */
export function getMediaSrcSet(_sdk: ShoprocketCore, media: Media | null | undefined): string {
  const config = getConfig();
  const baseUrl = config.cdnUrl;

  // Return empty string if no media
  if (!media || !media.path) {
    return '';
  }

  const mediaUrl = `${baseUrl}/media`;
  const path = media.path || media.id;

  // Generate srcset entries for each responsive size
  const srcsetEntries = Object.values(RESPONSIVE_SIZES).map(
    ({ width, transform }) => `${mediaUrl}/${transform}/${path} ${width}w`
  );

  return srcsetEntries.join(', ');
}

/**
 * Get sizes attribute for responsive images
 * Tells browser which image size to use at different viewport widths
 *
 * Uses conservative percentage-based estimates that work even if users
 * customize padding/gaps via CSS variables. Browser will select the closest
 * srcset image, so slightly overestimating is better than underestimating.
 *
 * Grid layout defaults (customizable by users):
 * - Mobile (<640px): 2 columns → ~45% viewport (allows for padding/gaps)
 * - Tablet (640-1024px): 3 columns → ~30% viewport
 * - Desktop (>1024px): 4 columns → ~23% viewport
 */
export function getMediaSizes(gridColumns: { sm?: number; md?: number; lg?: number } = {}): string {
  const { sm = 2, md = 3, lg = 4 } = gridColumns;

  // Conservative estimates that account for padding/gaps
  // These work even if users customize --sr-product-grid-padding or grid gaps
  // Formula: roughly (100 / columns) - 5-8% buffer for padding/gaps
  const smSize = Math.floor(100 / sm - 5); // 2 cols = 45vw
  const mdSize = Math.floor(100 / md - 3); // 3 cols = 30vw
  const lgSize = Math.floor(100 / lg - 2); // 4 cols = 23vw

  return `(max-width: 640px) ${smSize}vw, (max-width: 1024px) ${mdSize}vw, ${lgSize}vw`;
}

/**
 * Handle image error by showing placeholder
 */
export function handleImageError(_sdk: ShoprocketCore, e: Event): void {
  const img = e.target as HTMLImageElement;
  const config = getConfig();
  const placeholderUrl = `${config.cdnUrl}/img/placeholder.svg`;
  
  // Prevent infinite loop if placeholder also fails
  if (img.src !== placeholderUrl) {
    img.src = placeholderUrl;
  }
}

/**
 * Dispatch cart updated events after adding to cart
 */
export function dispatchCartEvents(
  element: EventTarget,
  product: {
    id: string;
    name: string;
    price?: number;
    media?: any;
  },
  variantId?: string,
  variantText?: string | null
): void {
  // Dispatch cart updated event
  element.dispatchEvent(new CustomEvent('shoprocket:cart:updated', {
    bubbles: true,
    composed: true,
    detail: { productId: product.id, variantId }
  }));

  // Dispatch product added event
  window.dispatchEvent(new CustomEvent(WIDGET_EVENTS.PRODUCT_ADDED, {
    detail: { 
      product: {
        id: product.id,
        name: product.name,
        price: product.price,
        media: product.media,
        variantText
      }
    }
  }));
}