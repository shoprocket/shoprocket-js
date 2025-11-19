/**
 * Translation helper for widget components
 * Uses strings loaded from API via SDK StringsService
 * Always falls back to English if strings not loaded or API fails
 */

/**
 * Get a localized string with optional placeholder substitution
 * @param key - String key (e.g., 'cart.add_to_cart')
 * @param fallback - English fallback string
 * @param replacements - Optional key-value pairs for placeholder substitution
 * @returns Localized string with placeholders replaced
 *
 * @example
 * ```typescript
 * import { t } from '../utils/i18n';
 *
 * // Simple string:
 * t('cart.add_to_cart', 'Add to Cart')
 *
 * // With placeholders:
 * t('product.stock_count', 'Only {count} left in stock', { count: 5 })
 * // Returns: "Only 5 left in stock"
 * ```
 */
export function t(key: string, fallback: string, replacements?: Record<string, string | number>): string {
  // Access SDK via global window.Shoprocket
  const sdk = (window as any).Shoprocket?.sdk;

  // If SDK not initialized or strings not loaded, use fallback
  if (!sdk?.strings) {
    return replacePlaceholders(fallback, replacements);
  }

  // Get string from SDK (StringsService handles fallback internally)
  const translatedString = sdk.strings.get(key, fallback);

  // Replace placeholders if provided
  return replacePlaceholders(translatedString, replacements);
}

/**
 * Replace {placeholder} tokens in a string with values
 * @param text - String with {placeholder} tokens
 * @param replacements - Key-value pairs for replacement
 * @returns String with placeholders replaced
 */
function replacePlaceholders(text: string, replacements?: Record<string, string | number>): string {
  if (!replacements) {
    return text;
  }

  return text.replace(/\{(\w+)\}/g, (match, key) => {
    return replacements[key] !== undefined ? String(replacements[key]) : match;
  });
}
