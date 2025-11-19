/**
 * Translation helper for widget components
 * Uses strings loaded from API via SDK StringsService
 * Always falls back to English if strings not loaded or API fails
 */

/**
 * Get a localized string
 * @param key - String key (e.g., 'cart.add_to_cart')
 * @param fallback - English fallback string
 * @returns Localized string or fallback
 *
 * @example
 * ```typescript
 * import { t } from '../utils/i18n';
 *
 * // In component render:
 * html`<button>${t('cart.add_to_cart', 'Add to Cart')}</button>`
 * ```
 */
export function t(key: string, fallback: string): string {
  // Access SDK via global window.Shoprocket
  const sdk = (window as any).Shoprocket?.sdk;

  // If SDK not initialized or strings not loaded, use fallback
  if (!sdk?.strings) {
    return fallback;
  }

  // Get string from SDK (StringsService handles fallback internally)
  return sdk.strings.get(key, fallback);
}
