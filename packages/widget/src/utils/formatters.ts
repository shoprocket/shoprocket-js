import type { Money, Media } from '../types/api';
import type { ShoprocketCore } from '@shoprocket/core';
import { getConfig } from '../core/config';
import { IMAGE_SIZES, WIDGET_EVENTS } from '../constants';

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