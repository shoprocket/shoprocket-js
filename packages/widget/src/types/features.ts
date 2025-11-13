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
  | 'name'            // Product name (alias for title, used by buy-button)
  | 'product-name'    // Product name (dashboard alias, maps to 'name')
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
                      // Note: Pagination always shows automatically when needed (totalPages > 1)
  | 'product-detail'; // Enable product detail view (makes products clickable)
                      // Use detail:* prefix for features specific to detail view (e.g., detail:gallery)

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
    // Catalog-level features
    'filters',
    'product-detail',  // Enable clickable products and detail view
    // Product card features (controls what shows on each product in the grid)
    'media', 'title', 'price', 'add-to-cart',
    // Detail view features (use detail: prefix for features specific to detail view)
    'detail:media', 'detail:gallery', 'detail:zoom', 'detail:title', 'detail:price',
    'detail:stock', 'detail:summary', 'detail:quantity', 'detail:add-to-cart', 'detail:description'
  ],
  // Buy button widget
  'buy-button': [
    'name',   // Product name on button
    'price'   // Product price on button
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