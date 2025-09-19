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
  private loadingCountries = false;

  @state()
  private loadingStatesList = false;

  @state()
  private currentCountryCode: string | undefined;

  @state()
  private stateFieldType: 'text' | 'select' | 'hidden' = 'text';

  override async connectedCallback(): Promise<void> {
    super.connectedCallback();
    // Only load countries if we haven't already
    if (this.countries.length === 0) {
      await this.loadCountries();
    }
    // Load states for the current country if set
    if (this.address.country && this.address.country !== this.currentCountryCode) {
      await this.loadStates(this.address.country);
    }
  }

  private async loadCountries(): Promise<void> {
    // Use cache if available
    if (cachedCountries.length > 0) {
      this.countries = cachedCountries;
      return;
    }
    
    this.loadingCountries = true;
    try {
      const locale = document.documentElement.lang || 'en';
      const response = await this.sdk.location.getCountries(locale);
      
      if (response?.data?.countries) {
        cachedCountries = response.data.countries;
        this.countries = cachedCountries;
      }
    } catch (error) {
      console.warn('Failed to load countries:', error);
    } finally {
      this.loadingCountries = false;
    }
  }

  private async loadStates(countryCode: string): Promise<void> {
    // Skip if same country
    if (this.currentCountryCode === countryCode) return;
    
    this.currentCountryCode = countryCode;
    
    // Check cache
    if (cachedStates.has(countryCode)) {
      this.states = cachedStates.get(countryCode) || [];
      this.stateFieldType = this.states.length > 0 ? 'select' : 'text';
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
    } catch (error) {
      console.warn('Failed to load states for', countryCode, error);
      this.stateFieldType = 'text';
    } finally {
      this.loadingStatesList = false;
    }
  }

  private handleInputChange(field: keyof AddressData, value: string): void {
    const updatedAddress = {
      ...this.address,
      [field]: value || undefined
    };

    if (field === 'country' && value && value !== this.currentCountryCode) {
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
          ${this.stateFieldType === 'select' ? html`
            <select
              id="state"
              class="sr-field-select peer ${this.hasValue(this.address.state) ? 'has-value' : ''}"
              .value="${this.address.state || ''}"
              .disabled="${this.disabled || this.loadingStatesList}"
              autocomplete="address-level1"
              @change="${(e: Event) => this.handleInputChange('state', (e.target as HTMLSelectElement).value)}"
            >
              <option value=""> </option>
              ${this.loadingStatesList ? html`
                <option disabled>Loading...</option>
              ` : this.states.map(state => html`
                <option value="${state.code}" ?selected="${this.address.state === state.code}">
                  ${state.name}
                </option>
              `)}
            </select>
            <label class="sr-field-label" for="state">State/Province</label>
          ` : html`
            <input
              type="text"
              id="state"
              class="sr-field-input peer ${this.hasValue(this.address.state) ? 'has-value' : ''}"
              .value="${this.address.state || ''}"
              .disabled="${this.disabled}"
              placeholder=" "
              autocomplete="address-level1"
              @input="${(e: Event) => this.handleInputChange('state', (e.target as HTMLInputElement).value)}"
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
          <select
            id="country"
            class="sr-field-select peer ${this.hasValue(this.address.country) ? 'has-value' : ''} ${this.getFieldError('country') ? 'sr-field-error' : ''}"
            .value="${this.address.country || ''}"
            .disabled="${this.disabled}"
            autocomplete="country"
            @change="${(e: Event) => this.handleInputChange('country', (e.target as HTMLSelectElement).value)}"
            @blur="${() => this.handleBlur('country')}"
          >
            <option value=""> </option>
            ${this.loadingCountries ? html`
              <option disabled>Loading...</option>
            ` : this.countries.map(country => html`
              <option value="${country.code}" ?selected="${this.address.country === country.code}">
                ${country.name}
              </option>
            `)}
          </select>
          <label class="sr-field-label" for="country">
            Country${this.isRequired('country') ? html` <span class="sr-field-required">*</span>` : ''}
          </label>
          ${this.getFieldError('country') ? html`
            <div class="sr-field-error-message">${this.getFieldError('country')}</div>
          ` : ''}
        </div>
      </div>
    `;
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