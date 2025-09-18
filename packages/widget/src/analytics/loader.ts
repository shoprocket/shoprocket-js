/**
 * External tracker loader - loads trackers from CDN as separate scripts
 */

const CDN_BASE = 'https://cdn.shoprocket.io/v3/trackers';

export async function loadGoogleAnalytics(measurementId: string): Promise<void> {
  if ((window as any).__shoprocket_ga_loaded) return;
  
  const script = document.createElement('script');
  script.src = `${CDN_BASE}/google-analytics.js`;
  script.async = true;
  
  await new Promise((resolve, reject) => {
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
  
  // Initialize with config
  if ((window as any).initShopRocketGA) {
    (window as any).initShopRocketGA(measurementId);
  }
  
  (window as any).__shoprocket_ga_loaded = true;
}

export async function loadFacebookPixel(pixelId: string): Promise<void> {
  if ((window as any).__shoprocket_fb_loaded) return;
  
  const script = document.createElement('script');
  script.src = `${CDN_BASE}/facebook-pixel.js`;
  script.async = true;
  
  await new Promise((resolve, reject) => {
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
  
  // Initialize with config
  if ((window as any).initShopRocketFB) {
    (window as any).initShopRocketFB(pixelId);
  }
  
  (window as any).__shoprocket_fb_loaded = true;
}