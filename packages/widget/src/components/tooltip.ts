import { html, css, LitElement, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';

/**
 * Lightweight tooltip component for ShopRocket widget
 * Renders tooltips at root level to avoid CSS inheritance issues
 * Usage: <sr-tooltip text="Helpful information">Hover me</sr-tooltip>
 */
@customElement('sr-tooltip')
export class Tooltip extends LitElement {
  static override styles = css`
    :host {
      display: inline-block;
    }

    .trigger {
      display: inline-block;
    }
  `;

  @property({ type: String }) text = '';
  @property({ type: String }) position: 'top' | 'bottom' = 'top';
  @property({ type: Boolean }) wrap = false;
  
  private tooltipElement?: HTMLDivElement;
  private triggerElement?: HTMLElement;

  override connectedCallback(): void {
    super.connectedCallback();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.removeTooltip();
  }

  private createTooltip(): void {
    if (this.tooltipElement || !this.text) return;

    // Get the shadow root or document body
    const root = this.getRootNode() as ShadowRoot | Document;
    const container = root instanceof ShadowRoot ? root : document.body;

    // Create tooltip element
    this.tooltipElement = document.createElement('div');
    this.tooltipElement.className = 'sr-tooltip-portal';
    this.tooltipElement.setAttribute('role', 'tooltip');
    this.tooltipElement.style.cssText = `
      position: fixed;
      z-index: 10000;
      padding: 8px 12px;
      background: var(--color-text, #1f2937);
      color: var(--color-surface, #fff);
      font-size: 13px;
      line-height: 1.4;
      border-radius: 6px;
      white-space: ${this.wrap ? 'normal' : 'nowrap'};
      max-width: ${this.wrap ? '250px' : 'none'};
      pointer-events: none;
      opacity: 0;
      transition: opacity 200ms;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
    `;
    this.tooltipElement.textContent = this.text;

    // Create arrow
    const arrow = document.createElement('div');
    arrow.style.cssText = `
      position: absolute;
      width: 0;
      height: 0;
      border: 5px solid transparent;
      ${this.position === 'top' ? `
        bottom: -10px;
        left: 50%;
        transform: translateX(-50%);
        border-top-color: var(--color-text, #1f2937);
      ` : `
        top: -10px;
        left: 50%;
        transform: translateX(-50%);
        border-bottom-color: var(--color-text, #1f2937);
      `}
    `;
    this.tooltipElement.appendChild(arrow);

    container.appendChild(this.tooltipElement);
    this.positionTooltip();
  }

  private removeTooltip(): void {
    if (this.tooltipElement) {
      this.tooltipElement.remove();
      this.tooltipElement = undefined;
    }
  }

  private positionTooltip(): void {
    if (!this.tooltipElement || !this.triggerElement) return;

    const triggerRect = this.triggerElement.getBoundingClientRect();
    const tooltipRect = this.tooltipElement.getBoundingClientRect();

    let top: number;
    let left = triggerRect.left + (triggerRect.width / 2) - (tooltipRect.width / 2);

    if (this.position === 'top') {
      top = triggerRect.top - tooltipRect.height - 10;
    } else {
      top = triggerRect.bottom + 10;
    }

    // Keep tooltip within viewport
    const padding = 10;
    left = Math.max(padding, Math.min(left, window.innerWidth - tooltipRect.width - padding));
    
    // Flip if would go off screen
    if (this.position === 'top' && top < padding) {
      top = triggerRect.bottom + 10;
      // Update arrow position
      const arrow = this.tooltipElement.querySelector('div') as HTMLDivElement;
      if (arrow) {
        arrow.style.cssText = arrow.style.cssText.replace('bottom: -10px', 'top: -10px')
          .replace('border-top-color', 'border-bottom-color');
      }
    }

    this.tooltipElement.style.left = `${left}px`;
    this.tooltipElement.style.top = `${top}px`;
  }

  private showTooltip = (): void => {
    if (!this.text) return;
    
    this.createTooltip();
    
    // Force reflow then show
    requestAnimationFrame(() => {
      if (this.tooltipElement) {
        this.tooltipElement.style.opacity = '1';
      }
    });
  };

  private hideTooltip = (): void => {
    if (this.tooltipElement) {
      this.tooltipElement.style.opacity = '0';
      // Remove after transition
      setTimeout(() => this.removeTooltip(), 200);
    }
  };

  override render(): TemplateResult {
    return html`
      <div 
        class="trigger"
        @mouseenter="${this.showTooltip}"
        @mouseleave="${this.hideTooltip}"
        @focusin="${this.showTooltip}"
        @focusout="${this.hideTooltip}"
      >
        <slot @slotchange="${this.handleSlotChange}"></slot>
      </div>
    `;
  }

  private handleSlotChange(): void {
    this.triggerElement = this.shadowRoot?.querySelector('.trigger') as HTMLElement;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sr-tooltip': Tooltip;
  }
}