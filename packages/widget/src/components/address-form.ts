import { html, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { BaseComponent } from '../core/base-component';

export interface AddressData {
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postal_code: string;
  country: string;
  name?: string;
  company?: string;
  phone?: string;
}

export interface AddressFormErrors {
  line1?: string;
  city?: string;
  postal_code?: string;
  country?: string;
  name?: string;
  phone?: string;
}

export interface Country {
  code: string;
  name: string;
  phone_code?: string;
  currency?: string;
}

export interface State {
  code: string;
  name: string;
}

// Simple module-level cache to avoid repeated API calls
let cachedCountries: Country[] = [];
const cachedStates = new Map<string, State[]>();

/**
 * Address Form Component - Reusable address collection form with modern floating labels
 */
export class AddressForm extends BaseComponent {
  // Use Light DOM to avoid nested shadow DOMs
  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  @property({ type: String })
  override title = 'Address';

  @property({ type: Object })
  address: Partial<AddressData> = {};

  @property({ type: Object })
  errors: AddressFormErrors = {};

  @property({ type: Boolean })
  required = false;

  @property({ type: Boolean })
  disabled = false;

  @property({ type: Boolean, attribute: 'show-name' })
  showName = false;

  @property({ type: Boolean, attribute: 'show-company' })
  showCompany = false;

  @property({ type: Boolean, attribute: 'show-phone' })
  showPhone = false;

  @state()
  private countries: Country[] = [];

  @state()
  private states: State[] = [];


  @state()
  private loadingStatesList = false;

  @state()
  private currentCountryCode: string | undefined;

  @state()
  private stateFieldType: 'text' | 'select' | 'hidden' = 'text';

  @state()
  private countrySearch = '';

  @state()
  private countryDropdownOpen = false;

  @state()
  private stateSearch = '';

  @state()
  private stateDropdownOpen = false;

  private highlightedCountryIndex = -1;
  private highlightedStateIndex = -1;

  private dropdownElement?: HTMLDivElement;
  private clickOutsideTimeout?: number;

  override connectedCallback(): void {
    super.connectedCallback();
    
    // Use cached countries immediately if available
    if (cachedCountries.length > 0) {
      this.countries = cachedCountries;
    }
    
    // Use cached states immediately if available
    if (this.address.country) {
      if (cachedStates.has(this.address.country)) {
        this.currentCountryCode = this.address.country;
        this.states = cachedStates.get(this.address.country) || [];
        this.stateFieldType = this.states.length > 0 ? 'select' : 'text';
      } else {
        // Set current country code so loadStates doesn't skip
        this.currentCountryCode = '';
      }
    }
    
    // Load data asynchronously after component is rendered
    Promise.resolve().then(() => {
      // Load countries if not cached
      if (cachedCountries.length === 0) {
        this.loadCountries().then(() => {
          console.log('Countries loaded:', this.countries.length);
        });
      }
      
      // Load states if needed and not cached
      if (this.address.country && !cachedStates.has(this.address.country)) {
        this.loadStates(this.address.country);
      }
    });
    
    // Add global click handler for dropdowns with a delay to avoid immediate closing
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
  
  private removeDropdown(): void {
    if (this.dropdownElement) {
      this.dropdownElement.remove();
      this.dropdownElement = undefined;
    }
  }

  private updateDropdownHighlight(type: 'country' | 'state'): void {
    if (!this.dropdownElement) return;
    
    const highlightedIndex = type === 'country' ? this.highlightedCountryIndex : this.highlightedStateIndex;
    const options = this.dropdownElement.querySelectorAll('.sr-dropdown-option');
    
    options.forEach((option, index) => {
      if (index === highlightedIndex) {
        option.classList.add('highlighted');
      } else {
        option.classList.remove('highlighted');
      }
    });
    
    // Scroll highlighted option into view if needed
    if (highlightedIndex >= 0 && options[highlightedIndex]) {
      const option = options[highlightedIndex] as HTMLElement;
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

  private handleGlobalClick = (e: Event): void => {
    const target = e.target as HTMLElement;
    const countryContainer = this.querySelector('.sr-country-select-container');
    const stateContainer = this.querySelector('.sr-state-select-container');
    
    if (countryContainer && !countryContainer.contains(target)) {
      this.closeCountryDropdown();
    }
    if (stateContainer && !stateContainer.contains(target)) {
      this.closeStateDropdown();
    }
  }
  
  private setupClickOutsideListener(): void {
    // Remove any existing listener
    document.removeEventListener('click', this.handleGlobalClick, true);
    
    // Clear any existing timeout
    if (this.clickOutsideTimeout) {
      clearTimeout(this.clickOutsideTimeout);
    }
    
    // Add listener after a delay to avoid the opening click
    this.clickOutsideTimeout = window.setTimeout(() => {
      document.addEventListener('click', this.handleGlobalClick, true);
    }, 100);
  }

  private async loadCountries(): Promise<void> {
    // Use cache if available
    if (cachedCountries.length > 0) {
      this.countries = cachedCountries;
      return;
    }
    
    try {
      const locale = document.documentElement.lang || 'en';
      const response = await this.sdk.location.getCountries(locale);
      
      if (response?.data?.countries) {
        cachedCountries = response.data.countries;
        this.countries = cachedCountries;
      } else if (Array.isArray(response)) {
        // Handle direct array response
        cachedCountries = response;
        this.countries = cachedCountries;
      }
    } catch (error) {
      console.warn('Failed to load countries:', error);
    }
  }

  private async loadStates(countryCode: string): Promise<void> {
    // Skip if same country
    if (this.currentCountryCode === countryCode) return;
    
    this.currentCountryCode = countryCode;
    
    // Reset states immediately to avoid stale data
    this.states = [];
    this.stateFieldType = 'text';
    this.closeStateDropdown(); // Close any open dropdown
    
    // Check cache
    if (cachedStates.has(countryCode)) {
      this.states = cachedStates.get(countryCode) || [];
      this.stateFieldType = this.states.length > 0 ? 'select' : 'text';
      this.requestUpdate();
      return;
    }
    
    // Load from API
    this.loadingStatesList = true;
    try {
      const response = await this.sdk.location.getStates(countryCode);
      const states = response?.data?.states || [];
      cachedStates.set(countryCode, states);
      this.states = states;
      this.stateFieldType = states.length > 0 ? 'select' : 'text';
      this.requestUpdate();
    } catch (error) {
      console.warn('Failed to load states for', countryCode, error);
      this.states = [];
      this.stateFieldType = 'text';
    } finally {
      this.loadingStatesList = false;
      this.requestUpdate();
    }
  }

  private handleInputChange(field: keyof AddressData, value: string): void {
    const updatedAddress = {
      ...this.address,
      [field]: value || undefined
    };

    if (field === 'country' && value && value !== this.currentCountryCode) {
      // Load states asynchronously
      this.loadStates(value);
      updatedAddress.state = '';
    }

    this.dispatchEvent(new CustomEvent('address-change', {
      detail: { address: updatedAddress, field },
      bubbles: true,
      composed: true
    }));
  }

  private handleBlur(field: keyof AddressData): void {
    this.dispatchEvent(new CustomEvent('address-validate', {
      detail: { field, address: this.address },
      bubbles: true,
      composed: true
    }));
  }

  private getFieldError(field: keyof AddressFormErrors): string | undefined {
    return this.errors[field];
  }

  private isRequired(field: keyof AddressData): boolean {
    if (!this.required) return false;
    const requiredFields: (keyof AddressData)[] = ['line1', 'city', 'postal_code', 'country'];
    return requiredFields.includes(field);
  }

  private hasValue(value: any): boolean {
    return value !== undefined && value !== null && value !== '';
  }

  protected override render(): TemplateResult {
    return html`
      <div class="sr-address-form space-y-3">
        ${this.title ? html`
          <h3 class="sr-address-form-title">${this.title}</h3>
        ` : ''}
        
        <div class="sr-address-form-fields space-y-3">
          ${this.showName ? this.renderNameField() : ''}
          ${this.showCompany ? this.renderCompanyField() : ''}
          ${this.renderAddressFields()}
          ${this.renderLocationFields()}
          ${this.showPhone ? this.renderPhoneField() : ''}
        </div>
      </div>
    `;
  }

  private renderNameField(): TemplateResult {
    return html`
      <div class="sr-field-group">
        <input
          type="text"
          id="name"
          class="sr-field-input peer ${this.hasValue(this.address.name) ? 'has-value' : ''} ${this.getFieldError('name') ? 'sr-field-error' : ''}"
          .value="${this.address.name || ''}"
          .disabled="${this.disabled}"
          placeholder=" "
          autocomplete="name"
          @input="${(e: Event) => this.handleInputChange('name', (e.target as HTMLInputElement).value)}"
          @blur="${() => this.handleBlur('name')}"
        >
        <label class="sr-field-label" for="name">
          Full Name${this.isRequired('name') ? html` <span class="sr-field-required">*</span>` : ''}
        </label>
        ${this.getFieldError('name') ? html`
          <div class="sr-field-error-message">${this.getFieldError('name')}</div>
        ` : ''}
      </div>
    `;
  }

  private renderCompanyField(): TemplateResult {
    return html`
      <div class="sr-field-group">
        <input
          type="text"
          id="company"
          class="sr-field-input peer ${this.hasValue(this.address.company) ? 'has-value' : ''}"
          .value="${this.address.company || ''}"
          .disabled="${this.disabled}"
          placeholder=" "
          autocomplete="organization"
          @input="${(e: Event) => this.handleInputChange('company', (e.target as HTMLInputElement).value)}"
        >
        <label class="sr-field-label" for="company">Company (optional)</label>
      </div>
    `;
  }

  private renderAddressFields(): TemplateResult {
    return html`
      <!-- Address Line 1 -->
      <div class="sr-field-group">
        <input
          type="text"
          id="line1"
          class="sr-field-input peer ${this.hasValue(this.address.line1) ? 'has-value' : ''} ${this.getFieldError('line1') ? 'sr-field-error' : ''}"
          .value="${this.address.line1 || ''}"
          .disabled="${this.disabled}"
          placeholder=" "
          autocomplete="address-line1"
          @input="${(e: Event) => this.handleInputChange('line1', (e.target as HTMLInputElement).value)}"
          @blur="${() => this.handleBlur('line1')}"
        >
        <label class="sr-field-label" for="line1">
          Street Address${this.isRequired('line1') ? html` <span class="sr-field-required">*</span>` : ''}
        </label>
        ${this.getFieldError('line1') ? html`
          <div class="sr-field-error-message">${this.getFieldError('line1')}</div>
        ` : ''}
      </div>

      <!-- Address Line 2 -->
      <div class="sr-field-group">
        <input
          type="text"
          id="line2"
          class="sr-field-input peer ${this.hasValue(this.address.line2) ? 'has-value' : ''}"
          .value="${this.address.line2 || ''}"
          .disabled="${this.disabled}"
          placeholder=" "
          autocomplete="address-line2"
          @input="${(e: Event) => this.handleInputChange('line2', (e.target as HTMLInputElement).value)}"
        >
        <label class="sr-field-label" for="line2">
          Apartment, Suite, etc. (optional)
        </label>
      </div>
    `;
  }

  private renderLocationFields(): TemplateResult {
    return html`
      <!-- City and State/Region Row -->
      <div class="grid grid-cols-2 gap-3">
        <!-- City -->
        <div class="sr-field-group">
          <input
            type="text"
            id="city"
            class="sr-field-input peer ${this.hasValue(this.address.city) ? 'has-value' : ''} ${this.getFieldError('city') ? 'sr-field-error' : ''}"
            .value="${this.address.city || ''}"
            .disabled="${this.disabled}"
            placeholder=" "
            autocomplete="address-level2"
            @input="${(e: Event) => this.handleInputChange('city', (e.target as HTMLInputElement).value)}"
            @blur="${() => this.handleBlur('city')}"
          >
          <label class="sr-field-label" for="city">
            City${this.isRequired('city') ? html` <span class="sr-field-required">*</span>` : ''}
          </label>
          ${this.getFieldError('city') ? html`
            <div class="sr-field-error-message">${this.getFieldError('city')}</div>
          ` : ''}
        </div>

        <!-- State/Region -->
        <div class="sr-field-group">
          ${this.stateFieldType === 'select' && this.states.length > 0
            ? this.renderSearchableStateField()
            : html`
              <input
                type="text"
                id="state"
                class="sr-field-input peer ${this.hasValue(this.address.state) ? 'has-value' : ''}"
                .value="${this.address.state || ''}"
                .disabled="${this.disabled}"
                placeholder=" "
                autocomplete="address-level1"
                @input="${(e: Event) => this.handleInputChange('state', (e.target as HTMLInputElement).value)}"
                @blur="${() => this.handleBlur('state')}"
              >
              <label class="sr-field-label" for="state">State/Province</label>
            `}
        </div>
      </div>

      <!-- Postal Code and Country Row -->
      <div class="grid grid-cols-2 gap-3">
        <!-- Postal Code -->
        <div class="sr-field-group">
          <input
            type="text"
            id="postal_code"
            class="sr-field-input peer ${this.hasValue(this.address.postal_code) ? 'has-value' : ''} ${this.getFieldError('postal_code') ? 'sr-field-error' : ''}"
            .value="${this.address.postal_code || ''}"
            .disabled="${this.disabled}"
            placeholder=" "
            autocomplete="postal-code"
            @input="${(e: Event) => this.handleInputChange('postal_code', (e.target as HTMLInputElement).value)}"
            @blur="${() => this.handleBlur('postal_code')}"
          >
          <label class="sr-field-label" for="postal_code">
            Postal Code${this.isRequired('postal_code') ? html` <span class="sr-field-required">*</span>` : ''}
          </label>
          ${this.getFieldError('postal_code') ? html`
            <div class="sr-field-error-message">${this.getFieldError('postal_code')}</div>
          ` : ''}
        </div>

        <!-- Country -->
        <div class="sr-field-group">
          ${this.renderSearchableCountryField()}
          ${this.getFieldError('country') ? html`
            <div class="sr-field-error-message">${this.getFieldError('country')}</div>
          ` : ''}
        </div>
      </div>
    `;
  }

  private renderSearchableCountryField(): TemplateResult {
    const selectedCountry = this.countries.find(c => c.code === this.address.country);
    const displayValue = this.countryDropdownOpen ? this.countrySearch : (selectedCountry?.name || '');
    

    return html`
      <div class="sr-field-group sr-country-select-container">
        <input
          type="search"
          id="country"
          class="sr-field-input peer ${this.address.country ? 'has-value' : ''} ${this.getFieldError('country') ? 'sr-field-error' : ''}"
          .value="${displayValue}"
          .disabled="${this.disabled}"
          placeholder=" "
          autocomplete="country"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded="${this.countryDropdownOpen}"
          ?readonly="${!this.countryDropdownOpen}"
          @click="${() => !this.countryDropdownOpen && this.openCountryDropdown()}"
          @focus="${() => !this.countryDropdownOpen && this.openCountryDropdown()}"
          @input="${(e: Event) => {
            const value = (e.target as HTMLInputElement).value;
            this.handleCountrySearch(value);
            if (!this.countryDropdownOpen) this.openCountryDropdown();
          }}"
          @keydown="${(e: KeyboardEvent) => this.handleCountryKeydown(e)}"
        >
        <label class="sr-field-label" for="country">
          Country${this.isRequired('country') ? html` <span class="sr-field-required">*</span>` : ''}
        </label>
        
      </div>
    `;
  }

  override updated(changedProperties: Map<string, any>): void {
    super.updated(changedProperties);
    
    // Update dropdown portal within the cart's shadow DOM
    if (this.countryDropdownOpen || this.stateDropdownOpen) {
      requestAnimationFrame(() => this.updateDropdownPortal());
    } else {
      this.removeDropdown();
    }
  }

  private updateDropdownPortal(): void {
    const type = this.countryDropdownOpen ? 'country' : 'state';
    const input = this.querySelector(`#${type}`) as HTMLInputElement;
    if (!input) {
      console.warn(`Could not find ${type} input`);
      return;
    }

    // Get filtered items
    let filteredItems: any[];
    let selectedValue: string | undefined;
    let highlightedIndex: number;
    
    if (type === 'country') {
      filteredItems = this.countrySearch
        ? this.countries.filter(c => 
            c.name.toLowerCase().includes(this.countrySearch.toLowerCase()) ||
            c.code.toLowerCase().includes(this.countrySearch.toLowerCase())
          )
        : this.countries;
      selectedValue = this.address.country;
      highlightedIndex = this.highlightedCountryIndex;
    } else {
      filteredItems = this.stateSearch
        ? this.states.filter(s => 
            s.name.toLowerCase().includes(this.stateSearch.toLowerCase()) ||
            s.code.toLowerCase().includes(this.stateSearch.toLowerCase())
          )
        : this.states;
      selectedValue = this.address.state;
      highlightedIndex = this.highlightedStateIndex;
    }

    // Create or get dropdown element - append to the current root (shadow or document)
    if (!this.dropdownElement) {
      // Get the root node where this component is rendered
      const rootNode = this.getRootNode();
      
      // If we're in a shadow DOM, append to that shadow root
      // Otherwise append to document body
      const appendTarget = rootNode instanceof ShadowRoot ? rootNode : document.body;
      
      this.dropdownElement = document.createElement('div');
      this.dropdownElement.className = 'sr-dropdown-portal';
      appendTarget.appendChild(this.dropdownElement);
    }

    // Position dropdown using fixed positioning relative to viewport
    const inputRect = input.getBoundingClientRect();
    
    this.dropdownElement.style.cssText = `
      position: fixed;
      top: ${inputRect.bottom + 2}px;
      left: ${inputRect.left}px;
      width: ${inputRect.width}px;
      z-index: 10002;
    `;

    // Render dropdown content
    this.dropdownElement.innerHTML = `
      <div class="sr-dropdown-list">
        ${filteredItems.length > 0 ? filteredItems.map((item, index) => `
          <div class="sr-dropdown-option ${
            item.code === selectedValue ? 'selected' : ''
          } ${
            index === highlightedIndex ? 'highlighted' : ''
          }" data-value="${item.code}" data-index="${index}">
            ${item.name}
          </div>
        `).join('') : '<div class="sr-dropdown-empty">No results found</div>'}
      </div>
    `;

    // Add event listeners - only click events, no hover listeners
    this.dropdownElement.querySelectorAll('.sr-dropdown-option').forEach((option: Element) => {
      const element = option as HTMLElement;
      element.addEventListener('click', () => {
        const value = element.dataset['value'];
        if (value) {
          if (type === 'country') {
            this.selectCountry(value);
          } else {
            this.selectState(value);
          }
        }
      });
    });
  }

  private openCountryDropdown(): void {
    if (this.countryDropdownOpen) return;
    this.countryDropdownOpen = true;
    this.countrySearch = '';
    this.highlightedCountryIndex = -1;
    this.setupClickOutsideListener();
    this.requestUpdate(); // Force update to trigger dropdown render
  }

  private closeCountryDropdown(): void {
    this.countryDropdownOpen = false;
    this.countrySearch = '';
    this.highlightedCountryIndex = -1;
    // Remove listener when closing
    document.removeEventListener('click', this.handleGlobalClick, true);
  }

  private handleCountrySearch(value: string): void {
    this.countrySearch = value;
    this.highlightedCountryIndex = 0; // Highlight first result
  }

  private handleCountryKeydown(e: KeyboardEvent): void {
    const filteredCountries = this.countrySearch
      ? this.countries.filter(c => 
          c.name.toLowerCase().includes(this.countrySearch.toLowerCase()) ||
          c.code.toLowerCase().includes(this.countrySearch.toLowerCase())
        )
      : this.countries;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (!this.countryDropdownOpen) {
          this.openCountryDropdown();
        } else {
          this.highlightedCountryIndex = Math.min(
            this.highlightedCountryIndex + 1,
            filteredCountries.length - 1
          );
          this.updateDropdownHighlight('country');
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        this.highlightedCountryIndex = Math.max(this.highlightedCountryIndex - 1, 0);
        this.updateDropdownHighlight('country');
        break;
      case 'Enter':
        e.preventDefault();
        if (this.countryDropdownOpen && this.highlightedCountryIndex >= 0) {
          const country = filteredCountries[this.highlightedCountryIndex];
          if (country) {
            this.selectCountry(country.code);
          }
        } else if (!this.countryDropdownOpen) {
          this.openCountryDropdown();
        }
        break;
      case 'Escape':
        e.preventDefault();
        this.closeCountryDropdown();
        break;
      case 'Tab':
        if (this.countryDropdownOpen) {
          this.closeCountryDropdown();
        }
        break;
    }
  }

  private selectCountry(code: string): void {
    this.handleInputChange('country', code);
    this.closeCountryDropdown();
    
    // Skip focusing on state field - let user tab naturally
    // This avoids conflicts with password managers and API updates
    this.handleBlur('country');
  }

  private renderSearchableStateField(): TemplateResult {
    const selectedState = this.states.find(s => s.code === this.address.state);
    const displayValue = this.stateDropdownOpen ? this.stateSearch : (selectedState?.name || '');
    

    return html`
      <div class="sr-field-group sr-state-select-container">
        <input
          type="search"
          id="state"
          class="sr-field-input peer ${this.address.state ? 'has-value' : ''}"
          .value="${displayValue}"
          .disabled="${this.disabled || this.loadingStatesList}"
          placeholder=" "
          autocomplete="address-level1"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded="${this.stateDropdownOpen}"
          ?readonly="${!this.stateDropdownOpen}"
          @click="${() => !this.stateDropdownOpen && this.openStateDropdown()}"
          @focus="${() => !this.stateDropdownOpen && this.openStateDropdown()}"
          @input="${(e: Event) => {
            const value = (e.target as HTMLInputElement).value;
            this.handleStateSearch(value);
            if (!this.stateDropdownOpen) this.openStateDropdown();
          }}"
          @keydown="${(e: KeyboardEvent) => this.handleStateKeydown(e)}"
        >
        <label class="sr-field-label" for="state">
          State/Province${this.loadingStatesList ? ' (Loading...)' : ''}
        </label>
        
      </div>
    `;
  }

  private openStateDropdown(): void {
    if (this.stateDropdownOpen) return;
    if (this.states.length === 0) return;
    this.stateDropdownOpen = true;
    this.stateSearch = '';
    this.highlightedStateIndex = -1;
    this.setupClickOutsideListener();
    this.requestUpdate(); // Force update to trigger dropdown render
  }

  private closeStateDropdown(): void {
    this.stateDropdownOpen = false;
    this.stateSearch = '';
    this.highlightedStateIndex = -1;
    // Remove listener when closing
    document.removeEventListener('click', this.handleGlobalClick, true);
  }

  private handleStateSearch(value: string): void {
    this.stateSearch = value;
    this.highlightedStateIndex = 0; // Highlight first result
  }

  private handleStateKeydown(e: KeyboardEvent): void {
    const filteredStates = this.stateSearch
      ? this.states.filter(s => 
          s.name.toLowerCase().includes(this.stateSearch.toLowerCase()) ||
          s.code.toLowerCase().includes(this.stateSearch.toLowerCase())
        )
      : this.states;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (!this.stateDropdownOpen) {
          this.openStateDropdown();
        } else {
          this.highlightedStateIndex = Math.min(
            this.highlightedStateIndex + 1,
            filteredStates.length - 1
          );
          this.updateDropdownHighlight('state');
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        this.highlightedStateIndex = Math.max(this.highlightedStateIndex - 1, 0);
        this.updateDropdownHighlight('state');
        break;
      case 'Enter':
        e.preventDefault();
        if (this.stateDropdownOpen && this.highlightedStateIndex >= 0) {
          const state = filteredStates[this.highlightedStateIndex];
          if (state) {
            this.selectState(state.code);
          }
        } else if (!this.stateDropdownOpen) {
          this.openStateDropdown();
        }
        break;
      case 'Escape':
        e.preventDefault();
        this.closeStateDropdown();
        break;
      case 'Tab':
        if (this.stateDropdownOpen) {
          this.closeStateDropdown();
        }
        break;
    }
  }

  private selectState(code: string): void {
    this.handleInputChange('state', code);
    this.closeStateDropdown();
    this.handleBlur('state');
    // Skip auto-focusing - let user navigate naturally
  }


  private renderPhoneField(): TemplateResult {
    return html`
      <div class="sr-field-group">
        <input
          type="tel"
          id="phone"
          class="sr-field-input peer ${this.hasValue(this.address.phone) ? 'has-value' : ''} ${this.getFieldError('phone') ? 'sr-field-error' : ''}"
          .value="${this.address.phone || ''}"
          .disabled="${this.disabled}"
          placeholder=" "
          autocomplete="tel"
          @input="${(e: Event) => this.handleInputChange('phone', (e.target as HTMLInputElement).value)}"
          @blur="${() => this.handleBlur('phone')}"
        >
        <label class="sr-field-label" for="phone">
          Phone Number${this.isRequired('phone') ? html` <span class="sr-field-required">*</span>` : ''}
        </label>
        ${this.getFieldError('phone') ? html`
          <div class="sr-field-error-message">${this.getFieldError('phone')}</div>
        ` : ''}
      </div>
    `;
  }
}

// Register the custom element
if (!customElements.get('shoprocket-address-form')) {
  customElements.define('shoprocket-address-form', AddressForm);
}