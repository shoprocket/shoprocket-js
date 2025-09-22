/**
 * ARCHIVED: Searchable Select Implementation
 * 
 * This component was originally developed for the address form to provide
 * searchable country/state dropdowns during checkout. It was removed in favor
 * of native HTML select elements to follow industry standards and improve:
 * - Mobile UX (native selects use platform-specific UI)
 * - Accessibility (better screen reader support)
 * - Checkout conversion (less friction)
 * - Browser autofill compatibility
 * - Reliability (no JS required)
 * 
 * The implementation uses a teleport pattern to render dropdowns in the
 * shadow DOM root to avoid overflow issues. It includes:
 * - Client-side filtering
 * - Keyboard navigation
 * - CSS-only hover states
 * - Password manager interference prevention
 * 
 * This code is preserved for potential future use in non-checkout contexts
 * where a searchable select might enhance user experience (e.g., product
 * filters, admin interfaces).
 * 
 * Original implementation date: 2025-01
 */

import { html, type TemplateResult, LitElement, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';

export interface SelectOption {
  value: string;
  label: string;
}

export class SearchableSelect extends LitElement {
  // Use Light DOM to allow CSS inheritance
  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  @property({ type: String })
  override id = '';

  @property({ type: String })
  label = '';

  @property({ type: String })
  value = '';

  @property({ type: Array })
  options: SelectOption[] = [];

  @property({ type: Boolean })
  disabled = false;

  @property({ type: Boolean })
  required = false;

  @property({ type: String })
  placeholder = '';

  @property({ type: Boolean })
  loading = false;

  @state()
  private search = '';

  @state()
  private dropdownOpen = false;

  private highlightedIndex = -1;
  private dropdownElement?: HTMLDivElement;
  private clickOutsideTimeout?: number;

  override connectedCallback(): void {
    super.connectedCallback();
    this.handleGlobalClick = this.handleGlobalClick.bind(this);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    document.removeEventListener('click', this.handleGlobalClick, true);
    this.removeDropdown();
    if (this.clickOutsideTimeout) {
      clearTimeout(this.clickOutsideTimeout);
    }
  }

  private handleGlobalClick = (e: Event): void => {
    const target = e.target as HTMLElement;
    if (!this.contains(target)) {
      this.closeDropdown();
    }
  }

  private setupClickOutsideListener(): void {
    document.removeEventListener('click', this.handleGlobalClick, true);
    if (this.clickOutsideTimeout) {
      clearTimeout(this.clickOutsideTimeout);
    }
    this.clickOutsideTimeout = window.setTimeout(() => {
      document.addEventListener('click', this.handleGlobalClick, true);
    }, 100);
  }

  private removeDropdown(): void {
    if (this.dropdownElement) {
      this.dropdownElement.remove();
      this.dropdownElement = undefined;
    }
  }

  private openDropdown(): void {
    if (this.dropdownOpen || this.disabled || this.options.length === 0) return;
    this.dropdownOpen = true;
    this.search = '';
    this.highlightedIndex = -1;
    this.setupClickOutsideListener();
    this.requestUpdate();
  }

  private closeDropdown(): void {
    this.dropdownOpen = false;
    this.search = '';
    this.highlightedIndex = -1;
    document.removeEventListener('click', this.handleGlobalClick, true);
  }

  private handleSearch(value: string): void {
    this.search = value;
    this.highlightedIndex = 0;
  }

  private handleKeydown(e: KeyboardEvent): void {
    const filteredOptions = this.getFilteredOptions();

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (!this.dropdownOpen) {
          this.openDropdown();
        } else {
          this.highlightedIndex = Math.min(
            this.highlightedIndex + 1,
            filteredOptions.length - 1
          );
          this.updateDropdownHighlight();
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        this.highlightedIndex = Math.max(this.highlightedIndex - 1, 0);
        this.updateDropdownHighlight();
        break;
      case 'Enter':
        e.preventDefault();
        if (this.dropdownOpen && this.highlightedIndex >= 0) {
          const option = filteredOptions[this.highlightedIndex];
          if (option) {
            this.selectOption(option.value);
          }
        } else if (!this.dropdownOpen) {
          this.openDropdown();
        }
        break;
      case 'Escape':
        e.preventDefault();
        this.closeDropdown();
        break;
      case 'Tab':
        if (this.dropdownOpen) {
          this.closeDropdown();
        }
        break;
    }
  }

  private selectOption(value: string): void {
    this.value = value;
    this.closeDropdown();
    this.dispatchEvent(new CustomEvent('change', {
      detail: { value },
      bubbles: true,
      composed: true
    }));
  }

  private getFilteredOptions(): SelectOption[] {
    if (!this.search) return this.options;
    const searchLower = this.search.toLowerCase();
    return this.options.filter(option =>
      option.label.toLowerCase().includes(searchLower) ||
      option.value.toLowerCase().includes(searchLower)
    );
  }

  private updateDropdownHighlight(): void {
    if (!this.dropdownElement) return;
    
    const options = this.dropdownElement.querySelectorAll('.sr-dropdown-option');
    options.forEach((option, index) => {
      if (index === this.highlightedIndex) {
        option.classList.add('highlighted');
      } else {
        option.classList.remove('highlighted');
      }
    });
    
    // Scroll highlighted option into view
    if (this.highlightedIndex >= 0 && options[this.highlightedIndex]) {
      const option = options[this.highlightedIndex] as HTMLElement;
      const list = this.dropdownElement.querySelector('.sr-dropdown-list') as HTMLElement;
      if (list && option) {
        const optionTop = option.offsetTop;
        const optionBottom = optionTop + option.offsetHeight;
        const listTop = list.scrollTop;
        const listBottom = listTop + list.clientHeight;
        
        if (optionTop < listTop) {
          list.scrollTop = optionTop;
        } else if (optionBottom > listBottom) {
          list.scrollTop = optionBottom - list.clientHeight;
        }
      }
    }
  }

  override updated(changedProperties: PropertyValues): void {
    super.updated(changedProperties);
    
    if (this.dropdownOpen) {
      requestAnimationFrame(() => this.updateDropdownPortal());
    } else {
      this.removeDropdown();
    }
  }

  private updateDropdownPortal(): void {
    const input = this.querySelector('input') as HTMLInputElement;
    if (!input) return;

    const filteredOptions = this.getFilteredOptions();

    // Create dropdown element
    if (!this.dropdownElement) {
      const rootNode = this.getRootNode();
      const appendTarget = rootNode instanceof ShadowRoot ? rootNode : document.body;
      
      this.dropdownElement = document.createElement('div');
      this.dropdownElement.className = 'sr-dropdown-portal';
      appendTarget.appendChild(this.dropdownElement);
    }

    // Position dropdown
    const inputRect = input.getBoundingClientRect();
    this.dropdownElement.style.cssText = `
      position: fixed;
      top: ${inputRect.bottom + 2}px;
      left: ${inputRect.left}px;
      width: ${inputRect.width}px;
      z-index: 10002;
    `;

    // Render content
    this.dropdownElement.innerHTML = `
      <div class="sr-dropdown-list">
        ${filteredOptions.length > 0 ? filteredOptions.map((option, index) => `
          <div class="sr-dropdown-option ${
            option.value === this.value ? 'selected' : ''
          } ${
            index === this.highlightedIndex ? 'highlighted' : ''
          }" data-value="${option.value}" data-index="${index}">
            ${option.label}
          </div>
        `).join('') : '<div class="sr-dropdown-empty">No results found</div>'}
      </div>
    `;

    // Add click listeners
    this.dropdownElement.querySelectorAll('.sr-dropdown-option').forEach((element: Element) => {
      const optionEl = element as HTMLElement;
      optionEl.addEventListener('click', () => {
        const value = optionEl.dataset['value'];
        if (value) {
          this.selectOption(value);
        }
      });
    });
  }

  protected override render(): TemplateResult {
    const selectedOption = this.options.find(o => o.value === this.value);
    const displayValue = this.dropdownOpen ? this.search : (selectedOption?.label || '');

    return html`
      <div class="sr-field-group sr-searchable-select">
        <input
          type="search"
          id="${this.id}"
          class="sr-field-input peer ${this.value ? 'has-value' : ''}"
          .value="${displayValue}"
          .disabled="${this.disabled || this.loading}"
          placeholder="${this.placeholder || ' '}"
          autocomplete="off"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded="${this.dropdownOpen}"
          ?readonly="${!this.dropdownOpen}"
          @click="${() => !this.dropdownOpen && this.openDropdown()}"
          @focus="${() => !this.dropdownOpen && this.openDropdown()}"
          @input="${(e: Event) => {
            const value = (e.target as HTMLInputElement).value;
            this.handleSearch(value);
            if (!this.dropdownOpen) this.openDropdown();
          }}"
          @keydown="${(e: KeyboardEvent) => this.handleKeydown(e)}"
        >
        <label class="sr-field-label" for="${this.id}">
          ${this.label}${this.required ? html` <span class="sr-field-required">*</span>` : ''}
          ${this.loading ? ' (Loading...)' : ''}
        </label>
      </div>
    `;
  }
}

// Register the element
if (!customElements.get('searchable-select')) {
  customElements.define('searchable-select', SearchableSelect);
}