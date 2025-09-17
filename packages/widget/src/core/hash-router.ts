/**
 * Centralized Hash Router - Single source of truth for URL hash state
 * 
 * Non-destructive hash handling that preserves existing user hashes.
 * 
 * Hash format: [userHash]#!/[ourState]
 * 
 * Examples:
 * - "#section-2#!/product-slug" -> user hash preserved, product view
 * - "#section-2#!/~/cart" -> user hash preserved, cart open
 * - "#!/page=2&sort=price" -> no user hash, catalog with params
 * - "#my-app/route#!/product-slug/~/cart" -> complex user hash preserved
 */

export interface HashState {
  view: 'list' | 'product';
  productSlug?: string;
  cartOpen: boolean;
  params: Record<string, string>; // Flexible parameters
}

export class HashRouter extends EventTarget {
  private static instance: HashRouter | null = null;
  private currentState: HashState = { view: 'list', cartOpen: false, params: {} };

  private constructor() {
    super();
    this.handleHashChange = this.handleHashChange.bind(this);
    window.addEventListener('hashchange', this.handleHashChange);
    window.addEventListener('popstate', this.handleHashChange);
    
    // Parse initial state
    this.updateStateFromHash();
  }

  public static getInstance(): HashRouter {
    if (!HashRouter.instance) {
      HashRouter.instance = new HashRouter();
    }
    return HashRouter.instance;
  }

  destroy(): void {
    window.removeEventListener('hashchange', this.handleHashChange);
    window.removeEventListener('popstate', this.handleHashChange);
  }

  private handleHashChange(): void {
    this.updateStateFromHash();
  }

  private updateStateFromHash(): void {
    const newState = this.parseHash();
    
    // Only dispatch events if state actually changed
    if (this.hasStateChanged(this.currentState, newState)) {
      this.currentState = newState;
      this.dispatchEvent(new CustomEvent('state-change', { 
        detail: this.currentState 
      }));
    }
  }

  private parseHash(): HashState {
    const fullHash = window.location.hash;
    
    // No hash or empty hash = list view
    if (!fullHash || fullHash === '#') {
      return { view: 'list', cartOpen: false, params: {} };
    }
    
    // Split on #!/ to separate user hash from our state
    const parts = fullHash.split('#!/');
    if (parts.length < 2) {
      return { view: 'list', cartOpen: false, params: {} };
    }
    
    // Our part is everything after #!/
    let ourPart = parts[1] || '';
    
    // Check for cart state (always at the end)
    const cartOpen = ourPart.endsWith('~/cart');
    
    // Remove cart suffix to parse the rest
    if (cartOpen) {
      // Handle both /~/cart and ~/cart
      ourPart = ourPart.replace(/\/?~\/cart$/, '');
    }
    
    // Empty ourPart = list view
    if (!ourPart) {
      return { view: 'list', cartOpen, params: {} };
    }
    
    // Parse parameters and check for product
    const params: Record<string, string> = {};
    let productSlug: string | undefined;
    
    // Split by & to get all parts
    const paramParts = ourPart.split('&');
    
    // Check if first part is a product slug (doesn't contain =)
    if (paramParts[0] && !paramParts[0].includes('=')) {
      productSlug = paramParts[0];
      paramParts.shift(); // Remove product slug from parts
    }
    
    // Parse remaining parameters
    for (const part of paramParts) {
      if (part.includes('=')) {
        const [key, value] = part.split('=', 2);
        if (key && value) {
          params[key] = decodeURIComponent(value);
        }
      }
    }
    
    // Determine view type
    if (productSlug) {
      return { view: 'product', productSlug, cartOpen, params };
    } else {
      return { view: 'list', cartOpen, params };
    }
  }

  private hasStateChanged(oldState: HashState, newState: HashState): boolean {
    // Check basic properties
    if (oldState.view !== newState.view ||
        oldState.productSlug !== newState.productSlug ||
        oldState.cartOpen !== newState.cartOpen) {
      return true;
    }
    
    // Check if params changed
    const oldKeys = Object.keys(oldState.params);
    const newKeys = Object.keys(newState.params);
    
    if (oldKeys.length !== newKeys.length) {
      return true;
    }
    
    for (const key of oldKeys) {
      if (oldState.params[key] !== newState.params[key]) {
        return true;
      }
    }
    
    return false;
  }

  // Public API for components to update state
  openCart(): void {
    const fullHash = window.location.hash;
    const [userPart = '', ourPart = ''] = fullHash.split('#!/');
    
    if (ourPart.endsWith('~/cart')) {
      return; // Already open
    }

    // Append ~/cart to our state (with leading slash only if needed)
    const newOurPart = ourPart ? ourPart + '/~/cart' : '~/cart';
    this.setHash(userPart, newOurPart);
  }

