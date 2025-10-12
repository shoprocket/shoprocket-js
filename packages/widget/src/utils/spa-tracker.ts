/**
 * SPA (Single Page Application) Navigation Tracker
 *
 * Detects client-side navigation and fires page_view events for:
 * - pushState/replaceState (React Router, Vue Router, etc.)
 * - popstate (back/forward buttons)
 * - hashchange (hash-based routing)
 *
 * Smart filtering prevents noise from:
 * - Anchor links (#section-1)
 * - Image galleries (#img-2)
 * - Non-route hash changes
 */

export type PageViewCallback = () => void;

export class SPATracker {
  private static isSetup = false;
  private static lastUrl = '';
  private static lastTitle = '';
  private static callback: PageViewCallback | null = null;
  private static debounceTimer: number | null = null;

  /**
   * Setup SPA navigation tracking
   * @param callback Function to call when a route change is detected
   */
  static setup(callback: PageViewCallback): void {
    if (this.isSetup) {
      console.warn('SPATracker: Already setup');
      return;
    }

    this.callback = callback;
    this.lastUrl = location.href;
    this.lastTitle = document.title;
    this.isSetup = true;

    // Listen for browser back/forward
    window.addEventListener('popstate', () => this.handleNavigation());

    // Listen for hash changes (but filter intelligently)
    window.addEventListener('hashchange', () => this.handleNavigation());

    // Monkey-patch pushState and replaceState (for modern SPAs)
    this.interceptPushState();
    this.interceptReplaceState();

    // Observe title changes (some SPAs change title without URL change)
    this.observeTitleChanges();
  }

  /**
   * Handle navigation event with smart filtering
   */
  private static handleNavigation(): void {
    // Debounce to avoid duplicate events (300ms)
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = window.setTimeout(() => {
      const newUrl = location.href;
      const newTitle = document.title;

      // Check if this is a meaningful navigation
      if (this.shouldTrackNavigation(this.lastUrl, newUrl, this.lastTitle, newTitle)) {
        this.lastUrl = newUrl;
        this.lastTitle = newTitle;

        if (this.callback) {
          this.callback();
        }
      }
    }, 300);
  }

  /**
   * Determine if navigation should be tracked
   * Filters out anchor links and non-route hash changes
   */
  private static shouldTrackNavigation(
    oldUrl: string,
    newUrl: string,
    oldTitle: string,
    newTitle: string
  ): boolean {
    // No change at all
    if (oldUrl === newUrl && oldTitle === newTitle) {
      return false;
    }

    try {
      const oldParsed = new URL(oldUrl);
      const newParsed = new URL(newUrl);

      // Path changed = always track (MPA-like navigation)
      if (oldParsed.pathname !== newParsed.pathname) {
        return true;
      }

      // Search params changed = always track (?page=2)
      if (oldParsed.search !== newParsed.search) {
        return true;
      }

      // Title changed without URL change = track (some SPAs do this)
      if (oldTitle !== newTitle) {
        return true;
      }

      // Hash changed - need smart filtering
      const oldHash = oldParsed.hash;
      const newHash = newParsed.hash;

      if (oldHash !== newHash) {
        // Hash looks like a route (starts with #/ or #!/)
        // Examples: #/cart, #!/product/slug
        if (newHash.startsWith('#/') || newHash.startsWith('#!/')) {
          return true;
        }

        // Just an anchor link or gallery - ignore
        // Examples: #section-1, #image-2, #tab-settings
        return false;
      }

      return false;
    } catch (e) {
      // If URL parsing fails, don't track
      return false;
    }
  }

  /**
   * Intercept history.pushState for SPA tracking
   */
  private static interceptPushState(): void {
    const original = history.pushState;
    history.pushState = function(...args) {
      original.apply(history, args);
      SPATracker.handleNavigation();
    };
  }

  /**
   * Intercept history.replaceState for SPA tracking
   */
  private static interceptReplaceState(): void {
    const original = history.replaceState;
    history.replaceState = function(...args) {
      original.apply(history, args);
      SPATracker.handleNavigation();
    };
  }

  /**
   * Observe document.title changes using MutationObserver
   * Some SPAs change title without triggering other events
   */
  private static observeTitleChanges(): void {
    if (typeof MutationObserver === 'undefined') return;

    const observer = new MutationObserver(() => {
      const newTitle = document.title;
      if (newTitle !== this.lastTitle) {
        this.handleNavigation();
      }
    });

    observer.observe(document.querySelector('title') || document.head, {
      subtree: true,
      characterData: true,
      childList: true,
    });
  }
}
