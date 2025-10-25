import { ShoprocketCore } from '@shoprocket/core';
import type { BaseComponent } from './base-component';
import type { LitElement } from 'lit';
import { CookieManager } from '../utils/cookie-manager';
import { AnalyticsManager, EVENTS } from './analytics-manager';
import { internalState } from './internal-state';
import { cartState } from './cart-state';
import { SPATracker } from '../utils/spa-tracker';

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
    get: () => cartState.getCart(),
    
    /**
     * Get the current cart data (property access)
     * @example Shoprocket.cart.data
     */
    get data() {
      return cartState.getCart();
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
      
      // Initialize cart state manager with SDK
      cartState.init(this.sdk);

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
        
        // Check for test mode and create banner if needed
        if (store?.store_mode === 'test') {
          this.createTestModeBanner();
        }
        
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
      
      // Track initial page view
      AnalyticsManager.track(EVENTS.PAGE_VIEW, { store_id: storeId || publicKey });

      // Setup SPA tracking to detect client-side navigation
      SPATracker.setup(() => {
        // Fire page_view event on SPA navigation
        AnalyticsManager.track(EVENTS.PAGE_VIEW, { store_id: storeId || publicKey });
      });

      // Already marked as initialized at the start of init()

      // Auto-mount any widgets already in DOM
      await this.autoMount();

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
    // Check if cart is already mounted manually (either as custom element or data attribute)
    const existingCart = document.querySelector('shoprocket-cart, [data-shoprocket="cart"]');
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
   * Create test mode banner if store is in test mode
   */
  private createTestModeBanner(): void {
    // Check if banner already exists
    if (document.querySelector('shoprocket-test-banner')) return;
    
    // Create the banner component
    const banner = document.createElement('shoprocket-test-banner');
    (banner as any).sdk = this.sdk;
    document.body.appendChild(banner);
    
    // Don't add body padding since it's a centered tab
    // The tab doesn't push content down
    
    // Listen for minimize/maximize events if needed
    banner.addEventListener('toggle-minimize', () => {
      // No padding adjustment needed for tab style
    });
  }
  
  /**
   * Reload all widgets - unmounts existing widgets and remounts them with current attributes
   * Useful when data-* attributes have changed dynamically
   * @example Shoprocket.reload()
   */
  public reload(): void {
    if (!this.initialized || !this.sdk) {
      console.warn('Shoprocket: Not initialized. Call init() first.');
      return;
    }

    // Find all mounted widget components
    const widgets = document.querySelectorAll('shoprocket-catalog, shoprocket-cart, shoprocket-product-view, shoprocket-buy-button');

    // Replace each widget with its original data-shoprocket mount point
    widgets.forEach(widget => {
      // Get widget type from tag name
      const tagName = widget.tagName.toLowerCase();
      const widgetType = tagName.replace('shoprocket-', '');

      // Create replacement mount point
      const mountPoint = document.createElement('div');
      mountPoint.setAttribute('data-shoprocket', widgetType);

      // Copy all data-* attributes from the widget
      Array.from(widget.attributes).forEach(attr => {
        if (attr.name.startsWith('data-')) {
          mountPoint.setAttribute(attr.name, attr.value);
        }
      });

      // Copy inline styles (CSS variables)
      if (widget instanceof HTMLElement && widget.getAttribute('style')) {
        mountPoint.setAttribute('style', widget.getAttribute('style')!);
      }

      // Copy classes
      if (widget.className) {
        mountPoint.className = widget.className;
      }

      // Replace widget with mount point
      widget.replaceWith(mountPoint);
    });

    // Clear mounted widgets tracking
    this.mountedWidgets.clear();

    // Remount all widgets
    this.autoMount();
  }

  /**
   * Auto-mount widgets based on data attributes
   */
  private async autoMount(): Promise<void> {
    // Find all elements with data-shoprocket attribute
    const elements = document.querySelectorAll('[data-shoprocket]');

    const mountPromises: Promise<void>[] = [];

    elements.forEach(element => {
      const widgetType = element.getAttribute('data-shoprocket');
      if (!widgetType) return;

      // Check if this is an embed (has data-embed-id)
      const embedId = element.getAttribute('data-embed-id');

      if (embedId) {
        // Dashboard-managed embed with explicit type
        mountPromises.push(this.mountEmbed(element, widgetType, embedId));
      } else {
        // Inline widget with data attributes
        // Extract all data-* attributes
        const options: Record<string, string> = {};
        Array.from(element.attributes).forEach(attr => {
          if (attr.name.startsWith('data-') && attr.name !== 'data-shoprocket') {
            const key = attr.name.replace('data-', '').replace(/-([a-z])/g, g => g[1]?.toUpperCase() || '');
            options[key] = attr.value;
          }
        });

        // Mount appropriate component
        mountPromises.push(this.mount(element, widgetType, options));
      }
    });

    // Wait for all mounts to complete
    await Promise.all(mountPromises);
  }

  /**
   * Mount a widget on an element
   */
  async mount(element: Element, widgetType: string, options: Record<string, any> = {}): Promise<void> {
    if (!this.initialized || !this.sdk) {
      throw new Error('Shoprocket: Not initialized. Call init() first.');
    }

    // Get component class (may be async from lazy loading)
    const componentMap = (window as any).__shoprocketComponents || {};
    let ComponentClass = componentMap[widgetType];

    // Handle lazy-loaded components (Proxy returns Promise)
    if (ComponentClass instanceof Promise) {
      ComponentClass = await ComponentClass;
    }

    if (!ComponentClass) {
      console.error(`Shoprocket: Unknown widget type: ${widgetType}`);
      return;
    }

    // Register custom element if not already registered
    const tagName = `shoprocket-${widgetType}`;
    if (!customElements.get(tagName)) {
      customElements.define(tagName, ComponentClass);
    }

    // Create component instance using document.createElement
    const component = document.createElement(tagName) as BaseComponent;

    // Set properties
    // Map 'style' to 'widgetStyle' to avoid conflict with HTMLElement.style
    const mappedOptions: Record<string, any> = { ...options };
    if ('style' in mappedOptions) {
      mappedOptions['widgetStyle'] = mappedOptions['style'];
      delete mappedOptions['style'];
    }
    // Extract theme and mode before setting properties (they're used as attributes, not properties)
    const theme = mappedOptions['theme'];
    delete mappedOptions['theme'];

    const configuredMode = mappedOptions['mode'] || 'auto';
    delete mappedOptions['mode'];

    // Set properties directly on the component (not as data-* attributes)
    // Web components expect properties, not data-* attributes
    // Convert kebab-case keys to camelCase for proper Lit property mapping
    Object.entries(mappedOptions).forEach(([key, value]) => {
      // Convert kebab-case to camelCase (e.g., "filter-position" -> "filterPosition")
      const camelKey = key.replace(/-([a-z])/g, g => g[1]?.toUpperCase() || '');
      // Set as property directly (Lit components respond to property changes)
      (component as any)[camelKey] = value;
    });

    // Set SDK as a property
    if ('sdk' in component && component instanceof HTMLElement) {
      (component as BaseComponent).sdk = this.sdk;
    }

    // Replace the mount point with our component to avoid unnecessary wrapper
    // Copy over any custom CSS variables or styles from the mount point
    if (element instanceof HTMLElement && component instanceof HTMLElement) {
      // Copy inline styles only if they exist
      const inlineStyles = element.getAttribute('style');
      if (inlineStyles) {
        component.setAttribute('style', inlineStyles);
      }
      // Add shoprocket class for consistent theme targeting
      const existingClasses = element.className ? element.className + ' shoprocket' : 'shoprocket';
      component.className = existingClasses;

      // Set theme attribute if provided (for per-embed theming)
      if (theme) {
        component.setAttribute('data-theme', theme);
      }

      // Determine and set mode attribute
      const actualMode = this.detectMode(configuredMode);
      component.setAttribute('data-mode', actualMode);

      // Listen for system preference changes if using auto mode
      if (configuredMode === 'auto') {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const updateMode = (e: MediaQueryListEvent | MediaQueryList) => {
          const newMode = e.matches ? 'dark' : 'light';
          component.setAttribute('data-mode', newMode);
        };
        // Modern browsers
        mediaQuery.addEventListener('change', updateMode);
      }
    }

    // Replace the element with our component
    element.replaceWith(component);

    // Special handling for cart: always move to body (breaks out of container)
    if (widgetType === 'cart' && component.parentElement !== document.body) {
      document.body.appendChild(component);
    }

    this.mountedWidgets.set(component, component);
  }

  /**
   * Detect the actual mode to use based on configuration
   * @param configuredMode - The mode from configuration ('light', 'dark', or 'auto')
   * @returns The actual mode to apply ('light' or 'dark')
   */
  private detectMode(configuredMode: string): 'light' | 'dark' {
    if (configuredMode === 'dark') {
      return 'dark';
    }
    if (configuredMode === 'light') {
      return 'light';
    }
    // Auto mode: detect from system preference
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    return prefersDark ? 'dark' : 'light';
  }

  /**
   * Inject theme CSS into the document head
   * @param cssUrl - URL to fetch the CSS from
   * @param themeName - Theme name/identifier for style tag ID
   */
  private async injectThemeCSS(cssUrl: string, themeName: string): Promise<void> {
    try {
      // Create a unique ID for this theme style tag
      const styleId = `shoprocket-theme-${themeName}`;

      // Skip if theme already injected (allows multiple embeds to share same theme)
      const existingStyle = document.getElementById(styleId);
      if (existingStyle) {
        return;
      }

      // Fetch the CSS
      const response = await fetch(cssUrl);
      if (!response.ok) {
        console.warn(`Shoprocket: Failed to fetch theme CSS from ${cssUrl}:`, response.statusText);
        return;
      }

      const css = await response.text();

      // Create and inject style tag
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = css;
      document.head.appendChild(style);
    } catch (error) {
      console.error(`Shoprocket: Error loading theme CSS for theme "${themeName}":`, error);
    }
  }

  /**
   * Mount a widget from an embed ID (fetches config from API)
   * Supports preview mode via window.SHOPROCKET_PREVIEW_CONFIG
   *
   * @param element - The DOM element to mount the widget into
   * @param widgetType - The widget type from data-shoprocket attribute
   * @param embedId - The embed ID from data-embed-id attribute
   */
  async mountEmbed(element: Element, widgetType: string, embedId: string): Promise<void> {
    if (!this.initialized || !this.sdk) {
      throw new Error('Shoprocket: Not initialized. Call init() first.');
    }

    try {
      // Check for preview override first (for dashboard live editing)
      const previewConfig = (window as any).SHOPROCKET_PREVIEW_CONFIG?.[embedId];

      let embedConfig;
      if (previewConfig) {
        // Use preview config (no API call)
        embedConfig = previewConfig;
      } else {
        // Normal flow: Fetch embed configuration from API
        embedConfig = await this.sdk.embeds.getConfig(embedId);
      }

      // Validate that API widget type matches the attribute
      if (embedConfig.widgetType && embedConfig.widgetType !== widgetType) {
        console.error(
          `Shoprocket: Widget type mismatch for embed ${embedId}. ` +
          `Expected "${widgetType}" from data-shoprocket attribute, ` +
          `but API returned "${embedConfig.widgetType}".`
        );
        // Use the type from attribute (trust the HTML)
      }

      const options = embedConfig.configuration || {};

      // Add theme to options if provided
      if (embedConfig.theme) {
        options.theme = embedConfig.theme;
      }

      // Apply theme CSS if themeCssUrl and theme name are provided
      if (embedConfig.themeCssUrl && embedConfig.theme) {
        await this.injectThemeCSS(embedConfig.themeCssUrl, embedConfig.theme);
      }

      // Mount the widget with the type from attribute and config from API
      await this.mount(element, widgetType, options);
    } catch (error) {
      console.error(`Shoprocket: Failed to load embed ${embedId}:`, error);

      // Show error state in the embed element
      if (element instanceof HTMLElement) {
        element.innerHTML = `
          <div style="padding: 20px; text-align: center; color: #666;">
            <p>Unable to load widget</p>
            <p style="font-size: 12px; color: #999;">Embed ID: ${embedId}</p>
          </div>
        `;
      }
    }
  }
}