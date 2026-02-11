import { LitElement, CSSResultGroup } from 'lit';
import { property, state } from 'lit/decorators.js';
import { ShoprocketCore } from '@shoprocket/core';
import { formatPrice, getMediaUrl, getMediaSrcSet, handleImageError, dispatchCartEvents } from '../utils/formatters';
import { sharedStyles, sharedStylesheet } from './shared-styles';
import { baseStyles } from './base-styles';
import { AnalyticsManager, EVENTS } from './analytics-manager';
import type { FeatureKey } from '../types/features';
import { parseFeatures } from '../types/features';

// Type for constructor functions
export type Constructor<T = {}> = new (...args: any[]) => T;

/**
 * Base class for Shoprocket components with Shadow DOM
 */
export class BaseComponent extends LitElement {
  private features: Set<FeatureKey> = new Set();
  // Apply shared styles to all components
  // Base styles reset font-size to prevent parent page scaling
  static override styles: CSSResultGroup = [baseStyles, sharedStyles];

  // Use constructable stylesheets for better performance
  // This method can be overridden by child components to use Light DOM
  protected override createRenderRoot(): HTMLElement | ShadowRoot {
    // Default behavior: create shadow root
    const root = super.createRenderRoot() as HTMLElement | ShadowRoot;

    // Only adopt stylesheets if it's actually a shadow root (not 'this' element)
    if (root !== this && 'adoptedStyleSheets' in root) {
      (root as any).adoptedStyleSheets = [sharedStylesheet];
    }

    return root;
  }
  @property({ attribute: false })
  sdk!: ShoprocketCore;

  // Track data-features attribute for hot-swapping
  // Using a private property to trigger updates when attribute changes
  @property({ type: String, attribute: 'data-features' })
  private _dataFeatures?: string;

  @state()
  private loadingStates = new Map<string, boolean>();

  @state()
  protected errorMessage: string | null = null;

  @state()
  protected successMessage: string | null = null;

  override connectedCallback(): void {
    super.connectedCallback();
    this.initializeFeatures();
  }

  override willUpdate(changedProperties: Map<string, any>): void {
    // Re-initialize features when data-features attribute changes
    if (changedProperties.has('_dataFeatures')) {
      this.initializeFeatures();
    }
  }

  private initializeFeatures(): void {
    // Get widget type from data attribute
    const widgetType = this.getAttribute('data-shoprocket') ||
                      this.getAttribute('data-widget-type') ||
                      this.tagName.toLowerCase().replace('shoprocket-', '');

    // Parse features from attributes
    this.features = parseFeatures(this, widgetType);
  }
  
  /**
   * Check if a feature is enabled
   */
  protected hasFeature(feature: FeatureKey): boolean {
    return this.features.has(feature);
  }

  /**
   * Enable a feature programmatically
   */
  public enableFeature(feature: FeatureKey): void {
    this.features.add(feature);
    this.requestUpdate();
  }

  /**
   * Disable a feature programmatically
   */
  public disableFeature(feature: FeatureKey): void {
    this.features.delete(feature);
    this.requestUpdate();
  }

  /**
   * Get all enabled features
   */
  protected getFeatures(): FeatureKey[] {
    return Array.from(this.features);
  }

  // Shadow DOM is enabled by default in Lit
  // To use Light DOM, override createRenderRoot() to return this

  protected async withLoading(key: string, fn: () => Promise<unknown>): Promise<void> {
    this.loadingStates.set(key, true);
    this.requestUpdate();
    try {
      await fn();
    } finally {
      this.loadingStates.set(key, false);
      this.requestUpdate();
    }
  }

  protected isLoading(key: string): boolean {
    return this.loadingStates.get(key) || false;
  }

  // Delegate to utility functions to avoid duplication
  protected getMediaUrl(media: Parameters<typeof getMediaUrl>[1], transformations?: string): string {
    return getMediaUrl(this.sdk, media, transformations);
  }

  protected getMediaSrcSet(media: Parameters<typeof getMediaSrcSet>[1]): string {
    return getMediaSrcSet(this.sdk, media);
  }

  protected handleImageError(e: Event): void {
    handleImageError(this.sdk, e);
  }
  
  protected dispatchCartEvents(product: any, variantId?: string, variantText?: string | null): void {
    dispatchCartEvents(this, product, variantId, variantText);
  }

  protected formatPrice(price: Parameters<typeof formatPrice>[0]): string {
    return formatPrice(price);
  }

  /**
   * Show an error message to the user
   */
  protected showError(message: string, duration: number = 5000): void {
    this.errorMessage = message;
    if (duration > 0) {
      setTimeout(() => {
        this.errorMessage = null;
      }, duration);
    }
  }

  /**
   * Clear any error message
   */
  protected clearError(): void {
    this.errorMessage = null;
  }

  /**
   * Show a success message to the user
   */
  protected showSuccess(message: string, duration: number = 3000): void {
    this.successMessage = message;
    if (duration > 0) {
      setTimeout(() => {
        this.successMessage = null;
      }, duration);
    }
  }

  /**
   * Track any event using the new lean analytics system
   */
  protected track(eventName: string, data?: any): void {
    AnalyticsManager.track(eventName, data);
  }

  /**
   * Get the store currency
   */
  protected getStoreCurrency(): string {
    const store = this.getStore();
    return store?.baseCurrencyCode || 'USD';
  }
  
  /**
   * Get the store data
   */
  protected getStore(): any {
    return (window as any).Shoprocket?.store?.get?.();
  }
}

export { BaseComponent as ShoprocketElement };

// Re-export EVENTS for easy access in all components
export { EVENTS };