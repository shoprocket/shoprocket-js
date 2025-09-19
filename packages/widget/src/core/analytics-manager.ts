/**
 * Lean Analytics Manager
 * Handles ShopRocket analytics (always), third-party e-commerce (if configured), and custom events
 */

import type { TrackingConfig } from '../types/analytics';
import { getConfig } from './config';
import { internalState } from './internal-state';
import { CookieManager } from '../utils/cookie-manager';
import { AnalyticsSanitizer } from '../utils/analytics-sanitizer';

// Event names
export const EVENTS = {
  VIEW_ITEM_LIST: 'view_item_list',
  VIEW_ITEM: 'view_item',
  SELECT_ITEM: 'select_item',
  VIEW_CART: 'view_cart',
  ADD_TO_CART: 'add_to_cart',
  REMOVE_FROM_CART: 'remove_from_cart',
  CART_OPENED: 'cart_opened',
  CART_CLOSED: 'cart_closed'
} as const;

export class AnalyticsManager {
  private static trackingConfig: TrackingConfig = {};
  private static loadedTrackers: Set<string> = new Set();
  
  /**
   * Initialize analytics with store configuration
   */
  static async init(config?: TrackingConfig) {
    if (config) {
      this.trackingConfig = config;
      
      // Lazy load only enabled third-party trackers
      const promises = [];
      
      if (config.google_analytics?.enabled) {
        promises.push(this.loadGoogleAnalytics());
      }
      
      if (config.facebook_pixel?.enabled) {
        promises.push(this.loadFacebookPixel());
      }
      
      if (config.google_ads?.enabled) {
        promises.push(this.loadGoogleAds());
      }
      
      // Load all enabled trackers in parallel
      await Promise.allSettled(promises);
    }
  }
  
  /**
   * Main tracking method - sends to all enabled systems
   */
  static track(event: string, data: any = {}) {
    // Sanitize data to only essential fields
    const sanitizedData = AnalyticsSanitizer.sanitizeEventData(event, data);
    
    // 1. Always track to ShopRocket
    this.trackToShopRocket(event, sanitizedData);
    
    // 2. Track to third-party if configured (e-commerce events only)
    if (this.isEcommerceEvent(event)) {
      this.trackToThirdParty(event, sanitizedData);
    }
    
    // 3. Always broadcast custom event for developers (with sanitized data)
    this.broadcast(event, sanitizedData);
  }
  
  /**
   * Send analytics to ShopRocket servers (comprehensive tracking)
   */
  private static trackToShopRocket(event: string, data: any) {
    const config = getConfig();
    
    // Get the store ID (numeric) from internal state
    const store = internalState.getStore();
    const storeId = store?.id;
    
    if (!storeId) {
      // If we don't have a store ID yet, we can't track
      // This prevents sending events with just the public key
      return;
    }
    
    // Get cart token and attribution from cookie
    const cartToken = CookieManager.getCartToken();
    const attribution = CookieManager.getAttribution();
    
    const payload = {
      event,
      data,
      store_id: storeId, // Required by backend
      cart_token: cartToken,
      url: location.href,
      ...attribution // Include UTM params, referrer, device info
    };
    
    // Use fetch with keepalive for reliability
    // No Content-Type header = defaults to text/plain (avoids CORS preflight)
    fetch(`${config.apiUrl}/events`, {
      method: 'POST',
      body: JSON.stringify(payload), // JSON sent as text/plain
      keepalive: true
    }).catch(() => {}); // Fire and forget
  }
  
  /**
   * Send to third-party e-commerce tracking (GA, FB, etc.)
   */
  private static trackToThirdParty(event: string, data: any) {
    // Dispatch to loaded trackers via custom event
    // Trackers listen for this and format appropriately
    window.dispatchEvent(new CustomEvent('shoprocket:internal:track', {
      detail: { event, data }
    }));
  }
  
  /**
   * Broadcast custom event for developer integration
   */
  private static broadcast(event: string, data: any) {
    window.dispatchEvent(new CustomEvent(`shoprocket:${event}`, {
      detail: data,
      bubbles: true,
      composed: true
    }));
  }
  
  /**
   * Check if event is e-commerce related
   */
  private static isEcommerceEvent(event: string): boolean {
    const ecommerceEvents = [
      'product_viewed',
      'add_to_cart',
      'remove_from_cart',
      'begin_checkout',
      'purchase',
      'view_item_list'
    ];
    return ecommerceEvents.includes(event);
  }
  
  
  /**
   * Lazy load Google Analytics tracker
   */
  private static async loadGoogleAnalytics() {
    if (this.loadedTrackers.has('google_analytics')) return;
    
    try {
      const { initGoogleAnalytics } = await import('../analytics/trackers/google-analytics');
      initGoogleAnalytics(this.trackingConfig.google_analytics!);
      this.loadedTrackers.add('google_analytics');
    } catch (error) {
      console.warn('Failed to load Google Analytics tracker:', error);
    }
  }
  
  /**
   * Lazy load Facebook Pixel tracker
   */
  private static async loadFacebookPixel() {
    if (this.loadedTrackers.has('facebook_pixel')) return;
    
    try {
      const { initFacebookPixel } = await import('../analytics/trackers/facebook-pixel');
      initFacebookPixel(this.trackingConfig.facebook_pixel!);
      this.loadedTrackers.add('facebook_pixel');
    } catch (error) {
      console.warn('Failed to load Facebook Pixel tracker:', error);
    }
  }
  
  /**
   * Lazy load Google Ads tracker
   */
  private static async loadGoogleAds() {
    if (this.loadedTrackers.has('google_ads')) return;
    
    try {
      const { initGoogleAds } = await import('../analytics/trackers/google-ads');
      initGoogleAds(this.trackingConfig.google_ads!);
      this.loadedTrackers.add('google_ads');
    } catch (error) {
      console.warn('Failed to load Google Ads tracker:', error);
    }
  }
}