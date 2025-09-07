import type { Money, Media } from '../types/api';
import type { ShoprocketCore } from '@shoprocket/core';

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
export function getMediaUrl(sdk: ShoprocketCore, media: Media | null | undefined, transformations?: string): string {
  // Get base URL from SDK config
  const apiUrl = sdk.getApiUrl();
  const baseUrl = apiUrl.replace('/api/v3', '');
  
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
export function handleImageError(sdk: ShoprocketCore, e: Event): void {
  const img = e.target as HTMLImageElement;
  const apiUrl = sdk.getApiUrl();
  const baseUrl = apiUrl.replace('/api/v3', '');
  img.src = `${baseUrl}/img/placeholder.svg`;
}