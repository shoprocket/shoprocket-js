import { html, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { BaseComponent } from '../core/base-component';
import { t } from '../utils/i18n';
import type { PlacePrediction, FieldVisibility } from '@shoprocket/core';

export interface AddressData {
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
  name?: string;
  company?: string;
  phone?: string;
  formatted?: string;
}

export interface AddressFormErrors {
  line1?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  name?: string;
  phone?: string;
}

export interface Country {
  code: string;
  name: string;
  phoneCode?: string;
  currency?: string;
  requiresState?: boolean;
}

export interface State {
  code: string;
  name: string;
}

// Split caches: billing always gets all countries, shipping gets shippable-only
let cachedAllCountries: Country[] = [];
let cachedShippableCountries: Country[] = [];
const cachedStates = new Map<string, State[]>();

/** Check if a country requires a state/province field */
export function countryRequiresState(countryCode: string): boolean {
  // Check all-countries cache first (has full data), then shippable cache
  const country = cachedAllCountries.find(c => c.code === countryCode)
    || cachedShippableCountries.find(c => c.code === countryCode);
  return country?.requiresState !== false;
}

/** Generate a UUID v4 session token for Google Places billing */
function generateSessionToken(): string {
  return crypto.randomUUID();
}

/**
 * Address Form Component - Reusable address collection form with modern floating labels
 */
export class AddressForm extends BaseComponent {
  @property({ type: String })
  type: 'shipping' | 'billing' = 'shipping';
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

  @property({ type: String })
  companyVisibility?: FieldVisibility;

  @property({ type: String })
  phoneVisibility?: FieldVisibility;

  @property({ type: String })
  line2Visibility?: FieldVisibility;

  @property({ type: Boolean, attribute: 'show-same-as-billing' })
  showSameAsBilling = false;

  @property({ type: Boolean, attribute: 'same-as-billing' })
  sameAsBilling = false;

  @property({ type: Boolean, attribute: 'autocomplete-enabled' })
  autocompleteEnabled = false;

  @property({ type: String, attribute: 'visitor-country' })
  visitorCountry = '';

  @state()
  private countries: Country[] = [];

  @state()
  private states: State[] = [];

  @state()
  private currentCountryCode: string | undefined;

  @state()
  private stateFieldType: 'text' | 'select' | 'hidden' = 'text';

  @state()
  private currentCountryRequiresState = true; // Default to true for backward compatibility

  // Autocomplete state
  @state()
  private predictions: PlacePrediction[] = [];

  @state()
  private autocompleteOpen = false;

  @state()
  private autocompleteLoading = false;

  @state()
  private highlightedIndex = -1;

  private sessionToken = generateSessionToken();
  private debounceTimer?: ReturnType<typeof setTimeout>;
  private abortController?: AbortController;

  // Track autofill to handle async state loading
  private pendingStateValue?: string;

  override connectedCallback(): void {
    super.connectedCallback();

    // Use the correct cache based on form type
    const cache = this.type === 'shipping' ? cachedShippableCountries : cachedAllCountries;

    // Use cached countries immediately if available
    if (cache.length > 0) {
      this.countries = cache;

      // Set requires_state flag for current country
      if (this.address.country) {
        const selectedCountry = this.countries.find(c => c.code === this.address.country);
        this.currentCountryRequiresState = selectedCountry?.requiresState !== false;
      }
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
      if (cache.length === 0) {
        this.loadCountries().then(() => {
          // After loading countries, set requires_state flag
          if (this.address.country) {
            const selectedCountry = this.countries.find(c => c.code === this.address.country);
            this.currentCountryRequiresState = selectedCountry?.requiresState !== false;
          }
        });
      }

      // Load states if needed and not cached
      if (this.address.country && !cachedStates.has(this.address.country)) {
        this.loadStates(this.address.country);
      }
    });

    // Listen for input events to detect autofill
    this.addEventListener('input', this.handleAutofillDetection);

    // Close dropdown on outside click
    document.addEventListener('click', this.handleDocumentClick);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.removeEventListener('input', this.handleAutofillDetection);
    document.removeEventListener('click', this.handleDocumentClick);
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.abortController?.abort();
  }

  private handleDocumentClick = (e: Event): void => {
    if (this.autocompleteOpen && !this.contains(e.target as Node)) {
      this.closeAutocomplete();
    }
  }

  private handleAutofillDetection = (_e: Event): void => {
    // When browser autofills, it fires input events on all fields rapidly
    // Check if state field got a value while states aren't loaded yet
    const stateSelect = this.querySelector('#state') as HTMLSelectElement;
    const countrySelect = this.querySelector('#country') as HTMLSelectElement;

    if (stateSelect && stateSelect.value) {
      // Check if password manager set a state name instead of code
      const matchingState = this.states.find(s =>
        s.name.toLowerCase() === stateSelect.value.toLowerCase()
      );

      if (matchingState && matchingState.code !== stateSelect.value) {
        // Password manager set the name, but we need the code
        this.handleInputChange('state', matchingState.code);
      }
    }

    if (stateSelect && countrySelect && stateSelect.value && this.stateFieldType === 'text') {
      // State was autofilled as text, store it and load states for the country
      this.pendingStateValue = stateSelect.value;
      if (countrySelect.value && countrySelect.value !== this.currentCountryCode) {
        this.loadStates(countrySelect.value).then(() => {
          // After states load, if we have a matching state, update the field
          if (this.pendingStateValue) {
            const matchingState = this.states.find(s =>
              s.code === this.pendingStateValue ||
              s.name.toLowerCase() === this.pendingStateValue?.toLowerCase()
            );
            if (matchingState) {
              this.address = { ...this.address, state: matchingState.code };
              this.requestUpdate();
              this.pendingStateValue = undefined;
            }
          }
        });
      }
    }
  }

  // ==================== Autocomplete Methods ====================

  private handleLine1Input(value: string): void {
    this.handleInputChange('line1', value);

    if (!this.autocompleteEnabled) return;

    // Cancel any pending request
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.abortController?.abort();

    if (value.length < 3) {
      this.closeAutocomplete();
      return;
    }

    this.debounceTimer = setTimeout(() => this.fetchPredictions(value), 300);
  }

  private async fetchPredictions(query: string): Promise<void> {
    this.abortController = new AbortController();
    this.autocompleteLoading = true;

    try {
      const predictions = await this.sdk.places.autocomplete(
        query,
        this.sessionToken,
        this.address.country || this.visitorCountry || undefined,
        { signal: this.abortController.signal }
      );
      this.predictions = predictions;
      this.autocompleteOpen = predictions.length > 0;
      this.highlightedIndex = -1;
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        this.predictions = [];
        this.autocompleteOpen = false;
      }
    } finally {
      this.autocompleteLoading = false;
    }
  }

  private async selectPrediction(prediction: PlacePrediction): Promise<void> {
    this.closeAutocomplete();
    this.autocompleteLoading = true;

    try {
      const details = await this.sdk.places.details(prediction.placeId, this.sessionToken);

      // Generate new session token for next search
      this.sessionToken = generateSessionToken();

      // Build the updated address from place details
      const updatedAddress: Partial<AddressData> = {
        ...this.address,
        line1: details.line1 || this.address.line1 || '',
        line2: details.line2 || '',
        city: details.city || '',
        postalCode: details.postalCode || '',
        country: details.countryCode || this.address.country || '',
        state: details.stateCode || '',
      };

      // Load states for the new country if needed
      if (details.countryCode && details.countryCode !== this.currentCountryCode) {
        const selectedCountry = this.countries.find(c => c.code === details.countryCode);
        this.currentCountryRequiresState = selectedCountry?.requiresState !== false;
        await this.loadStates(details.countryCode);
      }

      // Dispatch address-change with all fields populated
      this.dispatchEvent(new CustomEvent('address-change', {
        detail: { address: updatedAddress, field: 'line1' },
        bubbles: true,
        composed: true
      }));
    } catch (e) {
      console.warn('Failed to get place details:', e);
    } finally {
      this.autocompleteLoading = false;
    }
  }

  private handleAutocompleteKeydown(e: KeyboardEvent): void {
    if (!this.autocompleteOpen) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        this.highlightedIndex = Math.min(this.highlightedIndex + 1, this.predictions.length - 1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        this.highlightedIndex = Math.max(this.highlightedIndex - 1, -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (this.highlightedIndex >= 0 && this.highlightedIndex < this.predictions.length) {
          this.selectPrediction(this.predictions[this.highlightedIndex]);
        }
        break;
      case 'Escape':
        this.closeAutocomplete();
        break;
    }
  }

  private closeAutocomplete(): void {
    this.autocompleteOpen = false;
    this.predictions = [];
    this.highlightedIndex = -1;
  }

  // ==================== Existing Methods ====================

  private async loadCountries(): Promise<void> {
    const isShipping = this.type === 'shipping';
    const cache = isShipping ? cachedShippableCountries : cachedAllCountries;

    // Use cache if available
    if (cache.length > 0) {
      this.countries = cache;
      return;
    }

    try {
      const locale = document.documentElement.lang || 'en';
      const response = await this.sdk.location.getCountries(locale, isShipping);

      let countries: Country[] = [];
      if (response?.data?.countries) {
        countries = response.data.countries;
      } else if (Array.isArray(response)) {
        countries = response;
      }

      // Store in the correct cache
      if (isShipping) {
        cachedShippableCountries = countries;
      } else {
        cachedAllCountries = countries;
      }
      this.countries = countries;
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

    // Check cache
    if (cachedStates.has(countryCode)) {
      this.states = cachedStates.get(countryCode) || [];
      this.stateFieldType = this.states.length > 0 ? 'select' : 'text';
      this.requestUpdate();
      return;
    }

    // Load from API
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
      this.requestUpdate();
    }
  }

  private handleInputChange(field: keyof AddressData, value: string, isAutofill = false): void {
    const updatedAddress = {
      ...this.address,
      [field]: value  // Keep empty strings to allow clearing fields
    };

    if (field === 'country' && value && value !== this.currentCountryCode) {
      // Update requires_state flag based on selected country
      const selectedCountry = this.countries.find(c => c.code === value);
      this.currentCountryRequiresState = selectedCountry?.requiresState !== false; // Default to true if undefined

      // Store current state value if autofill is happening
      if (isAutofill && this.address.state) {
        this.pendingStateValue = this.address.state;
      }

      // Load states asynchronously
      this.loadStates(value).then(() => {
        // If we had a pending state value from autofill, try to set it now
        if (this.pendingStateValue && this.states.some(s => s.code === this.pendingStateValue)) {
          this.handleInputChange('state', this.pendingStateValue);
          this.pendingStateValue = undefined;
        }
      });

      // Always clear state when country changes - old state is invalid for new country
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
      detail: { field, address: this.address, type: this.type || 'shipping' },
      bubbles: true,
      composed: true
    }));
  }

  private getFieldError(field: keyof AddressFormErrors): string | undefined {
    return this.errors[field];
  }

  /** Resolve effective visibility: new tri-state props take priority over boolean props */
  private getEffectiveVisibility(field: 'company' | 'phone' | 'line2'): FieldVisibility {
    if (field === 'company') {
      if (this.companyVisibility) return this.companyVisibility;
      return this.showCompany ? 'optional' : 'hidden';
    }
    if (field === 'phone') {
      if (this.phoneVisibility) return this.phoneVisibility;
      return this.showPhone ? 'optional' : 'hidden';
    }
    // line2: default to optional (backward compat - was always shown)
    return this.line2Visibility || 'optional';
  }

  private isRequired(field: keyof AddressData): boolean {
    if (!this.required) return false;
    if (field === 'state') return this.currentCountryRequiresState;
    if (field === 'company') return this.getEffectiveVisibility('company') === 'required';
    if (field === 'phone') return this.getEffectiveVisibility('phone') === 'required';
    if (field === 'line2') return this.getEffectiveVisibility('line2') === 'required';
    const requiredFields: (keyof AddressData)[] = ['line1', 'city', 'postalCode', 'country'];
    return requiredFields.includes(field);
  }

  private hasValue(value: any): boolean {
    return value !== undefined && value !== null && value !== '';
  }

  private detectAutofill(): boolean {
    // Simple heuristic: check if multiple address fields have values
    // This helps detect when password manager fills the form
    const filledFields = [
      this.address.line1,
      this.address.city,
      this.address.postalCode,
      this.address.country
    ].filter(v => v).length;

    return filledFields >= 2;
  }

  protected override render(): TemplateResult {
    const companyVis = this.getEffectiveVisibility('company');
    const phoneVis = this.getEffectiveVisibility('phone');

    return html`
      <div class="sr-address-form space-y-3">
        ${this.title ? html`
          <h3 class="sr-address-form-title">${this.title}</h3>
        ` : ''}

        <div class="sr-address-form-fields space-y-3">
          ${this.showName ? this.renderNameField() : ''}
          ${companyVis !== 'hidden' ? this.renderCompanyField() : ''}
          ${this.renderAddressFields()}
          ${this.renderLocationFields()}
          ${phoneVis !== 'hidden' ? this.renderPhoneField() : ''}
          ${this.showSameAsBilling ? this.renderSameAsBillingField() : ''}
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
    const vis = this.getEffectiveVisibility('company');
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
          @blur="${() => this.handleBlur('company' as any)}"
        >
        <label class="sr-field-label" for="company">
          Company${vis === 'required' ? html` <span class="sr-field-required">*</span>` : vis === 'optional' ? ' (optional)' : ''}
        </label>
      </div>
    `;
  }

  private renderAddressFields(): TemplateResult {
    const listboxId = `sr-autocomplete-listbox-${this.type}`;

    return html`
      <!-- Address Line 1 with autocomplete -->
      <div class="sr-autocomplete-container">
        <div class="sr-field-group">
          <input
            type="text"
            id="line1"
            class="sr-field-input peer ${this.hasValue(this.address.line1) ? 'has-value' : ''} ${this.getFieldError('line1') ? 'sr-field-error' : ''}"
            .value="${this.address.line1 || ''}"
            .disabled="${this.disabled}"
            placeholder=" "
            autocomplete="${this.autocompleteEnabled ? 'off' : 'address-line1'}"
            role="${this.autocompleteEnabled ? 'combobox' : ''}"
            aria-expanded="${this.autocompleteEnabled ? String(this.autocompleteOpen) : ''}"
            aria-controls="${this.autocompleteEnabled ? listboxId : ''}"
            aria-autocomplete="${this.autocompleteEnabled ? 'list' : ''}"
            aria-activedescendant="${this.autocompleteEnabled && this.highlightedIndex >= 0 ? `sr-ac-item-${this.highlightedIndex}` : ''}"
            @input="${(e: Event) => this.handleLine1Input((e.target as HTMLInputElement).value)}"
            @keydown="${(e: KeyboardEvent) => this.handleAutocompleteKeydown(e)}"
            @blur="${() => this.handleBlur('line1')}"
          >
          <label class="sr-field-label" for="line1">
            Street Address${this.isRequired('line1') ? html` <span class="sr-field-required">*</span>` : ''}
          </label>
          ${this.autocompleteEnabled && this.autocompleteLoading ? html`
            <div class="sr-autocomplete-spinner"></div>
          ` : ''}
          ${this.getFieldError('line1') ? html`
            <div class="sr-field-error-message">${this.getFieldError('line1')}</div>
          ` : ''}
        </div>

        ${this.autocompleteOpen ? html`
          <ul
            id="${listboxId}"
            class="sr-autocomplete-dropdown"
            role="listbox"
          >
            ${this.predictions.map((p, i) => html`
              <li
                id="sr-ac-item-${i}"
                class="sr-autocomplete-item ${i === this.highlightedIndex ? 'sr-highlighted' : ''}"
                role="option"
                aria-selected="${i === this.highlightedIndex}"
                @mousedown="${(e: Event) => { e.preventDefault(); this.selectPrediction(p); }}"
                @mouseenter="${() => { this.highlightedIndex = i; }}"
              >
                <span class="sr-autocomplete-main">${p.mainText}</span>
                <span class="sr-autocomplete-secondary">${p.secondaryText}</span>
              </li>
            `)}
          </ul>
        ` : ''}
      </div>

      <!-- Address Line 2 -->
      ${this.getEffectiveVisibility('line2') !== 'hidden' ? html`
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
            Apartment, Suite, etc.${this.getEffectiveVisibility('line2') === 'required' ? html` <span class="sr-field-required">*</span>` : ' (optional)'}
          </label>
        </div>
      ` : ''}
    `;
  }

  private renderLocationFields(): TemplateResult {
    // Show state field if country requires it
    const showStateField = this.currentCountryRequiresState;

    return html`
      <!-- City and State/Region Row -->
      <div class="grid ${showStateField ? 'grid-cols-2' : 'grid-cols-1'} gap-3">
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

        <!-- State/Region (only show if country requires it) -->
        ${showStateField ? html`
          <div class="sr-field-group">
            ${this.renderStateSelectField()}
          </div>
        ` : ''}
      </div>

      <!-- Postal Code and Country Row -->
      <div class="grid grid-cols-2 gap-3">
        <!-- Postal Code -->
        <div class="sr-field-group">
          <input
            type="text"
            id="postalCode"
            class="sr-field-input peer ${this.hasValue(this.address.postalCode) ? 'has-value' : ''} ${this.getFieldError('postalCode') ? 'sr-field-error' : ''}"
            .value="${this.address.postalCode || ''}"
            .disabled="${this.disabled}"
            placeholder=" "
            autocomplete="postal-code"
            @input="${(e: Event) => this.handleInputChange('postalCode', (e.target as HTMLInputElement).value)}"
            @blur="${() => this.handleBlur('postalCode')}"
          >
          <label class="sr-field-label" for="postalCode">
            Postal Code${this.isRequired('postalCode') ? html` <span class="sr-field-required">*</span>` : ''}
          </label>
          ${this.getFieldError('postalCode') ? html`
            <div class="sr-field-error-message">${this.getFieldError('postalCode')}</div>
          ` : ''}
        </div>

        <!-- Country -->
        <div class="sr-field-group">
          ${this.renderCountryField()}
          ${this.getFieldError('country') ? html`
            <div class="sr-field-error-message">${this.getFieldError('country')}</div>
          ` : ''}
        </div>
      </div>
    `;
  }

  private renderCountryField(): TemplateResult {
    // If we have a country code but countries aren't loaded yet, just show the code
    const showPlaceholder = this.countries.length === 0 && this.address.country;

    return html`
      <select
        id="country"
        class="sr-field-select peer ${this.address.country ? 'has-value' : ''} ${this.getFieldError('country') ? 'sr-field-error' : ''}"
        .value="${this.address.country || ''}"
        .disabled="${this.disabled}"
        ?required="${this.isRequired('country')}"
        autocomplete="country"
        @change="${(e: Event) => {
          const select = e.target as HTMLSelectElement;
          // Detect autofill by checking if multiple fields changed at once
          const isAutofill = e.isTrusted && this.detectAutofill();
          this.handleInputChange('country', select.value, isAutofill);
        }}"
        @blur="${() => this.handleBlur('country')}"
      >
        <option value=""></option>
        ${showPlaceholder ? html`
          <option value="${this.address.country}" selected disabled>
            ${this.address.country}
          </option>
        ` : ''}
        ${this.countries.map(country => html`
          <option value="${country.code}" ?selected="${country.code === this.address.country}">
            ${country.name}
          </option>
        `)}
      </select>
      <label class="sr-field-label" for="country">
        Country${this.isRequired('country') ? html` <span class="sr-field-required">*</span>` : ''}
      </label>
    `;
  }

  private renderStateSelectField(): TemplateResult {
    // Show current state code as placeholder while loading
    const showPlaceholder = this.address.state &&
                           !this.states.some(s => s.code === this.address.state);

    // Only disable if no country selected (not when loading - this allows autofill)
    const isDisabled = this.disabled || !this.address.country;

    return html`
      <select
        id="state"
        class="sr-field-select peer ${this.address.state ? 'has-value' : ''} ${this.getFieldError('state') ? 'sr-field-error' : ''}"
        .value="${this.address.state || ''}"
        .disabled="${isDisabled}"
        autocomplete="address-level1"
        @change="${(e: Event) => this.handleInputChange('state', (e.target as HTMLSelectElement).value)}"
        @blur="${() => this.handleBlur('state')}"
      >
        <option value=""></option>
        ${showPlaceholder ? html`
          <option value="${this.address.state}" selected>
            ${this.address.state}
          </option>
        ` : ''}
        ${this.states.map(state => html`
          <option
            value="${state.code}"
            ?selected="${state.code === this.address.state}"
            data-name="${state.name}"
          >
            ${state.name}
          </option>
        `)}
      </select>
      <label class="sr-field-label" for="state">
        State/Province${this.isRequired('state') ? html` <span class="sr-field-required">*</span>` : ''}
      </label>
      ${this.getFieldError('state') ? html`
        <div class="sr-field-error-message">${this.getFieldError('state')}</div>
      ` : ''}
    `;
  }


  private renderPhoneField(): TemplateResult {
    const vis = this.getEffectiveVisibility('phone');
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
          Phone Number${vis === 'required' ? html` <span class="sr-field-required">*</span>` : vis === 'optional' ? ' (optional)' : ''}
        </label>
        ${this.getFieldError('phone') ? html`
          <div class="sr-field-error-message">${this.getFieldError('phone')}</div>
        ` : ''}
      </div>
    `;
  }

  private renderSameAsBillingField(): TemplateResult {
    return html`
      <shoprocket-toggle
        id="same-as-billing-${this.id || 'default'}"
        name="same_as_billing"
        label="${t('checkout.same_address_billing', 'Use same address for billing')}"
        .checked="${this.sameAsBilling}"
        @change="${(e: CustomEvent) => {
          this.dispatchEvent(new CustomEvent('same-as-billing-change', {
            detail: { checked: e.detail.checked },
            bubbles: true,
            composed: true
          }));
        }}"
      ></shoprocket-toggle>
    `;
  }
}

// Register the custom element
if (!customElements.get('shoprocket-address-form')) {
  customElements.define('shoprocket-address-form', AddressForm);
}
