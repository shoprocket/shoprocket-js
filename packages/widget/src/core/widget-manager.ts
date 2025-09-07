import { ShoprocketCore } from '@shoprocket/core';
import type { Session, ApiResponse } from '../types/api';
import type { BaseComponent } from './base-component';
import type { LitElement } from 'lit';

export interface WidgetConfig {
  publicKey?: string;
  apiUrl?: string;
  locale?: string;
  currency?: string;
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

      // Check for existing session in localStorage (store-specific)
      const sessionKey = `shoprocket_session_${publicKey}`;
      const storedToken = localStorage.getItem(sessionKey);
      if (storedToken) {
        this.sdk.setSessionToken(storedToken);
      } else {
        // Create new session
        const session = await this.sdk.session.create() as Session | ApiResponse<Session>;
        const sessionToken = 'data' in session ? session.data.session_token : session.session_token;
        if (sessionToken) {
          this.sdk.setSessionToken(sessionToken);
          localStorage.setItem(sessionKey, sessionToken);
        }
      }

      // Get store info
      await this.sdk.store.get();

      this.initialized = true;

      // Auto-mount any widgets already in DOM
      this.autoMount();
    } catch (error) {
      // Initialization failed
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

    // Create component instance
    const component = new ComponentClass();
    
    // Set properties
    // Map 'style' to 'widgetStyle' to avoid conflict with HTMLElement.style
    const mappedOptions: Record<string, any> = { ...options };
    if ('style' in mappedOptions) {
      mappedOptions['widgetStyle'] = mappedOptions['style'];
      delete mappedOptions['style'];
    }
    Object.assign(component, mappedOptions);
    if ('sdk' in component && component instanceof HTMLElement) {
      (component as BaseComponent).sdk = this.sdk;
    }

    // Mount to element
    element.appendChild(component);
    this.mountedWidgets.set(element, component);
  }
}