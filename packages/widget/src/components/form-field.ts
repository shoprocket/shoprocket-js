import { html, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { BaseComponent } from '../core/base-component';

/**
 * Reusable Form Field Component
 * Reduces bundle size by sharing field logic
 */
export class FormField extends BaseComponent {
  @property({ type: String }) type = 'text';
  @property({ type: String }) label = '';
  @property({ type: String }) value = '';
  @property({ type: String }) placeholder = '';
  @property({ type: String }) error = '';
  @property({ type: String }) autocomplete = '';
  @property({ type: Boolean }) required = false;
  @property({ type: Boolean }) disabled = false;
  @property({ type: Array }) options: Array<{value: string, label: string}> = [];

  private handleInput(e: Event): void {
    const input = e.target as HTMLInputElement | HTMLSelectElement;
    this.dispatchEvent(new CustomEvent('field-change', {
      detail: { value: input.value },
      bubbles: true,
      composed: true
    }));
  }

  private handleBlur(): void {
    this.dispatchEvent(new CustomEvent('field-blur', {
      bubbles: true,
      composed: true
    }));
  }

  protected override render(): TemplateResult {
    const fieldId = `field-${Math.random().toString(36).substr(2, 9)}`;
    
    return html`
      <div class="sr-field-group">
        ${this.label ? html`
          <label class="sr-field-label" for="${fieldId}">
            ${this.label}
            ${this.required ? html`<span class="sr-field-required">*</span>` : ''}
          </label>
        ` : ''}
        
        ${this.type === 'select' ? html`
          <select
            id="${fieldId}"
            class="sr-field-select ${this.error ? 'sr-field-error' : ''}"
            .value="${this.value}"
            .disabled="${this.disabled}"
            ?required="${this.required}"
            @change="${this.handleInput}"
            @blur="${this.handleBlur}"
          >
            ${this.options.map(option => html`
              <option value="${option.value}" ?selected="${this.value === option.value}">
                ${option.label}
              </option>
            `)}
          </select>
        ` : html`
          <input
            type="${this.type}"
            id="${fieldId}"
            class="sr-field-input ${this.error ? 'sr-field-error' : ''}"
            .value="${this.value}"
            .disabled="${this.disabled}"
            ?required="${this.required}"
            placeholder="${this.placeholder}"
            autocomplete="${this.autocomplete}"
            @input="${this.handleInput}"
            @blur="${this.handleBlur}"
          >
        `}
        
        ${this.error ? html`
          <div class="sr-field-error-message">${this.error}</div>
        ` : ''}
      </div>
    `;
  }
}

if (!customElements.get('sr-form-field')) {
  customElements.define('sr-form-field', FormField);
}