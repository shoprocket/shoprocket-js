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

  private emailCheckTimer?: number;
  private lastCheckedEmail = '';

  private handleInputChange(field: keyof CustomerData, value: string): void {
    const updatedCustomer = {
      ...this.customer,
      [field]: value  // Keep empty strings to allow clearing fields
    };

    // Dispatch change event
    this.dispatchEvent(new CustomEvent('customer-change', {
      detail: { customer: updatedCustomer, field },
      bubbles: true,
      composed: true
    }));

    // Smart email checking while typing
    if (field === 'email' && value !== this.lastCheckedEmail) {
      // Clear existing timer
      if (this.emailCheckTimer) {
        clearTimeout(this.emailCheckTimer);
      }

      // Only check if email looks valid
      if (value.includes('@') && value.includes('.')) {
        this.emailCheckTimer = window.setTimeout(() => {
          this.lastCheckedEmail = value;
          this.dispatchEvent(new CustomEvent('customer-check', {
            detail: { email: value },
            bubbles: true,
            composed: true
          }));
        }, 100); // Check 100ms after typing stops
      }
    }
  }

  private handleBlur(field: keyof CustomerData): void {
    // If email field, trigger customer check (only if not already checked)
    if (field === 'email' && this.customer.email && this.hasValue(this.customer.email)) {
      if (this.customer.email !== this.lastCheckedEmail) {
        this.lastCheckedEmail = this.customer.email;
        this.dispatchEvent(new CustomEvent('customer-check', {
          detail: { email: this.customer.email },
          bubbles: true,
          composed: true
        }));
      }
    }
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

  private isFieldValid(field: keyof CustomerData): boolean {
    // Field is valid if it has a value, no errors, and passes basic validation
    const value = this.customer[field];
    if (!this.hasValue(value)) return false;
    if (this.getFieldError(field)) return false;

    // Additional validation checks
    if (field === 'email') {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value as string);
    }
    if (field === 'first_name' || field === 'last_name') {
      return (value as string).length >= 2;
    }
    if (field === 'phone' && value) {
      return (value as string).length >= 7;
    }

    return true;
  }

  private renderEmailIcon(): TemplateResult {
    return html`
      <svg class="sr-field-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
      </svg>
    `;
  }

  private renderUserIcon(): TemplateResult {
    return html`
      <svg class="sr-field-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
      </svg>
    `;
  }

  private renderPhoneIcon(): TemplateResult {
    return html`
      <svg class="sr-field-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
      </svg>
    `;
  }

  private renderCheckIcon(): TemplateResult {
    return html`
      <svg class="sr-field-success-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
      </svg>
    `;
  }

  protected override render(): TemplateResult {
    return html`
      <form class="sr-customer-form space-y-3" @submit="${(e: Event) => e.preventDefault()}">
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
          <div class="sr-field-group-with-icon ${this.isFieldValid('email') ? 'sr-field-valid' : ''}">
            <input
              type="email"
              id="email"
              name="email"
              class="sr-field-input sr-field-input-with-icon peer ${this.hasValue(this.customer.email) ? 'has-value' : ''} ${this.getFieldError('email') ? 'sr-field-error' : ''}"
              .value="${this.customer.email || ''}"
              .disabled="${this.disabled}"
              ?required="${this.getRequiredAttribute('email')}"
              placeholder=" "
              autocomplete="email"
              @input="${(e: Event) => this.handleInputChange('email', (e.target as HTMLInputElement).value)}"
              @blur="${() => this.handleBlur('email')}"
            >
            ${this.renderEmailIcon()}
            <label class="sr-field-label" for="email">
              Email Address
              ${this.getRequiredAttribute('email') ? html`<span class="sr-field-required">*</span>` : ''}
            </label>
            ${this.renderCheckIcon()}
            ${this.getFieldError('email') ? html`
              <div class="sr-field-error-message">${this.getFieldError('email')}</div>
            ` : ''}
          </div>

          ${this.showNameFields ? html`
            <!-- Name Fields Row -->
            <div class="grid grid-cols-2 gap-3">
              <!-- First Name -->
              <div class="sr-field-group-with-icon ${this.isFieldValid('first_name') ? 'sr-field-valid' : ''}">
                <input
                  type="text"
                  id="first_name"
                  name="first_name"
                  class="sr-field-input sr-field-input-with-icon peer ${this.hasValue(this.customer.first_name) ? 'has-value' : ''} ${this.getFieldError('first_name') ? 'sr-field-error' : ''}"
                  .value="${this.customer.first_name || ''}"
                  .disabled="${this.disabled}"
                  ?required="${this.getRequiredAttribute('first_name')}"
                  placeholder=" "
                  autocomplete="given-name"
                  @input="${(e: Event) => this.handleInputChange('first_name', (e.target as HTMLInputElement).value)}"
                  @blur="${() => this.handleBlur('first_name')}"
                >
                ${this.renderUserIcon()}
                <label class="sr-field-label" for="first_name">
                  First Name
                  ${this.getRequiredAttribute('first_name') ? html`<span class="sr-field-required">*</span>` : ''}
                </label>
                ${this.renderCheckIcon()}
                ${this.getFieldError('first_name') ? html`
                  <div class="sr-field-error-message">${this.getFieldError('first_name')}</div>
                ` : ''}
              </div>

              <!-- Last Name -->
              <div class="sr-field-group-with-icon ${this.isFieldValid('last_name') ? 'sr-field-valid' : ''}">
                <input
                  type="text"
                  id="last_name"
                  name="last_name"
                  class="sr-field-input sr-field-input-with-icon peer ${this.hasValue(this.customer.last_name) ? 'has-value' : ''} ${this.getFieldError('last_name') ? 'sr-field-error' : ''}"
                  .value="${this.customer.last_name || ''}"
                  .disabled="${this.disabled}"
                  ?required="${this.getRequiredAttribute('last_name')}"
                  placeholder=" "
                  autocomplete="family-name"
                  @input="${(e: Event) => this.handleInputChange('last_name', (e.target as HTMLInputElement).value)}"
                >
                ${this.renderUserIcon()}
                <label class="sr-field-label" for="last_name">
                  Last Name
                  ${this.getRequiredAttribute('last_name') ? html`<span class="sr-field-required">*</span>` : ''}
                </label>
                ${this.renderCheckIcon()}
                ${this.getFieldError('last_name') ? html`
                  <div class="sr-field-error-message">${this.getFieldError('last_name')}</div>
                ` : ''}
              </div>
            </div>
          ` : ''}

          <!-- Phone Field -->
          <div class="sr-field-group-with-icon ${this.isFieldValid('phone') ? 'sr-field-valid' : ''}">
            <input
              type="tel"
              id="phone"
              class="sr-field-input sr-field-input-with-icon peer ${this.hasValue(this.customer.phone) ? 'has-value' : ''} ${this.getFieldError('phone') ? 'sr-field-error' : ''}"
              .value="${this.customer.phone || ''}"
              .disabled="${this.disabled}"
              placeholder=" "
              autocomplete="tel"
              @input="${(e: Event) => this.handleInputChange('phone', (e.target as HTMLInputElement).value)}"
              @blur="${() => this.handleBlur('phone')}"
            >
            ${this.renderPhoneIcon()}
            <label class="sr-field-label" for="phone">Phone Number (optional)</label>
            ${this.renderCheckIcon()}
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
      </form>
    `;
  }
}

// Register the custom element
if (!customElements.get('shoprocket-customer-form')) {
  customElements.define('shoprocket-customer-form', CustomerForm);
}