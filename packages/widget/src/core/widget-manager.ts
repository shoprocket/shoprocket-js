import { ShoprocketCore } from '@shoprocket/core';
import type { Session, ApiResponse } from '../types/api';
import type { BaseComponent } from './base-component';
import type { LitElement } from 'lit';
import { getCookie, setCookie } from '../utils/cookie-utils';
import { Analytics, EVENTS } from './analytics';

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
  public analytics: Analytics | null = null;

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
    toggle: () => window.dispatchEvent(new CustomEvent('toggle-cart', { bubbles: true }))
  };

  /**
   * Initialize the widget with a public key
   */
  async init(publicKey: string, options: WidgetConfig = {}): Promise<void> {
    if (this.initialized) {
      // Already initialized
      return;
    }

    try {
      // Initialize SDK
      this.sdk = new ShoprocketCore({
        publicKey,
        apiUrl: options.apiUrl,
      });

      // Initialize session asynchronously (non-blocking)
      this.initializeSessionAsync(publicKey);

      // Initialize analytics
      this.analytics = new Analytics(this.sdk);
      
      // Expose analytics and event constants globally
      (window as any).Shoprocket = (window as any).Shoprocket || {};
      (window as any).Shoprocket.analytics = this.analytics;
      (window as any).Shoprocket.EVENTS = EVENTS;

      // Mark as initialized immediately so components can start loading
      this.initialized = true;

      // Auto-mount any widgets already in DOM
      this.autoMount();

      // Auto-render floating cart button unless disabled
      this.autoRenderCart();
    } catch (error) {
      // Initialization failed
      throw error;
    }
  }

  /**
   * Initialize session in the background (non-blocking)
   */
  private async initializeSessionAsync(publicKey: string): Promise<void> {
    try {
      const sessionKey = `shoprocket_session_${publicKey}`;
      const storedToken = getCookie(sessionKey);
      
      if (storedToken) {
        this.sdk!.setSessionToken(storedToken);
        // For existing sessions, we don't have the session ID readily available
        // Analytics will still work but without session_id in context
        // Wait for store data before initializing analytics
        this.sdk!.store.get().then(storeData => {
          (window as any).ShoprocketWidget = (window as any).ShoprocketWidget || {};
          (window as any).ShoprocketWidget.store = storeData;
          if (this.analytics) {
            this.analytics.init();
          }
        });
      } else {
        // Create new session
        const session = await this.sdk!.session.create() as unknown as Session | ApiResponse<Session>;
        const sessionToken = 'data' in session ? session.data.session_token : session.session_token;
        if (sessionToken) {
          this.sdk!.setSessionToken(sessionToken);
          setCookie(sessionKey, sessionToken);
          
          // Get store data then initialize analytics
          const storeData = await this.sdk!.store.get();
          (window as any).ShoprocketWidget = (window as any).ShoprocketWidget || {};
          (window as any).ShoprocketWidget.store = storeData;
          
          if (this.analytics) {
            this.analytics.init();
          }
        }
      }

      // Store SDK reference globally
      (window as any).ShoprocketWidget = (window as any).ShoprocketWidget || {};
      (window as any).ShoprocketWidget.sdk = this.sdk;
    } catch (error) {
      // Session initialization failed - log but don't throw
      console.warn('Failed to initialize session:', error);
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