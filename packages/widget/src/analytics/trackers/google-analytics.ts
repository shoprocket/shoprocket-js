/**
 * Google Analytics 4 E-commerce Tracker
 * Only handles e-commerce events - regular tracking handled by user's existing GA
 */

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
    dataLayer?: any[];
  }
}

interface GAConfig {
  enabled: boolean;
  measurement_id: string;
  events?: string[];
}

export function initGoogleAnalytics(config: GAConfig) {
  // Don't load GA script - assume user has it
  // Just configure for e-commerce enhancement
  
  // Listen for internal tracking events
  window.addEventListener('shoprocket:internal:track', ((event: CustomEvent) => {
    const { event: eventName, data } = event.detail;
    
    // Check if this event should be tracked
    if (config.events && !config.events.includes(eventName)) {
      return;
    }
    
    // Track the e-commerce event
    trackEvent(eventName, data);
  }) as EventListener);
}

function trackEvent(eventName: string, data: any) {
  if (!window.gtag) {
    // GA not installed, skip
    return;
  }
  
  // Map our events to GA4 e-commerce events
  switch (eventName) {
    case 'product_viewed':
      gtag('event', 'view_item', {
        currency: data.currency,
        value: data.price,
        items: [{
          item_id: data.product_id,
          item_name: data.product_name,
          category: data.category,
          price: data.price,
          quantity: 1
        }]
      });
      break;
      
    case 'add_to_cart':
      gtag('event', 'add_to_cart', {
        currency: data.currency,
        value: data.value,
        items: data.items
      });
      break;
      
    case 'remove_from_cart':
      gtag('event', 'remove_from_cart', {
        currency: data.currency,
        value: data.value,
        items: data.items
      });
      break;
      
    case 'begin_checkout':
      gtag('event', 'begin_checkout', {
        currency: data.currency,
        value: data.value,
        coupon: data.coupon,
        items: data.items
      });
      break;
      
    case 'purchase':
      gtag('event', 'purchase', {
        transaction_id: data.transaction_id,
        value: data.value,
        tax: data.tax,
        shipping: data.shipping,
        currency: data.currency,
        coupon: data.coupon,
        items: data.items
      });
      break;
      
    case 'view_item_list':
      gtag('event', 'view_item_list', {
        item_list_id: data.item_list_id,
        item_list_name: data.item_list_name,
        items: data.items
      });
      break;
  }
}

// Minimal gtag function if needed
function gtag(...args: any[]) {
  if (window.gtag) {
    window.gtag(...args);
  } else if (window.dataLayer) {
    window.dataLayer.push(arguments);
  }
}