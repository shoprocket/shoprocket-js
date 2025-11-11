/**
 * Feature configuration system for widgets
 */

// All possible features across all widgets
export type FeatureKey =
  // Navigation
  | 'navigation'      // Back/prev/next buttons (parent feature)
  | 'back-button'     // Just the back button
  | 'prev-next'       // Just prev/next navigation
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
  | 'summary'         // Short summary text
  | 'description'     // Full description

  // Shopping
  | 'quantity'        // Quantity selector
  | 'add-to-cart'     // Add to cart button
  | 'wishlist'        // Wishlist button
  
  // Social
  | 'reviews'         // Product reviews
  | 'share'           // Social share buttons
  
  // Behaviors
  | 'scroll'          // Auto-scroll behavior
  | 'analytics'       // Analytics tracking

  // Catalog Features
  | 'filters'         // Filter toolbar (search, sort, category)
  | 'pagination';     // Pagination controls

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
    'media', 'gallery', 'zoom', 'title', 'price', 'stock', 'summary',
    'quantity', 'add-to-cart', 'description'
  ],
  'product-card': [
    'media', 'title', 'price', 'add-to-cart'
  ],
  'product-detail': [
    'navigation', 'back-button', 'prev-next', 'media', 'gallery', 'zoom', 'title', 'price',
    'stock', 'sku', 'summary', 'quantity', 'add-to-cart',
    'description', 'reviews', 'share', 'scroll'
  ],
  // shoprocket-product element (used in catalog)
  'product': [
    'navigation', 'back-button', 'prev-next', 'media', 'gallery', 'zoom', 'title', 'price',
    'stock', 'sku', 'summary', 'quantity', 'add-to-cart',
    'description', 'reviews', 'share', 'scroll'
  ],
  // Product catalog widget
  'catalog': [
    'filters', 'pagination'
  ]
};

// Parse features from data attributes
export function parseFeatures(
  element: Element,
  widgetType: string
): Set<FeatureKey> {
  const defaults = new Set(DEFAULT_FEATURES[widgetType] || []);

  // Parse features list (explicit list of what to show)
  const featuresAttr = element.getAttribute('data-features');
  if (featuresAttr !== null) {  // Attribute exists
    if (featuresAttr === '') {
      return new Set(); // Empty features = show nothing
    }
    return new Set(featuresAttr.split(',').map(s => s.trim()).filter(s => s) as FeatureKey[]);
  }

  // No features attribute = use defaults
  return defaults;
}