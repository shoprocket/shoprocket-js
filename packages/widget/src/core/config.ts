/**
 * Global configuration for the widget
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

// Default config
const getDefaultConfig = (): GlobalConfig => ({
  apiUrl: 'https://api.shoprocket.io/api/v3',
  cdnUrl: 'https://cdn.shoprocket.io'
});

// Use global storage to survive code splitting
const getConfigStorage = (): GlobalConfig => {
  if (!window.__SHOPROCKET_CONFIG__) {
    window.__SHOPROCKET_CONFIG__ = getDefaultConfig();
  }
  return window.__SHOPROCKET_CONFIG__;
};

/**
 * Initialize config based on script source
 */
export const initializeConfig = (scriptUrl: string): void => {
  let apiUrl = 'https://api.shoprocket.io/api/v3';
  let cdnUrl = 'https://cdn.shoprocket.io';

  if (scriptUrl) {
    const scriptHost = new URL(scriptUrl).hostname;

    if (scriptHost === 'dev-cdn.shoprocket.io') {
      apiUrl = 'https://dev.shoprocket.io/api/v3';
      cdnUrl = 'https://dev-cdn.shoprocket.io';
    } else if (scriptHost.includes('localhost') || scriptHost.includes('.test') || scriptHost.includes('.local')) {
      apiUrl = 'https://shoprocketv3.test/api/v3';
      cdnUrl = 'https://shoprocketv3.test';
    }
  }

  window.__SHOPROCKET_CONFIG__ = { apiUrl, cdnUrl };
};

export const getConfig = (): GlobalConfig => getConfigStorage();

export const setConfig = (newConfig: Partial<GlobalConfig>): void => {
  const current = getConfigStorage();
  window.__SHOPROCKET_CONFIG__ = { ...current, ...newConfig };
};