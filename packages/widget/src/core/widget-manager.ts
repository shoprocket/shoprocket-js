import { ShoprocketCore } from '@shoprocket/core';
import type { BaseComponent } from './base-component';
import type { LitElement } from 'lit';
import { CookieManager } from '../utils/cookie-manager';
import { AnalyticsManager } from './analytics-manager';
import { internalState } from './internal-state';

export interface WidgetConfig {
  publicKey?: string;
  apiUrl?: string;
  locale?: string;
  currency?: string;
  stockDisplay?: 'off' | 'low-only' | 'always';
  lowStockThreshold?: number;
}

export interface MountOptions {
  storeId: string;
  [key: string]: any;
}

/**
 * Global widget manager - handles SDK initialization and component mounting
 */
export class WidgetManager {
  private sdk: ShoprocketCore | null = null;
  private initialized = false;
  private mountedWidgets = new Map<Element, LitElement>();

  // Public API namespaces
  public cart = {
    /**
     * Opens the shopping cart
     * @example Shoprocket.cart.open()
     */
    open: () => window.dispatchEvent(new CustomEvent('open-cart', { bubbles: true })),
    
    /**
     * Closes the shopping cart
     * @example Shoprocket.cart.close()
     */
    close: () => window.dispatchEvent(new CustomEvent('close-cart', { bubbles: true })),
    
    /**
     * Toggles the shopping cart visibility
     * @example Shoprocket.cart.toggle()
     */
    toggle: () => window.dispatchEvent(new CustomEvent('toggle-cart', { bubbles: true })),
    
    /**
     * Get the current cart data
     * @example Shoprocket.cart.get()
     */
    get: () => internalState.getCartData(),
    
    /**
     * Get the current cart data (property access)
     * @example Shoprocket.cart.data
     */
    get data() {
      return internalState.getCartData();
    }
  };

  /**
   * Store namespace
   */
  public store = {
    /**
     * Get the current store data
     * @example Shoprocket.store.get()
     */
    get: () => internalState.getStore(),
    
    /**
     * Get the current store data (property access)
     * @example Shoprocket.store.data
     */
    get data() {
      return internalState.getStore();
    }
  };


  /**
   * Authentication namespace
   */
  public auth = {
    /**
     * Login with email and password
     * @example Shoprocket.auth.login('user@example.com', 'password')
     */
    login: async (email: string, password: string) => {
      const manager = window.Shoprocket as WidgetManager;
      const sdk = manager.getSdk();
      const response = await sdk.auth.login({ email, password });
      const token = response.access_token;
      if (token) {
        CookieManager.setAccessToken(token);
        sdk.setAuthToken(token);
        // Server automatically links cart to user via headers
      }
      return response;
    },
    
    /**
     * Register a new user
     * @example Shoprocket.auth.register('user@example.com', 'password', 'John Doe')
     */
    register: async (email: string, password: string, name?: string) => {
      const manager = window.Shoprocket as WidgetManager;
      const sdk = manager.getSdk();
      const response = await sdk.auth.register({ email, password, name });
      const token = response.access_token;
      if (token) {
        CookieManager.setAccessToken(token);
        sdk.setAuthToken(token);
        // Server automatically links cart to user via headers
      }
      return response;
    },
    
    /**
     * Logout the current user
     * @example Shoprocket.auth.logout()
     */
    logout: async () => {
      const manager = window.Shoprocket as WidgetManager;
      const sdk = manager.getSdk();
      
      try {
        // Call server logout to cleanup session
        await sdk.auth.logout();
      } catch (error) {
        // Ignore server errors, continue with client cleanup
      }
      
      // Clear client-side auth
      CookieManager.clearAccessToken();
      sdk.clearAuthToken();
      
      // Regenerate cart token for privacy
      CookieManager.regenerateCartToken();
    },
    
    /**
     * Check if user is logged in
     * @example Shoprocket.auth.isLoggedIn()
     */
    isLoggedIn: () => {
      return !!CookieManager.getAccessToken();
    },
    
    /**
     * Get current auth token
     * @example Shoprocket.auth.getToken()
     */
    getToken: () => {
      return CookieManager.getAccessToken();
    }
  };

  /**
   * Initialize the widget with a public key
   */
  async init(publicKey: string, options: WidgetConfig = {}): Promise<void> {
    if (this.initialized) {
      console.warn('Shoprocket: Already initialized');
      return;
    }
    
    // Set flag immediately to prevent concurrent initialization
    this.initialized = true;

    try {
      // Initialize SDK
      this.sdk = new ShoprocketCore({
        publicKey,
        apiUrl: options.apiUrl
      });
      
      // Set cart token for all API requests
      this.sdk.setCartToken(CookieManager.getCartToken());

      // Initialize cart token (no server call needed)
      const cartToken = CookieManager.getCartToken();
      internalState.setCartToken(cartToken);

      // Initialize analytics with store tracking config
      // Store config will be fetched and applied when available
      let storeId: string | undefined;
      try {
        const store = await this.sdk.store.get() as any;
        storeId = store?.id; // Get the numeric store ID
        
        // Store in internal state
        internalState.setStore(store);
        internalState.setSdk(this.sdk);
        
        // Set up auth token if present
        const accessToken = CookieManager.getAccessToken();
        if (accessToken) {
          this.sdk.setAuthToken(accessToken);
        }
        
        if (store?.tracking) {
          await AnalyticsManager.init(store.tracking);
        }
      } catch (error) {
        // Store fetch failed, continue without third-party tracking
        console.warn('Failed to fetch store tracking config:', error);
      }
      
      // Track widget loaded with actual store ID
      AnalyticsManager.track('widget_loaded', { store_id: storeId || publicKey });

      // Already marked as initialized at the start of init()

      // Auto-mount any widgets already in DOM
      this.autoMount();

      // Auto-render floating cart button unless disabled
      this.autoRenderCart();
      
      // Listen for order completion to regenerate cart token
      this.setupOrderCompletionListener();
    } catch (error) {
      // Initialization failed - reset the flag so it can be retried
      this.initialized = false;
      throw error;
    }
  }


