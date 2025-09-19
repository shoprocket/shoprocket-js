import { html, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { BaseComponent } from '../core/base-component';

export interface CustomerData {
  email: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  company?: string;
}

export interface CustomerFormErrors {
  email?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  company?: string;
}

/**
 * Customer Form Component - Customer information collection form
 * 
 * @element shoprocket-customer-form
 * @fires customer-change - When customer data changes
 * @fires customer-validate - When form validation is triggered
 * 
 * @example
 * <!-- Basic customer form -->
 * <shoprocket-customer-form
 *   @customer-change="${this.handleCustomerChange}"
 *   .customer="${this.customerData}">
 * </shoprocket-customer-form>
 * 
 * @example
 * <!-- With validation and guest checkout -->
 * <shoprocket-customer-form
 *   .required="${true}"
 *   .errors="${this.validationErrors}"
 *   .show-guest-option="${true}"
 *   @customer-change="${this.handleCustomerChange}">
 * </shoprocket-customer-form>
 */
export class CustomerForm extends BaseComponent {
  // Use Light DOM to avoid nested shadow DOMs
  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  @property({ type: String })
  override title = 'Contact Information';

  @property({ type: Object })
  customer: Partial<CustomerData> = {};

  @property({ type: Object })
  errors: CustomerFormErrors = {};

  @property({ type: Boolean })
  required = true;

  @property({ type: Boolean })
  disabled = false;

  @property({ type: Boolean, attribute: 'show-company' })
  showCompany = false;

  @property({ type: Boolean, attribute: 'show-guest-option' })
  showGuestOption = false;

  @property({ type: Boolean, attribute: 'is-guest' })
  isGuest = true;

  @state()
  private showNameFields = true;

  private handleInputChange(field: keyof CustomerData, value: string): void {
    const updatedCustomer = {
      ...this.customer,
      [field]: value || undefined
    };

    // Dispatch change event
    this.dispatchEvent(new CustomEvent('customer-change', {
      detail: { customer: updatedCustomer, field },
      bubbles: true,
      composed: true
    }));
  }

  private handleBlur(field: keyof CustomerData): void {
    // Trigger validation on field blur
    this.dispatchEvent(new CustomEvent('customer-validate', {
      detail: { field, customer: this.customer },
      bubbles: true,
      composed: true
    }));
  }

  private handleGuestToggle(): void {
    this.isGuest = !this.isGuest;
    this.showNameFields = this.isGuest;
    
    // Clear name fields if switching to account creation
    if (!this.isGuest) {
      this.handleInputChange('first_name', '');
      this.handleInputChange('last_name', '');
    }

    // Dispatch guest mode change
    this.dispatchEvent(new CustomEvent('guest-toggle', {
      detail: { isGuest: this.isGuest },
      bubbles: true,
      composed: true
    }));
  }

  private getFieldError(field: keyof CustomerFormErrors): string | undefined {
    return this.errors[field];
  }

  private getRequiredAttribute(field: keyof CustomerData): boolean {
    if (!this.required) return false;
    
    // Email is always required
    if (field === 'email') return true;
    
    // Name fields required for guest checkout
    if ((field === 'first_name' || field === 'last_name') && this.isGuest) return true;
    
    return false;
  }

  private hasValue(value: any): boolean {
    return value !== undefined && value !== null && value !== '';
  }

  protected override render(): TemplateResult {
    return html`
      <div class="sr-customer-form space-y-3">
        ${this.showGuestOption ? html`
          <!-- Guest/Account Toggle -->
          <div class="sr-guest-toggle">
            <div class="sr-guest-options">
              <label class="sr-guest-option ${this.isGuest ? 'sr-guest-active' : ''}">
                <input
                  type="radio"
                  name="checkout-type"
                  .checked="${this.isGuest}"
                  @change="${() => { this.isGuest = true; this.handleGuestToggle(); }}"
                >
                <span class="sr-guest-option-text">Guest Checkout</span>
              </label>
              
              <label class="sr-guest-option ${!this.isGuest ? 'sr-guest-active' : ''}">
                <input
                  type="radio"
                  name="checkout-type"
                  .checked="${!this.isGuest}"
                  @change="${() => { this.isGuest = false; this.handleGuestToggle(); }}"
                >
                <span class="sr-guest-option-text">Create Account</span>
              </label>
            </div>
          </div>
        ` : ''}
        
        <div class="sr-customer-form-fields space-y-3">
          <!-- Email Field -->
          <div class="sr-field-group">
            <input
              type="email"
              id="email"
              class="sr-field-input peer ${this.hasValue(this.customer.email) ? 'has-value' : ''} ${this.getFieldError('email') ? 'sr-field-error' : ''}"
              .value="${this.customer.email || ''}"
              .disabled="${this.disabled}"
              ?required="${this.getRequiredAttribute('email')}"
              placeholder=" "
              autocomplete="email"
              @input="${(e: Event) => this.handleInputChange('email', (e.target as HTMLInputElement).value)}"
              @blur="${() => this.handleBlur('email')}"
            >
            <label class="sr-field-label" for="email">
              Email Address
              ${this.getRequiredAttribute('email') ? html`<span class="sr-field-required">*</span>` : ''}
            </label>
            ${this.getFieldError('email') ? html`
              <div class="sr-field-error-message">${this.getFieldError('email')}</div>
            ` : ''}
          </div>

          ${this.showNameFields ? html`
            <!-- Name Fields Row -->
            <div class="grid grid-cols-2 gap-3">
              <!-- First Name -->
              <div class="sr-field-group">
                <input
                  type="text"
                  id="first_name"
                  class="sr-field-input peer ${this.hasValue(this.customer.first_name) ? 'has-value' : ''} ${this.getFieldError('first_name') ? 'sr-field-error' : ''}"
                  .value="${this.customer.first_name || ''}"
                  .disabled="${this.disabled}"
                  ?required="${this.getRequiredAttribute('first_name')}"
                  placeholder=" "
                  autocomplete="given-name"
                  @input="${(e: Event) => this.handleInputChange('first_name', (e.target as HTMLInputElement).value)}"
                  @blur="${() => this.handleBlur('first_name')}"
                >
                <label class="sr-field-label" for="first_name">
                  First Name
                  ${this.getRequiredAttribute('first_name') ? html`<span class="sr-field-required">*</span>` : ''}
                </label>
                ${this.getFieldError('first_name') ? html`
                  <div class="sr-field-error-message">${this.getFieldError('first_name')}</div>
                ` : ''}
              </div>

              <!-- Last Name -->
              <div class="sr-field-group">
                <input
                  type="text"
                  id="last_name"
                  class="sr-field-input peer ${this.hasValue(this.customer.last_name) ? 'has-value' : ''} ${this.getFieldError('last_name') ? 'sr-field-error' : ''}"
                  .value="${this.customer.last_name || ''}"
                  .disabled="${this.disabled}"
                  ?required="${this.getRequiredAttribute('last_name')}"
                  placeholder=" "
                  autocomplete="family-name"
                  @input="${(e: Event) => this.handleInputChange('last_name', (e.target as HTMLInputElement).value)}"
                  @blur="${() => this.handleBlur('last_name')}"
                >
                <label class="sr-field-label" for="last_name">
                  Last Name
                  ${this.getRequiredAttribute('last_name') ? html`<span class="sr-field-required">*</span>` : ''}
                </label>
                ${this.getFieldError('last_name') ? html`
                  <div class="sr-field-error-message">${this.getFieldError('last_name')}</div>
                ` : ''}
              </div>
            </div>
          ` : ''}

          <!-- Phone Field -->
          <div class="sr-field-group">
            <input
              type="tel"
              id="phone"
              class="sr-field-input peer ${this.hasValue(this.customer.phone) ? 'has-value' : ''} ${this.getFieldError('phone') ? 'sr-field-error' : ''}"
              .value="${this.customer.phone || ''}"
              .disabled="${this.disabled}"
              placeholder=" "
              autocomplete="tel"
              @input="${(e: Event) => this.handleInputChange('phone', (e.target as HTMLInputElement).value)}"
              @blur="${() => this.handleBlur('phone')}"
            >
            <label class="sr-field-label" for="phone">Phone Number (optional)</label>
            ${this.getFieldError('phone') ? html`
              <div class="sr-field-error-message">${this.getFieldError('phone')}</div>
            ` : ''}
          </div>

          ${this.showCompany ? html`
            <!-- Company Field -->
            <div class="sr-field-group">
              <input
                type="text"
                id="company"
                class="sr-field-input peer ${this.hasValue(this.customer.company) ? 'has-value' : ''}"
                .value="${this.customer.company || ''}"
                .disabled="${this.disabled}"
                placeholder=" "
                autocomplete="organization"
                @input="${(e: Event) => this.handleInputChange('company', (e.target as HTMLInputElement).value)}"
              >
              <label class="sr-field-label" for="company">Company (optional)</label>
            </div>
          ` : ''}

          ${!this.isGuest ? html`
            <!-- Account Creation Notice -->
            <div class="sr-account-notice">
              <svg class="sr-account-notice-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              <div class="sr-account-notice-text">
                <strong>Creating an account?</strong>
                <p>You'll receive a password setup email after your order is complete.</p>
              </div>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }
}

// Register the custom element
if (!customElements.get('shoprocket-customer-form')) {
  customElements.define('shoprocket-customer-form', CustomerForm);
}