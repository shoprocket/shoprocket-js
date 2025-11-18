/**
 * Cookie Manager for Cart & Analytics
 * Manages single cookie with cart_token, attribution, and auth data
 */

import { getCookie, setCookie, deleteCookie } from './cookie-utils';

export interface CartCookie {
  cart_token?: string;
  // Attribution (captured once on first visit)
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  referrer?: string;
  landing_page?: string;
  // Device info (captured once)
  device_type?: 'desktop' | 'mobile' | 'tablet';
  browser?: string;
  // Auth (when logged in)
  access_token?: string;
  // Timestamps
  created_at?: string;
  updated_at?: string;
}

export class CookieManager {
  private static readonly COOKIE_NAME = 'shoprocket_cart';
  private static readonly COOKIE_DAYS = 365;
  
  /**
   * Get the full cookie data
   */
  static getCookieData(): CartCookie {
    const cookieValue = getCookie(this.COOKIE_NAME);
    if (!cookieValue) {
      return {};
    }
    
    try {
      return JSON.parse(cookieValue);
    } catch {
      // Invalid JSON, return empty
      return {};
    }
  }
  
  /**
   * Save cookie data
   */
  private static saveCookie(data: CartCookie): void {
    setCookie(this.COOKIE_NAME, JSON.stringify(data), this.COOKIE_DAYS);
  }
  
  /**
   * Get or generate cart token
   */
  static getCartToken(): string {
    const data = this.getCookieData();
    
    if (!data.cart_token) {
      // Generate new cart token
      data.cart_token = this.generateCartToken();
      data.created_at = new Date().toISOString();
      data.updated_at = new Date().toISOString();
      
      // Capture attribution on first visit
      this.captureAttribution(data);
      
      // Capture device info
      this.captureDeviceInfo(data);
      
      this.saveCookie(data);
    }
    
    return data.cart_token;
  }
  
  /**
   * Regenerate cart token (after order completion)
   */
  static regenerateCartToken(): string {
    const data = this.getCookieData();
    
    // Keep attribution and auth, regenerate cart token
    data.cart_token = this.generateCartToken();
    data.updated_at = new Date().toISOString();
    
    this.saveCookie(data);
    return data.cart_token;
  }
  
  /**
   * Set access token (after login)
   */
  static setAccessToken(token: string): void {
    const data = this.getCookieData();
    data.access_token = token;
    data.updated_at = new Date().toISOString();
    this.saveCookie(data);
  }
  
  /**
   * Clear access token (after logout)
   */
  static clearAccessToken(): void {
    const data = this.getCookieData();
    delete data.access_token;
    data.updated_at = new Date().toISOString();
    this.saveCookie(data);
  }
  
  /**
   * Get access token
   */
  static getAccessToken(): string | undefined {
    return this.getCookieData().access_token;
  }
  
  /**
   * Get attribution data
   */
  static getAttribution(): Partial<CartCookie> {
    const data = this.getCookieData();
    return {
      utm_source: data.utm_source,
      utm_medium: data.utm_medium,
      utm_campaign: data.utm_campaign,
      utm_content: data.utm_content,
      utm_term: data.utm_term,
      referrer: data.referrer,
      landing_page: data.landing_page,
      device_type: data.device_type,
      browser: data.browser
    };
  }
  
  /**
   * Clear entire cookie
   */
  static clearCookie(): void {
    deleteCookie(this.COOKIE_NAME);
  }
  
  /**
   * Generate a unique cart token
   */
  private static generateCartToken(): string {
    // Use crypto.randomUUID if available (modern browsers, HTTPS only)
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return `cart_${crypto.randomUUID()}`;
    }

    // Fallback: Generate UUID v4 using crypto.getRandomValues (widely supported)
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      const uuid = ([1e7] as any + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (c: any) =>
        (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
      );
      return `cart_${uuid}`;
    }

    // Last resort: Math.random (not cryptographically secure, but works everywhere)
    const fallbackUuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
    return `cart_${fallbackUuid}`;
  }
  
  /**
   * Capture UTM parameters and referrer
   */
  private static captureAttribution(data: CartCookie): void {
    const params = new URLSearchParams(window.location.search);
    
    // Only capture if not already set (first visit)
    if (!data.utm_source) {
      data.utm_source = params.get('utm_source') || undefined;
      data.utm_medium = params.get('utm_medium') || undefined;
      data.utm_campaign = params.get('utm_campaign') || undefined;
      data.utm_content = params.get('utm_content') || undefined;
      data.utm_term = params.get('utm_term') || undefined;
    }
    
    if (!data.referrer) {
      data.referrer = document.referrer || undefined;
    }
    
    if (!data.landing_page) {
      data.landing_page = window.location.href;
    }
  }
  
  /**
   * Capture device information
   */
  private static captureDeviceInfo(data: CartCookie): void {
    // Simple device detection
    const ua = navigator.userAgent.toLowerCase();
    
    // Device type
    if (!data.device_type) {
      if (/mobile|android|iphone/.test(ua) && !/ipad|tablet/.test(ua)) {
        data.device_type = 'mobile';
      } else if (/ipad|tablet/.test(ua)) {
        data.device_type = 'tablet';
      } else {
        data.device_type = 'desktop';
      }
    }
    
    // Browser detection (simplified)
    if (!data.browser) {
      if (ua.includes('chrome') && !ua.includes('edg')) {
        data.browser = 'Chrome';
      } else if (ua.includes('safari') && !ua.includes('chrome')) {
        data.browser = 'Safari';
      } else if (ua.includes('firefox')) {
        data.browser = 'Firefox';
      } else if (ua.includes('edg')) {
        data.browser = 'Edge';
      } else {
        data.browser = 'Other';
      }
    }
  }
}