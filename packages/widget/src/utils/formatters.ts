import type { Media, MediaUrls } from '@shoprocket/core';
import type { ShoprocketCore } from '@shoprocket/core';
import { getConfig } from '../core/config';

/**
 * Get store currency from SDK or widget data
 */
/**
 * The store's currency, published once by the widget manager after the store bootstrap resolves.
 *
 * It is cached in a module variable rather than read on demand because formatting happens during
 * synchronous render and `store.get()` is async - the previous version read `baseCurrencyCode` off
 * the returned PROMISE, so it silently formatted every price as USD no matter what the store was
 * set to. A wrong currency symbol on a price is not a cosmetic bug.
 */
let storeCurrency = 'USD';

export function setStoreCurrency(currency: string | undefined | null): void {
  if (currency) storeCurrency = currency;
}

function getStoreCurrency(): string {
  return storeCurrency;
}

/**
 * Get user's locale for formatting
 * Uses browser locale to respect user's regional preferences
 */
function getUserLocale(): string {
  return navigator.language || 'en-US';
}

/**
 * Format an integer-cent amount in the store's currency, in the shopper's locale.
 *
 * Cents in, string out - the wire's ONE money shape since the v3 Money object
 * (`{amount, formatted, …}`) was deleted. Undefined/null format as zero so a still-loading
 * total renders as a price, not as "undefined".
 */
export function formatPrice(price: number | undefined | null): string {
  return new Intl.NumberFormat(getUserLocale(), {
    style: 'currency',
    currency: getStoreCurrency(),
  }).format((price ?? 0) / 100);
}

/**
 * The variant a product-level surface (card, buy button, JSON-LD) should read when the shopper
 * hasn't chosen one: the served `isDefault` flag first, else the first. (There is no
 * product-level `defaultVariantId` on the wire - the flag lives on the variant.)
 */
export function defaultVariantOf<T extends { isDefault?: boolean }>(product: {
  variants?: T[];
}): T | undefined {
  const variants = product.variants ?? [];
  return variants.find(v => v.isDefault) ?? variants[0];
}

/**
 * The sale discount to badge a product card with, as a whole percentage - or null when nothing
 * is on sale. Derived from the served `compareAtPrice` on the default variant; v3 shipped this
 * inside the Money object (`isOnSale`/`discountPercentage`) and the wire no longer carries it.
 */
export function salePercentage(product: {
  variants?: Array<{ price: number; compareAtPrice?: number | null; isDefault?: boolean }>;
}): number | null {
  const v = defaultVariantOf(product);
  if (!v || typeof v.compareAtPrice !== 'number' || v.compareAtPrice <= v.price) return null;
  const pct = Math.round((1 - v.price / v.compareAtPrice) * 100);
  return pct > 0 ? pct : null;
}

/**
 * The cheapest and dearest variant price of a product, in integer cents.
 *
 * Price lives on VARIANTS, not on the product: the API has no product-level price because there
 * isn't one - a product with a $24 small and a $26 medium has a range, and any single number the
 * server picked would be a guess about what the card should say. Returns null when a product has
 * no variants at all, which a caller must treat as "no price to show" rather than as zero.
 */
export function productPriceRange(
  product: { variants?: Array<{ price: number }> }
): { min: number; max: number } | null {
  const prices = (product.variants ?? []).map(v => v.price).filter(p => typeof p === 'number');
  if (prices.length === 0) return null;
  return { min: Math.min(...prices), max: Math.max(...prices) };
}

/**
 * Format a product's price for a card or detail heading: a single price, or `From £x` when the
 * variants disagree.
 */
export function formatPriceRange(product: { variants?: Array<{ price: number }> }): string {
  const range = productPriceRange(product);
  if (!range) return '';
  return range.max > range.min ? `From ${formatPrice(range.min)}` : formatPrice(range.min);
}

/**
 * Format product price with variant support. A selected variant's price wins over the range,
 * because once a shopper has chosen one the range is no longer what they are buying.
 */
export function formatProductPrice(
  product: { variants?: Array<{ price: number }> },
  selectedVariantPrice?: number
): string {
  if (typeof selectedVariantPrice === 'number') return formatPrice(selectedVariantPrice);
  return formatPriceRange(product);
}

/**
 * Format date for display using user's locale
 * Examples:
 * - US: 10/19/2025
 * - UK: 19/10/2025
 * - German: 19.10.2025
 */
export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat(getUserLocale()).format(d);
}

/**
 * Format number with thousands separators using user's locale
 * Examples:
 * - US/UK: 1,000
 * - French: 1 000 (space)
 * - German: 1.000 (dot)
 */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat(getUserLocale()).format(value);
}

/**
 * Pick a rendition URL off a media object.
 *
 * The API resolves every rendition server-side and ships them as `urls` ({thumb, card, card2x,
 * gallery, gallery2x}), so the client no longer builds CDN paths by string concatenation. That
 * matters beyond tidiness: the transform vocabulary and the CDN host are then free to change
 * without every embedded widget in the wild constructing stale URLs.
 *
 * `url` is the untransformed original and is the fallback when a named rendition is absent.
 */
export function getMediaUrl(
  _sdk: ShoprocketCore,
  media: Media | null | undefined,
  rendition: keyof MediaUrls = 'card'
): string {
  if (!media) return `${getConfig().cdnUrl}/img/placeholder.svg`;
  return media.urls?.[rendition] ?? media.url ?? `${getConfig().cdnUrl}/img/placeholder.svg`;
}

/**
 * Responsive srcset from the server-resolved renditions. Only the pairs the API actually returned
 * are emitted, so a media object missing a rendition degrades to a smaller srcset rather than to a
 * broken URL.
 */
const SRCSET_WIDTHS: Array<[keyof MediaUrls, number]> = [
  ['thumb', 200],
  ['card', 400],
  ['card2x', 800],
  ['gallery', 1000],
  ['gallery2x', 2000],
];

export function getMediaSrcSet(_sdk: ShoprocketCore, media: Media | null | undefined): string {
  if (!media?.urls) return '';
  return SRCSET_WIDTHS.filter(([key]) => media.urls?.[key])
    .map(([key, width]) => `${media.urls![key]} ${width}w`)
    .join(', ');
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

