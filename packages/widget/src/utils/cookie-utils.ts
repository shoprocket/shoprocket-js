/**
 * Simple cookie utilities for client-side storage
 */

/**
 * Set a cookie with the given name and value
 * @param name Cookie name
 * @param value Cookie value
 * @param days Number of days until expiry (default: 7)
 */
export const setCookie = (name: string, value: string, days = 7): void => {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; samesite=strict${window.location.protocol === 'https:' ? '; secure' : ''}`;
};

/**
 * Get a cookie value by name
 * @param name Cookie name
 * @returns Cookie value or null if not found
 */
export const getCookie = (name: string): string | null => {
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return match && match[2] ? decodeURIComponent(match[2]) : null;
};