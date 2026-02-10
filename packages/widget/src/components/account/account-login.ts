import { html, type TemplateResult } from 'lit';
import { t } from '../../utils/i18n';
import type { AccountLoginContext } from './account-types';

export function renderAccountLogin(ctx: AccountLoginContext): TemplateResult {
  if (ctx.loginMode === 'reset-password') {
    return renderResetPasswordForm(ctx);
  }
  if (ctx.loginMode === 'otp') {
    return renderOtpForm(ctx);
  }
  if (ctx.loginMode === 'password') {
    return renderPasswordForm(ctx);
  }
  return renderEmailForm(ctx);
}

function renderEmailForm(ctx: AccountLoginContext): TemplateResult {
  return html`
    <div class="sr-account-login">
      <div class="sr-account-login-header">
        <h2 class="sr-account-login-title">${t('account.sign_in', 'Sign in to your account')}</h2>
        <p class="sr-account-login-subtitle">${t('account.sign_in_desc', 'Enter your email to view orders and manage your account.')}</p>
      </div>
      <form @submit=${(e: Event) => { e.preventDefault(); ctx.onCheckEmail(); }} class="sr-account-form">
        <div class="sr-account-form-group">
          <label class="sr-account-label" for="sr-account-email">${t('account.email', 'Email')}</label>
          <input
            id="sr-account-email"
            type="email"
            class="sr-account-input"
            .value=${ctx.loginEmail}
            @input=${(e: Event) => ctx.onEmailChange((e.target as HTMLInputElement).value)}
            placeholder=${t('account.email_placeholder', 'your@email.com')}
            required
            autocomplete="email"
          />
        </div>
        ${ctx.authError ? html`<p class="sr-account-error">${ctx.authError}</p>` : ''}
        <button type="submit" class="sr-account-button-primary" ?disabled=${ctx.authLoading}>
          ${ctx.authLoading ? t('account.checking', 'Checking...') : t('account.continue', 'Continue')}
        </button>
      </form>
    </div>
  `;
}

function renderPasswordForm(ctx: AccountLoginContext): TemplateResult {
  let password = '';
  return html`
    <div class="sr-account-login">
      <div class="sr-account-login-header">
        <h2 class="sr-account-login-title">${t('account.welcome_back', 'Welcome back')}</h2>
        <p class="sr-account-login-subtitle">${ctx.loginEmail}</p>
      </div>
      <form @submit=${(e: Event) => { e.preventDefault(); ctx.onPasswordLogin(password); }} class="sr-account-form">
        <div class="sr-account-form-group">
          <label class="sr-account-label" for="sr-account-password">${t('account.password', 'Password')}</label>
          <input
            id="sr-account-password"
            type="password"
            class="sr-account-input"
            @input=${(e: Event) => { password = (e.target as HTMLInputElement).value; }}
            placeholder=${t('account.password_placeholder', 'Enter your password')}
            required
            autocomplete="current-password"
          />
        </div>
        ${ctx.authError ? html`<p class="sr-account-error">${ctx.authError}</p>` : ''}
        <button type="submit" class="sr-account-button-primary" ?disabled=${ctx.authLoading}>
          ${ctx.authLoading ? t('account.signing_in', 'Signing in...') : t('account.sign_in_button', 'Sign In')}
        </button>
        <div class="sr-account-login-links">
          <button type="button" class="sr-account-link" @click=${ctx.onForgotPassword}>
            ${t('account.forgot_password', 'Forgot password?')}
          </button>
          <button type="button" class="sr-account-link" @click=${ctx.onSendOtp}>
            ${t('account.use_code', 'Sign in with a code instead')}
          </button>
          <button type="button" class="sr-account-link" @click=${ctx.onBack}>
            ${t('account.use_different_email', 'Use a different email')}
          </button>
        </div>
      </form>
    </div>
  `;
}

