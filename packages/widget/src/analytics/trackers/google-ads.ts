/**
 * Google Ads Conversion Tracking
 * Tracks key conversion events for Google Ads campaigns
 */

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
  }
}

interface GAdsConfig {
  enabled: boolean;
  conversion_id: string;
  conversion_label?: string;
  events?: string[];
}

export function initGoogleAds(config: GAdsConfig) {
  // Assume gtag is already loaded (shared with GA4)
  
  // Listen for internal tracking events
  window.addEventListener('shoprocket:internal:track', ((event: CustomEvent) => {
    const { event: eventName, data } = event.detail;
    
    // Check if this event should be tracked
    if (config.events && !config.events.includes(eventName)) {
      return;
    }
    
    // Track conversion events
    trackEvent(eventName, data, config);
  }) as EventListener);
}

function trackEvent(eventName: string, data: any, config: GAdsConfig) {
  if (!window.gtag) {
    // gtag not available, skip
    return;
  }
  
  // Only track key conversion events for Google Ads
  switch (eventName) {
    case 'purchase':
      // Track purchase conversion
      gtag('event', 'conversion', {
        send_to: `${config.conversion_id}/${config.conversion_label || 'purchase'}`,
        value: data.value,
        currency: data.currency,
        transaction_id: data.transaction_id
      });
      break;
      
    case 'begin_checkout':
      // Track checkout started (if configured as conversion)
      if (config.conversion_label) {
        gtag('event', 'conversion', {
          send_to: `${config.conversion_id}/begin_checkout`,
          value: data.value,
          currency: data.currency
        });
      }
      break;
      
    case 'add_to_cart':
      // Track add to cart (for dynamic remarketing)
      gtag('event', 'add_to_cart', {
        send_to: config.conversion_id,
        value: data.value,
        currency: data.currency,
        items: data.items
      });
      break;
  }
}

// Helper to call gtag safely
function gtag(...args: any[]) {
  if (window.gtag) {
    window.gtag(...args);
  }
}