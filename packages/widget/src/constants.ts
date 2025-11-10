/**
 * Centralized constants for the Shoprocket widget
 * Using const assertions for type safety and tree-shaking optimization
 */

// Animation and timing constants (in milliseconds)
export const TIMEOUTS = {
  ANIMATION: 300,        // Standard animation duration for transitions
  SUCCESS_MESSAGE: 2000, // How long to show success messages
  ZOOM_DELAY: 300,      // Delay before activating product image zoom
  DEBOUNCE: 300,        // Standard debounce delay
} as const;

// Stock management thresholds
export const STOCK_THRESHOLDS = {
  LOW: 10,              // Show "low stock" warning when quantity <= this
} as const;

// Image transformation sizes
// Main images use 3:4 (portrait) to match --sr-product-image-aspect-ratio
// Thumbnails use 1:1 (square) for cleaner grid appearance
export const IMAGE_SIZES = {
  THUMBNAIL: 'w=150,h=150,fit=cover', // 1:1 square aspect ratio
  MAIN: 'w=600,h=800,fit=cover', // 3:4 portrait aspect ratio
  ZOOM: 'w=1200,h=1600,fit=cover', // 3:4 portrait aspect ratio
  PLACEHOLDER: 'w=600,h=800,fit=cover', // Default when no size specified
} as const;

// Responsive image sizes for srcset generation (3:4 portrait aspect ratio)
// Browser automatically handles DPR - just provide the physical image sizes
export const RESPONSIVE_SIZES = {
  XS: { width: 400, transform: 'w=400,h=533,fit=cover' }, // 3:4 ratio
  SM: { width: 600, transform: 'w=600,h=800,fit=cover' }, // 3:4 ratio
  MD: { width: 800, transform: 'w=800,h=1067,fit=cover' }, // 3:4 ratio
  LG: { width: 1000, transform: 'w=1000,h=1333,fit=cover' }, // 3:4 ratio
  XL: { width: 1200, transform: 'w=1200,h=1600,fit=cover' }, // 3:4 ratio
} as const;

// UI spacing and layout constants
export const UI_SPACING = {
  TOOLTIP_OFFSET: 10,   // Space between tooltip and trigger element
  EDGE_PADDING: 10,     // Minimum space from viewport edges
  POSITION_OFFSET: 5,   // Common position offset (used in Tailwind classes)
} as const;

// List and pagination limits
export const LIMITS = {
  MAX_PAGINATION_BUTTONS: 5,  // Maximum visible page buttons
  MAX_ANALYTICS_ITEMS: 10,    // Maximum items to track in analytics
  DEFAULT_PER_PAGE: 12,       // Default products per page
  PER_PAGE_OPTIONS: [12, 24, 48, 96] as const, // User-selectable options
} as const;

// Route identifiers
export const ROUTES = {
  PRODUCT: 'product',
  CART: 'cart',
} as const;

// Event names (for consistency with analytics)
export const WIDGET_EVENTS = {
  CART_UPDATED: 'shoprocket:cart:updated',
  CART_LOADED: 'shoprocket:cart:loaded',
  PRODUCT_ADDED: 'shoprocket:product:added',
  CART_ADD_ITEM: 'shoprocket:cart:add-item',
  CART_ERROR: 'shoprocket:cart:error',
  OPEN_CART: 'open-cart',
  BACK_TO_LIST: 'back-to-list',
  NAVIGATE_PRODUCT: 'navigate-product',
} as const;