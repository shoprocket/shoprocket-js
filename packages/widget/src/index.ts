/**
 * Shoprocket Widget
 * 
 * Copyright (c) 2025 Shoprocket Ltd.
 * 
 * This source code is proprietary and confidential.
 * Unauthorized copying or distribution is strictly prohibited.
 * 
 * @license Proprietary
 */

import './styles.css';


// Import the widget manager and components
import { WidgetManager } from './core/widget-manager';
import { ShoprocketElement } from './core/base-component';
import { ProductGrid } from './components/product-grid';
import { CartWidget } from './components/cart';

// ProductGrid and CartWidget are now imported from their respective files

// Inject stylesheet link
function injectStyles(): void {
  const linkId = 'shoprocket-widget-styles';
  if (!document.getElementById(linkId)) {
    const link = document.createElement('link');
    link.id = linkId;
    link.rel = 'stylesheet';
    
    // Get base URL from captured script URL
    if (scriptUrl) {
      const url = new URL(scriptUrl);
      link.href = url.origin + url.pathname.replace('shoprocket.js', 'widget.css');
    } else {
      // Fallback to relative path
      link.href = 'widget.css';
    }
    
    document.head.appendChild(link);
  }
}

// Capture script info immediately while currentScript is available
const scriptUrl = (document.currentScript as HTMLScriptElement)?.src || '';

// Create global instance
const shoprocket = new WidgetManager();

// Expose to window
declare global {
  interface Window {
    Shoprocket: WidgetManager;
    ShoprocketSDK: {
      cart: {
        open: () => void;
        close: () => void;
        toggle: () => void;
      };
    };
  }
}
window.Shoprocket = shoprocket;

// Create SDK object using events for clean component communication
window.ShoprocketSDK = {
  cart: {
    open: () => window.dispatchEvent(new CustomEvent('open-cart', { bubbles: true })),
    close: () => window.dispatchEvent(new CustomEvent('close-cart', { bubbles: true })),
    toggle: () => window.dispatchEvent(new CustomEvent('toggle-cart', { bubbles: true }))
  }
};

/**
 * Get public key from script URL
 */
function getPublicKey(): string | null {
  if (!scriptUrl) return null;
  
  const url = new URL(scriptUrl);
  return url.searchParams.get('pk');
}

/**
 * Auto-detect API URL based on script source
 */
function getApiUrl(): string {
  let apiUrl = 'https://api.shoprocket.io/api/v3'; // Default production
  
  if (scriptUrl) {
    const scriptHost = new URL(scriptUrl).hostname;
    
    // Detect environment based on script host
    if (scriptHost.includes('staging') || scriptHost.includes('stage')) {
      apiUrl = 'https://api-staging.shoprocket.io/api/v3';
    } else if (scriptHost.includes('localhost') || scriptHost.includes('.test') || scriptHost.includes('.local')) {
      apiUrl = 'https://shoprocketv3.test/api/v3';
    }
  }
  
  return apiUrl;
}

/**
 * Initialize when DOM is ready
 */
function autoInit(): void {
  // Inject styles first
  injectStyles();
  
  const publicKey = getPublicKey();
  
  if (!publicKey) {
    // No public key found - widget won't initialize
    return;
  }
  
  const apiUrl = getApiUrl();
  
  shoprocket.init(publicKey, { apiUrl }).catch(console.error);
}

// Register components globally for the widget manager
declare global {
  interface Window {
    __shoprocketComponents: Record<string, typeof ProductGrid | typeof CartWidget>;
  }
}
window.__shoprocketComponents = {
  'product-grid': ProductGrid,
  'products': ProductGrid,
  'cart': CartWidget
};

// Auto-initialize on DOMContentLoaded or immediately if already loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', autoInit);
} else {
  autoInit();
}

// Export for module usage
export { WidgetManager, ShoprocketElement, ProductGrid, CartWidget };