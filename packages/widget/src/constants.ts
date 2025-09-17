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
export const IMAGE_SIZES = {
  THUMBNAIL: 'w=150,h=150,fit=cover',
  MAIN: 'w=800,h=800,fit=cover',
  ZOOM: 'w=1600,h=1600,fit=cover',
  PLACEHOLDER: 'w=600,h=800,fit=cover', // Default when no size specified
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