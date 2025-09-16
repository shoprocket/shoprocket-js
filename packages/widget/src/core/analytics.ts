import type { ShoprocketCore } from '@shoprocket/core';

interface EventData {
  event: string;
  timestamp?: number;
  store_id?: string;
  context?: Record<string, any>;
  properties?: Record<string, any>;
  ecommerce?: Record<string, any>;
}

// GA4 standard event names
export const EVENTS = {
  // Discovery & Browsing
  VIEW_ITEM_LIST: 'view_item_list',
  VIEW_ITEM: 'view_item',
  SELECT_ITEM: 'select_item',
  VIEW_CART: 'view_cart',
  
  // Shopping behavior
  ADD_TO_CART: 'add_to_cart',
  REMOVE_FROM_CART: 'remove_from_cart',
  
  // Custom events
  CART_OPENED: 'cart_opened',
  CART_CLOSED: 'cart_closed',
  PAGE_VIEW: 'page_view',
  TIME_ON_PAGE: 'time_on_page',
  AFFILIATE_LINK_CLICKED: 'affiliate_link_clicked'
} as const;

type EventName = typeof EVENTS[keyof typeof EVENTS];

import { getCookie, setCookie } from '../utils/cookie-utils';

export interface AnalyticsConfig {
  enabled?: boolean;
  broadcast?: boolean;
}

export class Analytics {
  private sdk: ShoprocketCore;
  private config: AnalyticsConfig;
  private pageLoadTime: number;

  constructor(sdk: ShoprocketCore, config: AnalyticsConfig = {}) {
    this.sdk = sdk;
    this.config = {
      enabled: true,
      broadcast: true,
      ...config
    };
    this.pageLoadTime = Date.now();
  }

  /**
   * Smart entity-based tracking - dramatically reduces code needed for tracking
   */
  trackEntity(eventName: EventName, entity?: any, extra?: any): void {
    if (!this.config.enabled) return;

    // Handle simple events without entities
    if (!entity) {
      this.track(eventName);
      return;
    }

    // Detect entity type and build appropriate payload
    const payload = this.buildEventPayload(eventName, entity, extra);
    this.track(eventName, payload);
  }

  /**
   * Build event payload based on entity type
   */
  private buildEventPayload(eventName: EventName, entity: any, extra?: any): Record<string, any> {
    const store = (window as any).ShoprocketWidget?.store;
    const currency = store?.currency || 'USD';

    // Handle cart events
    if (entity.totals && entity.items) {
      return {
        cart_value: entity.totals?.subtotal || 0,
        items_count: entity.items?.length || 0
      };
    }

    // Handle product/item events
    if (entity.product_id || entity.id) {
      const items = this.buildItemsArray(entity, extra);
      const value = this.calculateValue(entity, extra);
      
      // For list events, include list metadata
      if (eventName === EVENTS.VIEW_ITEM_LIST || eventName === EVENTS.SELECT_ITEM) {
        return {
          item_list_id: extra?.category || 'all_products',
          item_list_name: extra?.category || 'All Products',
          ...(value && { value }),
          items
        };
      }

      // For item events, include currency and value
      return {
        currency,
        value,
        items
      };
    }

    // Handle page events
    if (eventName === EVENTS.PAGE_VIEW) {
      return {
        page_location: window.location.href,
        page_title: document.title,
        page_path: window.location.pathname,
        page_search: window.location.search,
        page_hash: window.location.hash
      };
    }

    // Handle time on page
    if (eventName === EVENTS.TIME_ON_PAGE) {
      return {
        duration_seconds: Math.round((Date.now() - this.pageLoadTime) / 1000),
        page_url: window.location.href
      };
    }

    // Default to passing through extra data
    return extra || {};
  }

  /**
   * Build items array from various entity types
   */
  private buildItemsArray(entity: any, extra?: any): any[] {
    // If entity is already an array (product list)
    if (Array.isArray(entity)) {
      return entity.slice(0, 10).map((item, index) => this.mapToItem(item, index));
    }

    // Single item
    return [this.mapToItem(entity, 0, extra)];
  }

  /**
   * Map entity to GA4 item structure
   */
  private mapToItem(entity: any, index: number = 0, extra?: any): any {
    const price = this.extractPrice(entity.price);
    
    return {
      item_id: entity.product_id || entity.id,
      item_name: entity.product_name || entity.name,
      price,
      quantity: extra?.quantity || entity.quantity || 1,
      ...(entity.variant_id && { item_variant: entity.variant_id }),
      ...(entity.category && { item_category: entity.category }),
      ...(entity.brand && { item_brand: entity.brand }),
      ...(index > 0 && { index })
    };
  }

  /**
   * Extract numeric price from various formats
   */
  private extractPrice(price: any): number {
    if (typeof price === 'number') return price;
    if (typeof price === 'object' && price.amount) return price.amount;
    return 0;
  }

  /**
   * Calculate total value for event
   */
  private calculateValue(entity: any, extra?: any): number {
    const price = this.extractPrice(entity.price);
    const quantity = extra?.quantity || entity.quantity || 1;
    return price * quantity;
  }

  /**
   * Initialize analytics
   */
  init(): void {
    if (!this.config.enabled) return;

    // Capture affiliate from URL
    this.captureAffiliate();

    // Track initial page view
    this.trackPageView();

    // Set up page unload tracking
    this.setupUnloadTracking();
  }

