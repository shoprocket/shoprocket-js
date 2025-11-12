import { html, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { ShoprocketElement } from '../core/base-component';

/**
 * Toggle Switch Component
 *
 * @element shoprocket-toggle
 * @fires change - When toggle state changes
 *
 * @attr {boolean} checked - Whether toggle is on/off
 * @attr {boolean} disabled - Whether toggle is disabled
 * @attr {string} size - Size: 'sm' | 'md' | 'lg' (default: 'md')
 * @attr {string} label - Label text to display next to toggle
 * @attr {string} name - Form field name
 * @attr {string} id - Element ID
 *
 * @example
 * <shoprocket-toggle
 *   label="Use same address for billing"
 *   .checked="${this.sameAsBilling}"
 *   @change="${(e) => this.handleToggle(e.detail.checked)}"
 * ></shoprocket-toggle>
 */
export class Toggle extends ShoprocketElement {
  @property({ type: Boolean })
  checked = false;

  @property({ type: Boolean })
  disabled = false;

  @property({ type: String })
  size: 'sm' | 'md' | 'lg' = 'sm';

  @property({ type: String })
  label?: string;

  @property({ type: String })
  name?: string;

  @property({ type: String })
  id?: string;

  @property({ type: Boolean, attribute: 'has-error' })
  hasError = false;

  private handleToggle(): void {
    if (this.disabled) return;

    this.checked = !this.checked;

    // Dispatch change event
    this.dispatchEvent(new CustomEvent('change', {
      detail: { checked: this.checked },
      bubbles: true,
      composed: true
    }));
  }

  protected override render(): TemplateResult {
    const uniqueId = this.id || `toggle-${Math.random().toString(36).substr(2, 9)}`;

    // Calculate icon size based on toggle size
    const iconSize = this.size === 'sm' ? '12' : this.size === 'lg' ? '20' : '16';

    return html`
      <div class="sr-toggle-wrapper">
        <button
          type="button"
          role="switch"
          aria-checked="${this.checked}"
          class="sr-toggle-container sr-toggle-${this.size} ${this.checked ? 'sr-toggle-checked' : ''} ${this.disabled ? 'sr-toggle-disabled' : ''} ${this.hasError ? 'sr-toggle-error' : ''}"
          @click="${this.handleToggle}"
          ?disabled="${this.disabled}"
        >
          <span class="sr-toggle-track">
            <span class="sr-toggle-thumb">
              <!-- X icon (first child - shown when unchecked) -->
              <svg
                width="${iconSize}"
                height="${iconSize}"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                style="display: ${this.checked ? 'none' : 'block'}"
              >
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
              <!-- Check icon (last child - shown when checked) -->
              <svg
                width="${iconSize}"
                height="${iconSize}"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                style="display: ${this.checked ? 'block' : 'none'}"
              >
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </span>
          </span>
        </button>

        ${this.label ? html`
          <span class="sr-toggle-label ${this.disabled ? 'sr-toggle-label-disabled' : ''}" @click="${this.handleToggle}">
            ${this.label}
          </span>
        ` : ''}
      </div>
    `;
  }
}
