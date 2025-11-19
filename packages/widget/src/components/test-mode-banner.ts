import { html, TemplateResult } from 'lit';
import { state } from 'lit/decorators.js';
import { BaseComponent } from '../core/base-component';
import { t } from '../utils/i18n';

export class TestModeBanner extends BaseComponent {
  @state() private isMinimized = true;
  
  override createRenderRoot() {
    // Use Shadow DOM with our styles
    const root = super.createRenderRoot();
    return root;
  }
  
  private toggleMinimize(): void {
    this.isMinimized = !this.isMinimized;
    
    // Dispatch event for parent to handle body padding
    this.dispatchEvent(new CustomEvent('toggle-minimize', {
      detail: { minimized: this.isMinimized },
      bubbles: true,
      composed: true
    }));
  }
  
  override render(): TemplateResult {
    return html`
      <div class="sr-test-banner ${this.isMinimized ? 'sr-test-banner-minimized' : ''}">
        <div class="sr-test-banner-content">
          <span class="sr-test-banner-text">Store in test mode - no orders will be fulfilled</span>
          <button 
            class="sr-test-banner-minimize"
            @click="${() => this.toggleMinimize()}"
            aria-label="${this.isMinimized ? t('banner.show', 'Show test mode banner') : t('banner.hide', 'Hide test mode banner')}"
            title="${this.isMinimized ? t('banner.show_short', 'Show banner') : t('banner.hide_short', 'Hide banner')}"
          >
            ×
          </button>
        </div>
      </div>
      ${this.isMinimized ? html`
        <div class="sr-test-banner-pill" @click="${() => this.toggleMinimize()}">
          <span>Test mode</span>
        </div>
      ` : ''}
    `;
  }
}