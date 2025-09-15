import type { ShoprocketCore, EventData } from '@shoprocket/core';
import { getCookie, setCookie } from '../utils/cookie-utils';

export interface AnalyticsConfig {
  enabled?: boolean;
  broadcast?: boolean;
}

export class Analytics {
  private sdk: ShoprocketCore;
  private config: AnalyticsConfig;
  private pageLoadTime: number;
  private pendingEvents: EventData[] = []; // Only for page unload

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
    this.sdk.events.track(eventData);

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
    const publishableKey = this.sdk.getPublishableKey?.() || 
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