  closeCart(): void {
    const fullHash = window.location.hash;
    const [userPart = '', ourPart = ''] = fullHash.split('#!/');
    
    if (!ourPart.endsWith('~/cart')) {
      return; // Already closed
    }

    // Remove ~/cart from our state (with or without leading slash)
    const newOurPart = ourPart.replace(/\/?~\/cart$/, '');
    this.setHash(userPart, newOurPart);
  }

  navigateToProduct(productSlug: string, preserveParams: boolean = false, additionalParams?: Record<string, string | number>): void {
    const fullHash = window.location.hash;
    const [userPart = ''] = fullHash.split('#!/');
    
    let newOurPart = productSlug;
    
    // Build parameters
    const params: Record<string, string> = {};
    
    // Optionally preserve existing parameters
    if (preserveParams) {
      Object.assign(params, this.currentState.params);
    }
    
    // Add additional parameters
    if (additionalParams) {
      for (const [key, value] of Object.entries(additionalParams)) {
        params[key] = String(value);
      }
    }
    
    // Add parameters to URL
    if (Object.keys(params).length > 0) {
      const paramString = Object.entries(params)
        .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
        .join('&');
      newOurPart += `&${paramString}`;
    }
    
    // Preserve cart state
    if (this.currentState.cartOpen) {
      newOurPart += '/~/cart';
    }
    
    this.setHash(userPart, newOurPart);
  }

  navigateToList(preserveParams: boolean = true): void {
    const fullHash = window.location.hash;
    const [userPart = ''] = fullHash.split('#!/');
    
    let newOurPart = '';
    
    if (preserveParams && Object.keys(this.currentState.params).length > 0) {
      // Build params string
      const paramString = Object.entries(this.currentState.params)
        .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
        .join('&');
      newOurPart = paramString;
    }
    
    // Preserve cart state
    if (this.currentState.cartOpen) {
      newOurPart = newOurPart ? newOurPart + '/~/cart' : '~/cart';
    }
    
    this.setHash(userPart, newOurPart);
  }

  getCurrentState(): HashState {
    return { 
      ...this.currentState,
      params: { ...this.currentState.params }
    };
  }
  
  // Generic method to update any parameters while preserving others
  updateParams(updates: Record<string, string | undefined>, preserveCart: boolean = true): void {
    const fullHash = window.location.hash;
    const [userPart = ''] = fullHash.split('#!/');
    
    const newParams = { ...this.currentState.params };
    
    // Apply updates (undefined values remove the param)
    for (const [key, value] of Object.entries(updates)) {
      if (value === undefined) {
        delete newParams[key];
      } else {
        newParams[key] = value;
      }
    }
    
    // Build new our part
    let newOurPart = '';
    
    // Add product slug if on product view
    if (this.currentState.view === 'product' && this.currentState.productSlug) {
      newOurPart = this.currentState.productSlug;
      if (Object.keys(newParams).length > 0) {
        newOurPart += '&';
      }
    }
    
    // Add parameters
    if (Object.keys(newParams).length > 0) {
      const paramString = Object.entries(newParams)
        .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
        .join('&');
      newOurPart += paramString;
    }
    
    // Preserve cart state if requested
    if (preserveCart && this.currentState.cartOpen) {
      newOurPart = newOurPart ? newOurPart + '/~/cart' : '~/cart';
    }
    
    this.setHash(userPart, newOurPart);
  }
  
  // Convenience method for catalog-specific updates
  updateCatalogState(updates: { page?: number; sort?: string; limit?: number; currency?: string }): void {
    const params: Record<string, string | undefined> = {};
    
    // Convert numbers to strings, handle undefined
    if (updates.page !== undefined) {
      params['page'] = updates.page > 1 ? String(updates.page) : undefined;
    }
    if (updates.sort !== undefined) {
      params['sort'] = updates.sort || undefined;
    }
    if (updates.limit !== undefined) {
      params['limit'] = updates.limit ? String(updates.limit) : undefined;
    }
    if (updates.currency !== undefined) {
      params['currency'] = updates.currency || undefined;
    }
    
    this.updateParams(params);
  }
  
  /**
   * Helper method to set hash while preserving user's original hash
   */
  private setHash(userPart: string, ourPart: string): void {
    if (!ourPart) {
      // Remove our part entirely
      if (!userPart || userPart === '#') {
        // No user part and no our part = clear hash
        window.location.hash = '';
      } else {
        // Keep user's hash only
        window.location.hash = userPart;
      }
    } else {
      // We have widget state
      if (!userPart || userPart === '#') {
        // No user part, just our state
        window.location.hash = '#!/' + ourPart;
      } else {
        // Both user and our state
        window.location.hash = userPart + '#!/' + ourPart;
      }
    }
  }
}