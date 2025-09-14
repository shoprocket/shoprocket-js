import type { Money, Media } from '../types/api';
import type { ShoprocketCore } from '@shoprocket/core';
import { getConfig } from '../core/config';

/**
 * Get store currency from SDK or widget data
 */
function getStoreCurrency(): string {
  // Try to get from stored data or default
  const widget = (window as any).ShoprocketWidget;
  return widget?.store?.currency || 
         widget?.store?.currency_code || 
         widget?.store?.base_currency_code || 
         'USD';
}

/**
 * Format price for display
 */
export function formatPrice(price: Money | number | undefined | null): string {
  if (!price) {
    const currency = getStoreCurrency();
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(0);
  }
  
  if (typeof price === 'object') {
    const cents = price.amount || price.amount_cents || 0;
    const currency = price.currency || getStoreCurrency();
    
    // Use Intl.NumberFormat for proper currency formatting
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(cents / 100);
  }
  
  // Assume number is cents, get currency from store
  const currency = getStoreCurrency();
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency
  }).format(price / 100);
}

/**
 * Format price with range support
 */
export function formatPriceRange(product: { price: Money | number; price_min?: number; price_max?: number }): string {
  const basePrice = typeof product.price === 'object' ? product.price.amount : product.price;
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
  product: { price: Money | number; price_min?: number; price_max?: number },
  selectedVariantPrice?: number | Money
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
  const transforms = transformations || media.transformations || 'w=600,h=800,fit=cover';
  
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
  window.dispatchEvent(new CustomEvent('shoprocket:product:added', {
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