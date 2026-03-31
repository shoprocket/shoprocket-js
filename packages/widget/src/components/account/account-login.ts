import { html, type TemplateResult } from 'lit';
import { t } from '../../utils/i18n';
import type { AccountLoginContext } from './account-types';

export function renderAccountLogin(ctx: AccountLoginContext): TemplateResult {
  if (ctx.loginMode === 'otp') {
    return renderOtpForm(ctx);
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

