/**
 * Internal state management for the Shoprocket widget
 * This is not exposed globally - all access should go through the public API
 */

interface InternalState {
  store: any | null;
  session: {
    token: string;
    id?: string;
  } | null;
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
  session: null,
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
  
  setSession(token: string, id?: string) {
    state.session = { token, id };
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
  
  getSession() {
    return state.session;
  },
  
  getSessionToken() {
    return state.session?.token;
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
    state.session = null;
    state.cart = null;
    // Don't clear SDK as it's needed for operations
  }
};