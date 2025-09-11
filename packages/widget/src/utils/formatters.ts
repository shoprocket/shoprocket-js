import type { Money, Media } from '../types/api';
import type { ShoprocketCore } from '@shoprocket/core';
import { getConfig } from '../core/config';

/**
 * Format price for display
 */
export function formatPrice(price: Money | number | undefined | null): string {
  if (!price) return '$0.00';
  
  if (typeof price === 'object') {
    const cents = price.amount || price.amount_cents || 0;
    const currency = price.currency || 'USD';
    
    // Use Intl.NumberFormat for proper currency formatting
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(cents / 100);
  }
  
  // Assume number is cents
  return `$${(price / 100).toFixed(2)}`;
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
  const path = media.path || media.id;
  const filename = media.filename || media.name || '';
  
  return `${mediaUrl}/${transforms}/${path}/${filename}`;
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