  /**
   * Track an event
   */
  track(eventName: string, properties: Record<string, any> = {}): void {
    if (!this.config.enabled) return;

    // Get store ID from window.ShoprocketWidget.store
    const storeId = (window as any).ShoprocketWidget?.store?.id;

    // Separate ecommerce data from other properties
    const { currency, value, items, ...otherProperties } = properties;
    
    const eventData: EventData = {
      event: eventName,
      timestamp: Date.now(),
      store_id: storeId,
      context: this.getContext(),
      properties: otherProperties,
      // Add ecommerce data if present
      ...(currency || value || items ? {
        ecommerce: {
          currency,
          value,
          items
        }
      } : {})
    };

    // Send immediately via beacon
    const publishableKey = (this.sdk as any).getPublishableKey?.() || 
                          (this.sdk as any).getConfig?.()?.publicKey;
    const url = `${(this.sdk as any).getApiUrl?.() || (this.sdk as any).config?.apiUrl}/public/${publishableKey}/events`;
    navigator.sendBeacon(url, JSON.stringify(eventData));

    // Broadcast to third-party trackers
    if (this.config.broadcast) {
      this.broadcast(eventName, eventData);
    }
  }

  /**
   * Track page view
   */
  trackPageView(): void {
    this.track('page_view', {
      page_location: window.location.href,
      page_title: document.title,
      page_path: window.location.pathname,
      page_search: window.location.search,
      page_hash: window.location.hash
    });
  }

  /**
   * Track e-commerce events with GA4 standard structure
   */
  trackEcommerce(eventName: string, data: {
    currency?: string;
    value?: number;
    items?: any[];
    [key: string]: any;
  }): void {
    // Don't nest ecommerce data in properties
    this.track(eventName, data);
  }

  /**
   * Get current context for all events
   */
  private getContext(): EventData['context'] {
    // Get session ID from cookie (it's the same as the token)
    const publishableKey = (this.sdk as any).getPublishableKey?.() || 
                          (this.sdk as any).getConfig?.()?.publicKey;
    const sessionId = getCookie(`shoprocket_session_${publishableKey}`);
    
    return {
      page_url: window.location.href,
      page_title: document.title,
      referrer: document.referrer,
      user_agent: navigator.userAgent,
      screen_resolution: `${screen.width}x${screen.height}`,
      
      // UTM parameters (from initial page load)
      utm_source: this.getUTMParam('utm_source'),
      utm_medium: this.getUTMParam('utm_medium'),
      utm_campaign: this.getUTMParam('utm_campaign'),
      utm_term: this.getUTMParam('utm_term'),
      utm_content: this.getUTMParam('utm_content'),
      
      // Affiliate tracking
      affiliate_id: this.getAffiliate(),
      
      // Session info  
      session_id: sessionId || undefined,
      
      // Widget info
      widget_version: '3.0.0' // TODO: Get from package.json
    };
  }

  /**
   * Capture affiliate ID from URL and store in cookie
   */
  private captureAffiliate(): void {
    const urlParams = new URLSearchParams(window.location.search);
    const affiliateId = urlParams.get('ref') || 
                       urlParams.get('affiliate') || 
                       urlParams.get('aid');
    
    if (affiliateId) {
      // Store for 30 days
      setCookie('shoprocket_affiliate', affiliateId, 30 * 24 * 60 * 60);
      
      // Track affiliate link click
      this.track('affiliate_link_clicked', {
        affiliate_id: affiliateId,
        landing_page: window.location.href
      });
    }
  }

  /**
   * Get affiliate ID from cookie
   */
  private getAffiliate(): string | undefined {
    return getCookie('shoprocket_affiliate') || undefined;
  }

  /**
   * Get UTM parameter from URL or storage
   */
  private getUTMParam(param: string): string | undefined {
    // Check current URL first
    const urlParams = new URLSearchParams(window.location.search);
    const value = urlParams.get(param);
    
    if (value) {
      // Store for session
      sessionStorage.setItem(`shoprocket_${param}`, value);
      return value;
    }
    
    // Fall back to stored value
    return sessionStorage.getItem(`shoprocket_${param}`) || undefined;
  }

  /**
   * Broadcast event to third-party trackers
   */
  private broadcast(eventName: string, eventData: EventData): void {
    const event = new CustomEvent('shoprocket:event', {
      detail: {
        event: eventName,
        timestamp: eventData.timestamp,
        context: eventData.context,
        properties: eventData.properties,
        ecommerce: eventData.ecommerce
      },
      bubbles: true,
      composed: true
    });
    
    window.dispatchEvent(event);
  }


  /**
   * Set up tracking for page unload
   */
  private setupUnloadTracking(): void {
    // Track time on page when leaving
    const trackTimeOnPage = () => {
      const timeOnPage = Math.round((Date.now() - this.pageLoadTime) / 1000);
      
      this.track('time_on_page', {
        duration_seconds: timeOnPage,
        page_url: window.location.href
      });
      
      // No need to do anything - event already sent via beacon
    };
    
    // Listen for page unload
    window.addEventListener('beforeunload', trackTimeOnPage);
    
    // Also track on visibility change (mobile)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        trackTimeOnPage();
      }
    });
  }

  /**
   * Clean up
   */
  destroy(): void {
    // Nothing to clean up anymore!
  }
}