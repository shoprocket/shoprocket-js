/**
 * Centralized Hash Router - Single source of truth for URL hash state
 * 
 * Hash format: #!/[product-slug][&param=value...][/~/cart]
 * Examples:
 * - "" or "#" -> list view, cart closed
 * - "#/~/cart" -> list view, cart open  
 * - "#!/page=2" -> list view page 2
 * - "#!/product-slug" -> product view, cart closed
 * - "#!/product-slug/~/cart" -> product view, cart open
 * - "#!/currency=GBP&page=3&sort=created/~/cart" -> list with params, cart open
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
    const hash = window.location.hash;
    
    if (!hash || hash === '#') {
      return { view: 'list', cartOpen: false, params: {} };
    }

    // Check for cart state first (it's always at the end)
    const cartOpen = hash.includes('/~/cart');
    
    // Remove cart suffix to parse the rest
    const hashWithoutCart = hash.replace('/~/cart', '');
    
    // Just cart open with no other params: #/~/cart
    if (hashWithoutCart === '#' || hashWithoutCart === '') {
      return { view: 'list', cartOpen: true, params: {} };
    }
    
    // Parse the main part
    if (hashWithoutCart.startsWith('#!/')) {
      const content = hashWithoutCart.substring(3); // Remove #!/
      
      // Parse parameters (key=value pairs separated by &)
      const params: Record<string, string> = {};
      let productSlug: string | undefined;
      
      // Split by & to get all parts
      const parts = content.split('&');
      
      // Check if first part is a product slug (doesn't contain =)
      if (parts[0] && !parts[0].includes('=')) {
        productSlug = parts[0];
        // Remove the product slug from parts
        parts.shift();
      }
      
      // Parse remaining parameters
      for (const part of parts) {
        if (part.includes('=')) {
          const [key, value] = part.split('=', 2);
          params[key] = decodeURIComponent(value);
        }
      }
      
      // Determine view type
      if (productSlug) {
        return { view: 'product', productSlug, cartOpen, params };
      } else {
        return { view: 'list', cartOpen, params };
      }
    }
    
    return { view: 'list', cartOpen: false, params: {} };
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
    const currentHash = window.location.hash;
    
    if (currentHash.includes('/~/cart')) {
      return; // Already open
    }

    // Simply append /~/cart to whatever hash we have
    if (!currentHash || currentHash === '#') {
      window.location.hash = '#/~/cart';
    } else {
      window.location.hash = currentHash + '/~/cart';
    }
  }

  closeCart(): void {
    const currentHash = window.location.hash;
    
    if (!currentHash.includes('/~/cart')) {
      return; // Already closed
    }

    const newHash = currentHash.replace('/~/cart', '');
    window.location.hash = newHash === '#!' ? '' : newHash;
  }

  navigateToProduct(productSlug: string, preserveParams: boolean = false): void {
    let newHash = `#!/${productSlug}`;
    
    // Optionally preserve existing parameters
    if (preserveParams && Object.keys(this.currentState.params).length > 0) {
      const paramString = Object.entries(this.currentState.params)
        .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
        .join('&');
      newHash += `&${paramString}`;
    }
    
    // Preserve cart state
    if (this.currentState.cartOpen) {
      newHash += '/~/cart';
    }
    
    window.location.hash = newHash;
  }

  navigateToList(preserveParams: boolean = true): void {
    if (preserveParams && Object.keys(this.currentState.params).length > 0) {
      // Build hash with parameters
      const paramString = Object.entries(this.currentState.params)
        .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
        .join('&');
      
      let newHash = `#!/${paramString}`;
      if (this.currentState.cartOpen) {
        newHash += '/~/cart';
      }
      window.location.hash = newHash;
    } else {
      // Simple navigation
      const cartSuffix = this.currentState.cartOpen ? '/~/cart' : '';
      window.location.hash = cartSuffix ? '#/~/cart' : '';
    }
  }

  getCurrentState(): HashState {
    return { 
      ...this.currentState,
      params: { ...this.currentState.params }
    };
  }
  
  // Generic method to update any parameters while preserving others
  updateParams(updates: Record<string, string | undefined>, preserveCart: boolean = true): void {
    const newParams = { ...this.currentState.params };
    
    // Apply updates (undefined values remove the param)
    for (const [key, value] of Object.entries(updates)) {
      if (value === undefined) {
        delete newParams[key];
      } else {
        newParams[key] = value;
      }
    }
    
    // Build new hash
    let newHash = '#!/';
    
    // Add product slug if on product view
    if (this.currentState.view === 'product' && this.currentState.productSlug) {
      newHash += this.currentState.productSlug;
      if (Object.keys(newParams).length > 0) {
        newHash += '&';
      }
    }
    
    // Add parameters
    if (Object.keys(newParams).length > 0) {
      const paramString = Object.entries(newParams)
        .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
        .join('&');
      newHash += paramString;
    }
    
    // Preserve cart state if requested
    if (preserveCart && this.currentState.cartOpen) {
      newHash += '/~/cart';
    }
    
    // Handle empty state
    if (newHash === '#!/') {
      newHash = '';
    }
    
    window.location.hash = newHash;
  }
  
  // Convenience method for catalog-specific updates
  updateCatalogState(updates: { page?: number; sort?: string; limit?: number; currency?: string }): void {
    const params: Record<string, string | undefined> = {};
    
    // Convert numbers to strings, handle undefined
    if (updates.page !== undefined) {
      params.page = updates.page > 1 ? String(updates.page) : undefined;
    }
    if (updates.sort !== undefined) {
      params.sort = updates.sort || undefined;
    }
    if (updates.limit !== undefined) {
      params.limit = updates.limit ? String(updates.limit) : undefined;
    }
    if (updates.currency !== undefined) {
      params.currency = updates.currency || undefined;
    }
    
    this.updateParams(params);
  }
}