  /**
   * Get SDK instance
   */
  getSdk(): ShoprocketCore {
    if (!this.sdk) {
      throw new Error('Shoprocket: Not initialized. Call init() first.');
    }
    return this.sdk;
  }

  /**
   * Set up listener for order completion events
   */
  private setupOrderCompletionListener(): void {
    // Listen for checkout success event
    window.addEventListener('shoprocket:checkout:success', (event) => {
      // Regenerate cart token after successful order
      const newToken = CookieManager.regenerateCartToken();
      internalState.setCartToken(newToken);
      
      // Update SDK with new cart token
      if (this.sdk) {
        this.sdk.setCartToken(newToken);
      }
      
      // Track order completion
      AnalyticsManager.track('order_completed', (event as CustomEvent).detail);
    });
    
    // Also listen for explicit order confirmation
    window.addEventListener('shoprocket:order:confirmed', () => {
      // Regenerate cart token after order confirmation
      const newToken = CookieManager.regenerateCartToken();
      internalState.setCartToken(newToken);
      
      // Update SDK with new cart token
      if (this.sdk) {
        this.sdk.setCartToken(newToken);
      }
    });
  }


  /**
   * Auto-render floating cart button
   */
  private autoRenderCart(): void {
    // Check if cart is already mounted manually
    const existingCart = document.querySelector('shoprocket-cart');
    if (existingCart) {
      // Cart already exists, don't auto-render
      return;
    }

    // Check for opt-out via data attribute on script tag
    const scriptTag = document.querySelector('script[src*="shoprocket"][data-no-cart]');
    if (scriptTag) {
      // User explicitly disabled auto-cart
      return;
    }

    // Create floating cart button
    const floatingCart = document.createElement('div');
    floatingCart.setAttribute('data-shoprocket', 'cart');
    floatingCart.setAttribute('data-floating', 'true');
    document.body.appendChild(floatingCart);

    // Mount the cart widget
    this.mount(floatingCart, 'cart', { floating: 'true' });
  }

  /**
   * Auto-mount widgets based on data attributes
   */
  private autoMount(): void {
    // Find all elements with data-shoprocket attribute
    const elements = document.querySelectorAll('[data-shoprocket]');
    
    elements.forEach(element => {
      const widgetType = element.getAttribute('data-shoprocket');
      if (!widgetType) return;

      // Extract all data-* attributes
      const options: Record<string, string> = {};
      Array.from(element.attributes).forEach(attr => {
        if (attr.name.startsWith('data-') && attr.name !== 'data-shoprocket') {
          const key = attr.name.replace('data-', '').replace(/-([a-z])/g, g => g[1]?.toUpperCase() || '');
          options[key] = attr.value;
        }
      });

      // Mount appropriate component
      this.mount(element, widgetType, options);
    });
  }

  /**
   * Mount a widget on an element
   */
  mount(element: Element, widgetType: string, options: Record<string, any> = {}): void {
    if (!this.initialized || !this.sdk) {
      throw new Error('Shoprocket: Not initialized. Call init() first.');
    }

    // Import the main component classes dynamically
    // For now, we'll need to register them globally
    const componentMap = (window as any).__shoprocketComponents || {};
    const ComponentClass = componentMap[widgetType];

    if (!ComponentClass) {
      console.error(`Shoprocket: Unknown widget type: ${widgetType}`);
      return;
    }

    // Create component instance using document.createElement
    const tagName = `shoprocket-${widgetType}`;
    const component = document.createElement(tagName) as BaseComponent;
    
    // Set properties
    // Map 'style' to 'widgetStyle' to avoid conflict with HTMLElement.style
    const mappedOptions: Record<string, any> = { ...options };
    if ('style' in mappedOptions) {
      mappedOptions['widgetStyle'] = mappedOptions['style'];
      delete mappedOptions['style'];
    }
    // For web components, we need to set attributes, not properties
    // Convert camelCase back to kebab-case for attributes
    Object.entries(mappedOptions).forEach(([key, value]) => {
      // Convert camelCase to kebab-case
      const attrName = key.replace(/[A-Z]/g, m => '-' + m.toLowerCase());
      component.setAttribute(attrName, value);
    });
    
    // Set SDK as a property
    if ('sdk' in component && component instanceof HTMLElement) {
      (component as BaseComponent).sdk = this.sdk;
    }

    // Replace the mount point with our component to avoid unnecessary wrapper
    // Copy over any custom CSS variables or styles from the mount point
    if (element instanceof HTMLElement && component instanceof HTMLElement) {
      // Copy inline styles (including CSS variables)
      component.setAttribute('style', element.getAttribute('style') || '');
      // Copy classes if any
      if (element.className) {
        component.className = element.className;
      }
    }
    
    // Replace the element with our component
    element.replaceWith(component);
    this.mountedWidgets.set(component, component);
  }
}