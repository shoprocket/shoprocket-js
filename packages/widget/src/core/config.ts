/**
 * Global configuration for the widget
 */
export interface WidgetConfig {
  apiUrl: string;
  cdnUrl: string;
}

// Default config
let config: WidgetConfig = {
  apiUrl: 'https://api.shoprocket.io/api/v3',
  cdnUrl: 'https://cdn.shoprocket.io'
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
    } else if (import.meta.env.DEV && (scriptHost.includes('localhost') || scriptHost.includes('.test') || scriptHost.includes('.local'))) {
      apiUrl = 'https://shoprocketv3.test/api/v3';
      cdnUrl = 'https://shoprocketv3.test';
    }
  }
  
  config = { apiUrl, cdnUrl };
};

export const getConfig = (): WidgetConfig => config;

export const setConfig = (newConfig: Partial<WidgetConfig>): void => {
  config = { ...config, ...newConfig };
};