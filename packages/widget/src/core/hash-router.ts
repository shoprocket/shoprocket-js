/**
 * Centralized Hash Router - Single source of truth for URL hash state
 * 
 * Hash format: #!/[product-slug][/~/cart][?page=N]
 * Examples:
 * - "" or "#" -> list view, cart closed
 * - "#/~/cart" -> list view, cart open  
 * - "#?page=2" -> list view page 2
 * - "#!/product-slug" -> product view, cart closed
 * - "#!/product-slug/~/cart" -> product view, cart open
 */

export interface HashState {
  view: 'list' | 'product';
  productSlug?: string;
  cartOpen: boolean;
  page?: number;
}

export class HashRouter extends EventTarget {
  private static instance: HashRouter | null = null;
  private currentState: HashState = { view: 'list', cartOpen: false };

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
      return { view: 'list', cartOpen: false };
    }

    // Extract page number from hash - supports both page=N and ~pN formats
    let page: number | undefined;
    const pageMatch = hash.match(/page=(\d+)|~p(\d+)/);
    if (pageMatch) {
      const pageStr = pageMatch[1] || pageMatch[2];
      if (pageStr) {
        page = parseInt(pageStr, 10);
      }
    }

    // Check for cart state
    const cartOpen = hash.includes('/~/cart');
    
    // Check if this is just pagination (#!/page=N or #!/~pN)
    if (hash.match(/^#!\/(page=\d+|~p\d+)$/)) {
      return { view: 'list', cartOpen: false, page };
    }
    
    // Extract product slug
    if (hash.startsWith('#!/')) {
      const hashPath = hash.substring(3); // Remove #!/
      
      // Check if it's a page parameter first
      if (hashPath.startsWith('page=') || hashPath.startsWith('~p')) {
        return { view: 'list', cartOpen: false, page };
      }
      
      // Split by / or ? but exclude page parameter
      const parts = hashPath.split(/[/?]/);
      const productSlug = parts[0];
      
      // Only treat as product if it's not a page parameter
      if (productSlug && productSlug !== '~' && !productSlug.startsWith('page=')) {
        return { view: 'product', productSlug, cartOpen, page };
      }
    }
    
    // Just cart open on list view: #/~/cart
    if (hash === '#/~/cart') {
      return { view: 'list', cartOpen: true, page };
    }

    return { view: 'list', cartOpen: false, page };
  }

  private hasStateChanged(oldState: HashState, newState: HashState): boolean {
    return (
      oldState.view !== newState.view ||
      oldState.productSlug !== newState.productSlug ||
      oldState.cartOpen !== newState.cartOpen ||
      oldState.page !== newState.page
    );
  }

  // Public API for components to update state
  openCart(): void {
    const currentHash = window.location.hash;
    
    if (currentHash.includes('/~/cart')) {
      return; // Already open
    }

    let newHash: string;
    if (currentHash && currentHash !== '#' && currentHash.startsWith('#!/')) {
      // On product page: #!/product-slug -> #!/product-slug/~/cart
      newHash = currentHash + '/~/cart';
    } else {
      // On list view: '' or '#' -> #/~/cart
      newHash = '#/~/cart';
    }
    
    window.location.hash = newHash;
  }

  closeCart(): void {
    const currentHash = window.location.hash;
    
    if (!currentHash.includes('/~/cart')) {
      return; // Already closed
    }

    const newHash = currentHash.replace('/~/cart', '');
    window.location.hash = newHash === '#!' ? '' : newHash;
  }

  navigateToProduct(productSlug: string): void {
    const cartSuffix = this.currentState.cartOpen ? '/~/cart' : '';
    window.location.hash = `#!/${productSlug}${cartSuffix}`;
  }

  navigateToList(): void {
    const cartSuffix = this.currentState.cartOpen ? '/~/cart' : '';
    window.location.hash = cartSuffix ? '#/~/cart' : '';
  }

  getCurrentState(): HashState {
    return { ...this.currentState };
  }
  
  updateCatalogState(updates: { page?: number }): void {
    let newHash: string;
    if (updates.page && updates.page > 1) {
      newHash = `#!/page=${updates.page}`;
    } else {
      // Use #!/page=1 for page 1 to maintain consistent format and prevent jump
      newHash = '#!/page=1';
    }
    
    if (window.location.hash !== newHash) {
      window.location.hash = newHash;
    }
  }
}