/**
 * Global configuration for the widget.
 * Values come from build-time env vars (VITE_*) - see .env.local,
 * .env.dev-server, .env.production - and may be overridden at runtime by a
 * `data-api-url` attribute on the loader script tag (see initializeConfig).
 */
export interface GlobalConfig {
  apiUrl: string;
  cdnUrl: string;
}

// Store config globally to survive code splitting
declare global {
  interface Window {
    __SHOPROCKET_CONFIG__?: GlobalConfig;
  }
}

const getConfigStorage = (): GlobalConfig => {
  if (!window.__SHOPROCKET_CONFIG__) {
    window.__SHOPROCKET_CONFIG__ = {
      apiUrl: import.meta.env.VITE_API_URL,
      cdnUrl: import.meta.env.VITE_CDN_URL,
    };
  }
  return window.__SHOPROCKET_CONFIG__;
};

/**
 * Read a runtime API URL override from the script tag.
 *
 * The loader copies `data-api-url` from its own tag onto the bundle script tag,
 * so either is a valid source. This exists so a storefront can be pointed at a
 * local or staging API without a rebuild - without it, VITE_API_URL is baked in
 * at build time and every iteration costs a full build.
 */
const getApiUrlOverride = (): string | null => {
  const tag =
    document.querySelector('script[data-shoprocket-bundle="true"][data-api-url]') ??
    document.querySelector('script[data-pk][data-api-url]');
  return tag?.getAttribute('data-api-url')?.trim() || null;
};

export const initializeConfig = (_scriptUrl: string): void => {
  // Base config is baked in at build time; the _scriptUrl param is kept for
  // API compatibility. A data-api-url attribute wins over the build-time value.
  getConfigStorage();

  const override = getApiUrlOverride();
  if (override) {
    setConfig({ apiUrl: override });
  }
};

export const getConfig = (): GlobalConfig => getConfigStorage();

export const setConfig = (newConfig: Partial<GlobalConfig>): void => {
  const current = getConfigStorage();
  window.__SHOPROCKET_CONFIG__ = { ...current, ...newConfig };
};
