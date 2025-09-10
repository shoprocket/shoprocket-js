/**
 * Centralized Hash Router - Single source of truth for URL hash state
 * 
 * Hash format: #!/[product-slug][/~/cart]
 * Examples:
 * - "" or "#" -> list view, cart closed
 * - "#/~/cart" -> list view, cart open  
 * - "#!/product-slug" -> product view, cart closed
 * - "#!/product-slug/~/cart" -> product view, cart open
 */

export interface HashState {
  view: 'list' | 'product';
  productSlug?: string;
  cartOpen: boolean;
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

    // Check for cart state
    const cartOpen = hash.includes('/~/cart');
    
    // Extract product slug
    if (hash.startsWith('#!/')) {
      const hashPath = hash.substring(3); // Remove #!/
      const productSlug = hashPath.split('/~/')[0]; // Get part before /~/cart
      
      if (productSlug) {
        return { view: 'product', productSlug, cartOpen };
      }
    }
    
    // Just cart open on list view: #/~/cart
    if (hash === '#/~/cart') {
      return { view: 'list', cartOpen: true };
    }

    return { view: 'list', cartOpen: false };
  }

  private hasStateChanged(oldState: HashState, newState: HashState): boolean {
    return (
      oldState.view !== newState.view ||
      oldState.productSlug !== newState.productSlug ||
      oldState.cartOpen !== newState.cartOpen
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
}