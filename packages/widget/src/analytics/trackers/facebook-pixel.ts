/**
 * Facebook Pixel E-commerce Tracker
 * Only handles e-commerce events - regular tracking handled by user's existing pixel
 */

declare global {
  interface Window {
    fbq?: (...args: any[]) => void;
  }
}

interface FBConfig {
  enabled: boolean;
  pixel_id: string;
  events?: string[];
}

export function initFacebookPixel(config: FBConfig) {
  // Don't load FB script - assume user has it
  // Just enhance with e-commerce tracking
  
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
  if (!window.fbq) {
    // FB Pixel not installed, skip
    return;
  }
  
  // Map our events to Facebook Pixel events
  switch (eventName) {
    case 'product_viewed':
      fbq('track', 'ViewContent', {
        content_ids: [data.product_id],
        content_name: data.product_name,
        content_category: data.category,
        value: data.price,
        currency: data.currency,
        content_type: 'product'
      });
      break;
      
    case 'add_to_cart':
      fbq('track', 'AddToCart', {
        content_ids: data.items.map((item: any) => item.item_id),
        content_type: 'product',
        value: data.value,
        currency: data.currency
      });
      break;
      
    case 'begin_checkout':
      fbq('track', 'InitiateCheckout', {
        content_ids: data.items.map((item: any) => item.item_id),
        content_category: 'product',
        num_items: data.items.length,
        value: data.value,
        currency: data.currency
      });
      break;
      
    case 'purchase':
      fbq('track', 'Purchase', {
        content_ids: data.items.map((item: any) => item.item_id),
        content_type: 'product',
        value: data.value,
        currency: data.currency,
        num_items: data.items.length
      });
      break;
      
    case 'view_item_list':
      fbq('track', 'ViewCategory', {
        content_ids: data.items.map((item: any) => item.item_id),
        content_category: data.item_list_name,
        content_type: 'product'
      });
      break;
      
    // Note: FB doesn't have a standard remove from cart event
    // Could use CustomEvent if needed
  }
}

// Helper to call fbq safely
function fbq(...args: any[]) {
  if (window.fbq) {
    window.fbq(...args);
  }
}