function renderOtpForm(ctx: AccountLoginContext): TemplateResult {
  return html`
    <div class="sr-account-login">
      <div class="sr-account-login-header">
        <h2 class="sr-account-login-title">${t('account.enter_code', 'Enter verification code')}</h2>
        <p class="sr-account-login-subtitle">${t('account.code_sent', 'We sent a 6-digit code to')} ${ctx.loginEmail}</p>
      </div>
      <div class="sr-account-form">
        <div class="sr-account-otp-container">
          ${[0, 1, 2, 3, 4, 5].map(i => html`
            <input
              type="text"
              inputmode="numeric"
              maxlength="1"
              class="sr-account-otp-input"
              data-otp-index="${i}"
              .value=${ctx.otpCode[i] || ''}
              @input=${(e: Event) => ctx.onOtpInput(e, i)}
              @keydown=${(e: KeyboardEvent) => ctx.onOtpKeydown(e, i)}
              @paste=${(e: ClipboardEvent) => ctx.onOtpPaste(e)}
              autocomplete="one-time-code"
            />
          `)}
        </div>
        ${ctx.authError ? html`<p class="sr-account-error">${ctx.authError}</p>` : ''}
        <div class="sr-account-login-links">
          <button type="button" class="sr-account-link" @click=${ctx.onSendOtp} ?disabled=${ctx.authLoading}>
            ${t('account.resend_code', 'Resend code')}
          </button>
          <button type="button" class="sr-account-link" @click=${ctx.onBack}>
            ${t('account.use_different_email', 'Use a different email')}
          </button>
        </div>
      </div>
    </div>
  `;
}

function renderResetPasswordForm(ctx: AccountLoginContext): TemplateResult {
  let newPassword = '';
  let confirmPassword = '';
  const validateMatch = (confirmInput: HTMLInputElement) => {
    confirmInput.setCustomValidity(
      confirmPassword !== newPassword ? t('account.passwords_no_match', 'Passwords do not match') : ''
    );
  };
  return html`
    <div class="sr-account-login">
      <div class="sr-account-login-header">
        <h2 class="sr-account-login-title">${t('account.set_new_password', 'Set new password')}</h2>
        <p class="sr-account-login-subtitle">${t('account.set_new_password_desc', 'Choose a new password for your account.')}</p>
      </div>
      <form @submit=${(e: Event) => { e.preventDefault(); ctx.onResetPassword(newPassword); }} class="sr-account-form">
        <div class="sr-account-form-group">
          <label class="sr-account-label" for="sr-account-new-password">${t('account.new_password', 'New password')}</label>
          <input
            id="sr-account-new-password"
            type="password"
            class="sr-account-input"
            @input=${(e: Event) => { newPassword = (e.target as HTMLInputElement).value; }}
            placeholder=${t('account.new_password_placeholder', 'Enter new password')}
            required
            minlength="8"
            autocomplete="new-password"
          />
        </div>
        <div class="sr-account-form-group">
          <label class="sr-account-label" for="sr-account-confirm-password">${t('account.confirm_password', 'Confirm password')}</label>
          <input
            id="sr-account-confirm-password"
            type="password"
            class="sr-account-input"
            @input=${(e: Event) => { confirmPassword = (e.target as HTMLInputElement).value; validateMatch(e.target as HTMLInputElement); }}
            placeholder=${t('account.confirm_password_placeholder', 'Confirm new password')}
            required
            minlength="8"
            autocomplete="new-password"
          />
        </div>
        ${ctx.authError ? html`<p class="sr-account-error">${ctx.authError}</p>` : ''}
        <button type="submit" class="sr-account-button-primary" ?disabled=${ctx.authLoading}>
          ${ctx.authLoading ? t('account.saving', 'Saving...') : t('account.reset_password_button', 'Reset Password')}
        </button>
        <div class="sr-account-login-links">
          <button type="button" class="sr-account-link" @click=${ctx.onBack}>
            ${t('account.cancel', 'Cancel')}
          </button>
        </div>
      </form>
    </div>
  `;
}
