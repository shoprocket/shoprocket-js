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

export const getConfig = (): WidgetConfig => config;

export const setConfig = (newConfig: Partial<WidgetConfig>): void => {
  config = { ...config, ...newConfig };
};