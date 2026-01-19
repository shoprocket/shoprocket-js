/**
 * Internal state management for the Shoprocket widget
 * This is not exposed globally - all access should go through the public API
 */

interface InternalState {
  store: any | null;
  cartToken: string | null;
  customerId: string | null;
  cart: {
    data: any;
    open: () => void;
    close: () => void;
    toggle: () => void;
  } | null;
  sdk: any | null;
}

// Module-level state (not on window)
const state: InternalState = {
  store: null,
  cartToken: null,
  customerId: null,
  cart: null,
  sdk: null
};

/**
 * State management functions
 */
export const internalState = {
  // Setters
  setStore(store: any) {
    state.store = store;
  },
  
  setCartToken(token: string) {
    state.cartToken = token;
  },

  setCustomerId(customerId: string | null) {
    state.customerId = customerId;
  },

  setCart(cart: any) {
    if (cart && typeof cart === 'object' && !cart.open) {
      // Just cart data - preserve existing methods if any
      state.cart = {
        data: cart,
        open: state.cart?.open || (() => {}),
        close: state.cart?.close || (() => {}),
        toggle: state.cart?.toggle || (() => {})
      };
    } else {
      // Full cart object with methods
      state.cart = cart;
    }
  },
  
  setSdk(sdk: any) {
    state.sdk = sdk;
  },
  
  // Getters
  getStore() {
    return state.store;
  },
  
  getCartToken() {
    return state.cartToken;
  },

  getCustomerId() {
    return state.customerId;
  },

  getCart() {
    return state.cart;
  },
  
  getCartData() {
    return state.cart?.data;
  },
  
  getSdk() {
    return state.sdk;
  },
  
  // Utility
  clear() {
    state.store = null;
    state.cartToken = null;
    state.customerId = null;
    state.cart = null;
    // Don't clear SDK as it's needed for operations
  }
};