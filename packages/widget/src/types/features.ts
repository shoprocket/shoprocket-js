/**
 * Feature configuration system for widgets
 */

// All possible features across all widgets
export type FeatureKey = 
  // Navigation
  | 'navigation'      // Back/prev/next buttons
  | 'breadcrumbs'     // Breadcrumb trail
  
  // Media
  | 'media'           // Product images
  | 'zoom'            // Image zoom on hover
  | 'gallery'         // Thumbnail gallery
  
  // Product Info
  | 'title'           // Product name
  | 'price'           // Price display
  | 'stock'           // Stock status
  | 'sku'             // SKU display
  | 'description'     // Full description
  | 'short-description' // Short description
  
  // Shopping
  | 'variants'        // Variant selector
  | 'quantity'        // Quantity selector
  | 'add-to-cart'     // Add to cart button
  | 'wishlist'        // Wishlist button
  
  // Social
  | 'reviews'         // Product reviews
  | 'share'           // Social share buttons
  
  // Behaviors
  | 'scroll'          // Auto-scroll behavior
  | 'analytics';      // Analytics tracking

// Feature configuration
export interface FeatureConfig {
  // What features to show (undefined = use defaults)
  show?: FeatureKey[];
  
  // What features to hide (processed after show)
  hide?: FeatureKey[];
  
  // Theme name (future)
  theme?: string;
  
  // Feature-specific options (future)
  options?: {
    stock?: {
      showCount?: boolean;
      lowStockThreshold?: number;
    };
    media?: {
      thumbnailPosition?: 'bottom' | 'left';
    };
    // etc...
  };
}

// Default features per widget type
export const DEFAULT_FEATURES: Record<string, FeatureKey[]> = {
  'product-view': [
    'media', 'gallery', 'zoom', 'title', 'price', 'stock', 
    'variants', 'quantity', 'add-to-cart', 'description'
  ],
  'product-card': [
    'media', 'title', 'price', 'add-to-cart'
  ],
  'product-detail': [
    'navigation', 'media', 'gallery', 'zoom', 'title', 'price', 
    'stock', 'sku', 'variants', 'quantity', 'add-to-cart', 
    'description', 'reviews', 'share', 'scroll'
  ],
  // shoprocket-product element (used in catalog)
  'product': [
    'navigation', 'media', 'gallery', 'zoom', 'title', 'price', 
    'stock', 'sku', 'variants', 'quantity', 'add-to-cart', 
    'description', 'reviews', 'share', 'scroll'
  ]
};

// Parse features from data attributes
export function parseFeatures(
  element: Element,
  widgetType: string
): Set<FeatureKey> {
  const defaults = new Set(DEFAULT_FEATURES[widgetType] || []);
  
  // Parse show list (replaces defaults if provided)
  const showAttr = element.getAttribute('data-show');
  if (showAttr) {
    return new Set(showAttr.split(',').map(s => s.trim()) as FeatureKey[]);
  }
  
  // Parse hide list (removes from defaults)
  const hideAttr = element.getAttribute('data-hide');
  if (hideAttr) {
    const hideList = hideAttr.split(',').map(s => s.trim());
    hideList.forEach(feature => defaults.delete(feature as FeatureKey));
  }
  
  return defaults;
}