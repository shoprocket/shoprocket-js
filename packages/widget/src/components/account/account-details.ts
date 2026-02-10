import { html, type TemplateResult } from 'lit';
import { t } from '../../utils/i18n';
import type { AccountDetailsContext } from './account-types';

export function renderAccountDetails(ctx: AccountDetailsContext): TemplateResult {
  return html`
    <div class="sr-account-details">
      ${renderProfileSection(ctx)}
      ${ctx.profile.hasPassword ? renderChangePasswordSection(ctx) : ''}
      ${renderLogoutSection(ctx)}
    </div>
  `;
}

function renderProfileSection(ctx: AccountDetailsContext): TemplateResult {
  let firstName = ctx.profile.firstName || '';
  let lastName = ctx.profile.lastName || '';
  let phone = ctx.profile.phone || '';

  return html`
    <div class="sr-account-section">
      <h4 class="sr-account-section-title">${t('account.personal_info', 'Personal Information')}</h4>
      <form @submit=${(e: Event) => {
        e.preventDefault();
        ctx.onUpdateProfile({ firstName, lastName, phone });
      }} class="sr-account-form">
        <div class="sr-account-detail-row">
          <span class="sr-account-detail-label">${t('account.email', 'Email')}</span>
          <span class="sr-account-detail-value">${ctx.profile.email}</span>
        </div>
        <div class="sr-account-form-row">
          <div class="sr-account-form-group">
            <label class="sr-account-label" for="sr-account-first-name">${t('account.first_name', 'First Name')}</label>
            <input
              id="sr-account-first-name"
              type="text"
              class="sr-account-input"
              .value=${firstName}
              @input=${(e: Event) => { firstName = (e.target as HTMLInputElement).value; }}
              autocomplete="given-name"
            />
          </div>
          <div class="sr-account-form-group">
            <label class="sr-account-label" for="sr-account-last-name">${t('account.last_name', 'Last Name')}</label>
            <input
              id="sr-account-last-name"
              type="text"
              class="sr-account-input"
              .value=${lastName}
              @input=${(e: Event) => { lastName = (e.target as HTMLInputElement).value; }}
              autocomplete="family-name"
            />
          </div>
        </div>
        <div class="sr-account-form-group">
          <label class="sr-account-label" for="sr-account-phone">${t('account.phone', 'Phone')}</label>
          <input
            id="sr-account-phone"
            type="tel"
            class="sr-account-input"
            .value=${phone}
            @input=${(e: Event) => { phone = (e.target as HTMLInputElement).value; }}
            autocomplete="tel"
          />
        </div>
        ${ctx.profileError ? html`<p class="sr-account-error">${ctx.profileError}</p>` : ''}
        ${ctx.profileSuccess ? html`<p class="sr-account-success">${ctx.profileSuccess}</p>` : ''}
        <button type="submit" class="sr-account-button-primary" ?disabled=${ctx.saving}>
          ${ctx.saving ? t('account.saving', 'Saving...') : t('account.save', 'Save Changes')}
        </button>
      </form>
    </div>
  `;
}

function renderChangePasswordSection(ctx: AccountDetailsContext): TemplateResult {
  let currentPassword = '';
  let newPassword = '';

  return html`
    <div class="sr-account-section">
      <h4 class="sr-account-section-title">${t('account.change_password', 'Change Password')}</h4>
      <form @submit=${(e: Event) => {
        e.preventDefault();
        ctx.onChangePassword(currentPassword, newPassword);
      }} class="sr-account-form">
        <div class="sr-account-form-group">
          <label class="sr-account-label" for="sr-account-current-pw">${t('account.current_password', 'Current Password')}</label>
          <input
            id="sr-account-current-pw"
            type="password"
            class="sr-account-input"
            @input=${(e: Event) => { currentPassword = (e.target as HTMLInputElement).value; }}
            required
            autocomplete="current-password"
          />
        </div>
        <div class="sr-account-form-group">
          <label class="sr-account-label" for="sr-account-new-pw">${t('account.new_password', 'New Password')}</label>
          <input
            id="sr-account-new-pw"
            type="password"
            class="sr-account-input"
            @input=${(e: Event) => { newPassword = (e.target as HTMLInputElement).value; }}
            required
            minlength="8"
            autocomplete="new-password"
          />
        </div>
        ${ctx.passwordError ? html`<p class="sr-account-error">${ctx.passwordError}</p>` : ''}
        ${ctx.passwordSuccess ? html`<p class="sr-account-success">${ctx.passwordSuccess}</p>` : ''}
        <button type="submit" class="sr-account-button-secondary" ?disabled=${ctx.changingPassword}>
          ${ctx.changingPassword ? t('account.updating', 'Updating...') : t('account.update_password', 'Update Password')}
        </button>
      </form>
    </div>
  `;
}

function renderLogoutSection(ctx: AccountDetailsContext): TemplateResult {
  return html`
    <div class="sr-account-section sr-account-logout-section">
      <button class="sr-account-button-danger" @click=${ctx.onLogout}>
        ${t('account.sign_out', 'Sign Out')}
      </button>
    </div>
  `;
}
