/**
 * Global configuration for the widget.
 * All values come from build-time env vars (VITE_*) — see .env.local,
 * .env.dev-server, .env.production.
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

export const initializeConfig = (_scriptUrl: string): void => {
  // Config is baked in at build time — nothing to derive at runtime.
  // The _scriptUrl param is kept for API compatibility.
  getConfigStorage();
};

export const getConfig = (): GlobalConfig => getConfigStorage();

export const setConfig = (newConfig: Partial<GlobalConfig>): void => {
  const current = getConfigStorage();
  window.__SHOPROCKET_CONFIG__ = { ...current, ...newConfig };
};
