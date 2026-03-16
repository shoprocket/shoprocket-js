/**
 * Shoprocket Chat Widget
 *
 * Copyright (c) 2025 Shoprocket Ltd.
 *
 * This source code is proprietary and confidential.
 * Unauthorized copying or distribution is strictly prohibited.
 *
 * @license Proprietary
 */

import { html, css, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { ShoprocketElement } from '../core/base-component';
import type { ApiChatMessage } from '@shoprocket/core';

// Internal message type — mapped from API
interface ChatMessage {
  id: string;
  from: 'customer' | 'seller';
  content: string;           // display content (pre-translated for seller)
  isTranslated: boolean;
  originalContent: string;
  senderName: string | null;
  senderAvatarUrl: string | null;
  isRead: boolean;
  timestamp: Date;
  status: 'sent' | 'sending' | 'failed';
}

function mapMessage(msg: ApiChatMessage): ChatMessage {
  const isSeller = msg.sender_type === 'seller';
  const displayContent = isSeller
    ? (msg.translation?.content ?? msg.original.content)
    : msg.original.content;
  const isTranslated = isSeller
    ? !!msg.translation && msg.translation.content !== msg.original.content
    : false;
  return {
    id: msg.id,
    from: msg.sender_type,
    content: displayContent,
    isTranslated,
    originalContent: msg.original.content,
    senderName: msg.sender?.name ?? null,
    senderAvatarUrl: msg.sender?.avatar_url ?? null,
    isRead: msg.is_read,
    timestamp: new Date(msg.created_at),
    status: 'sent',
  };
}

const chatStyles = css`
  :host {
    --chat-size: 56px;
    --chat-size-sm: 44px;
    --chat-panel-width: 400px;
    --chat-panel-height: 700px;
  }

  /* ── Overlay ── */
  .sr-chat-overlay {
    position: fixed;
    inset: 0;
    z-index: 10002;
    background: var(--overlay);
    transition: opacity 0.2s ease;
  }

  .sr-chat-overlay.open {
    opacity: 1;
    pointer-events: auto;
  }

  .sr-chat-overlay.closed {
    opacity: 0;
    pointer-events: none;
  }

  /* ── Launcher ── */
  .sr-chat-launcher {
    position: fixed;
    z-index: 10003;
    bottom: 20px;
    left: 20px;
  }

  .sr-chat-launcher.bottom-right {
    left: auto;
    right: 20px;
  }

  .sr-chat-open-btn {
    width: var(--chat-size);
    height: var(--chat-size);
    border-radius: var(--radius);
    background: var(--primary);
    color: var(--primary-foreground, #fff);
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 16px color-mix(in srgb, var(--primary) 40%, transparent);
    transition: transform 0.2s ease, box-shadow 0.2s ease;
    position: relative;
  }

  .sr-chat-open-btn:hover {
    transform: scale(1.06);
    box-shadow: 0 6px 20px color-mix(in srgb, var(--primary) 50%, transparent);
  }

  .sr-chat-badge {
    position: absolute;
    top: -2px;
    right: -2px;
    min-width: 20px;
    height: 20px;
    padding: 0 4px;
    border-radius: 999px;
    background: var(--destructive, #ef4444);
    color: #fff;
    font-size: 11px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 2px solid var(--background);
    line-height: 1;
  }

  /* ── Panel — shared ── */
  .sr-chat-panel {
    position: fixed;
    z-index: 10004;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: var(--card);
    transition: transform 0.3s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.2s ease;
  }

  /* ── Panel — bubble style ── */
  /* Mobile-first: fullscreen */
  .sr-chat-panel-bubble {
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    width: 100%;
    max-height: 100%;
    border-radius: 0;
  }

  /* Desktop bubble: covers launcher, scales from corner */
  @media (min-width: 481px) {
    .sr-chat-panel-bubble {
      top: auto;
      right: auto;
      left: 20px;
      bottom: 20px;
      width: var(--chat-panel-width);
      height: var(--chat-panel-height);
      max-height: calc(100vh - 40px);
      border-radius: var(--radius);
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15), 0 2px 8px rgba(0, 0, 0, 0.08);
      transform-origin: bottom left;
    }

    .sr-chat-panel-bubble.sr-chat-panel-bottom-right {
      left: auto;
      right: 20px;
      transform-origin: bottom right;
    }
  }

  .sr-chat-panel-bubble.open {
    transform: scale(1);
    opacity: 1;
    pointer-events: auto;
  }

  /* Mobile: slide up from bottom */
  .sr-chat-panel-bubble.closed {
    transform: translateY(100%);
    opacity: 0;
    pointer-events: none;
  }

  /* Desktop: scale down to the launcher corner */
  @media (min-width: 481px) {
    .sr-chat-panel-bubble.closed {
      transform: scale(0);
      opacity: 0;
    }
  }

  /* ── Panel — drawer style ── */
  .sr-chat-panel-drawer {
    top: 0;
    bottom: 0;
    left: 0;
    width: var(--chat-panel-width);
    max-width: calc(100vw - 40px);
    border-radius: 0;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  }

  .sr-chat-panel-drawer.sr-chat-panel-bottom-right {
    left: auto;
    right: 0;
  }

  .sr-chat-panel-drawer.open {
    transform: translateX(0);
  }

  .sr-chat-panel-drawer.sr-chat-panel-bottom-left.closed {
    transform: translateX(-100%);
  }

  .sr-chat-panel-drawer.sr-chat-panel-bottom-right.closed {
    transform: translateX(100%);
  }

  /* ── Header ── */
  .sr-chat-header {
    padding: 14px 16px;
    background: var(--primary);
    color: var(--primary-foreground, #fff);
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-shrink: 0;
  }

  .sr-chat-store-info {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .sr-chat-avatar {
    width: 38px;
    height: 38px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.2);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .sr-chat-store-name {
    font-weight: 600;
    font-size: 14px;
    line-height: 1.3;
  }

  .sr-chat-status {
    font-size: 12px;
    opacity: 0.85;
    display: flex;
    align-items: center;
    gap: 5px;
    margin-top: 2px;
  }

  .sr-chat-status-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #4ade80;
    flex-shrink: 0;
  }

  .sr-chat-status-dot.offline {
    background: rgba(255, 255, 255, 0.45);
  }

  .sr-chat-header-actions {
    display: flex;
    align-items: center;
    gap: 2px;
    flex-shrink: 0;
  }

  .sr-chat-close-btn,
  .sr-chat-mute-btn {
    background: none;
    border: none;
    cursor: pointer;
    color: var(--primary-foreground, #fff);
    padding: 6px;
    border-radius: var(--radius);
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0.8;
    transition: opacity 0.15s ease, background 0.15s ease;
    flex-shrink: 0;
  }

  .sr-chat-close-btn:hover,
  .sr-chat-mute-btn:hover {
    opacity: 1;
    background: rgba(255, 255, 255, 0.15);
  }

  .sr-chat-mute-btn.muted {
    opacity: 0.5;
  }

  /* ── Messages ── */
  .sr-chat-messages {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    background: var(--background);
    scroll-behavior: smooth;
    overscroll-behavior: contain;
  }

  /* Empty / loading state */
  .sr-chat-empty {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 32px 24px;
    background: var(--background);
    text-align: center;
  }

  .sr-chat-empty-icon {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: color-mix(in srgb, var(--primary) 12%, transparent);
    color: var(--primary);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .sr-chat-empty-title {
    font-size: 15px;
    font-weight: 600;
    color: var(--foreground);
  }

  .sr-chat-empty-subtitle {
    font-size: 13px;
    color: var(--muted-foreground);
    line-height: 1.5;
  }

  /* Loading spinner */
  .sr-chat-spinner {
    width: 24px;
    height: 24px;
    border: 2px solid var(--border);
    border-top-color: var(--primary);
    border-radius: 50%;
    animation: sr-chat-spin 0.7s linear infinite;
    margin: auto;
  }

  @keyframes sr-chat-spin {
    to { transform: rotate(360deg); }
  }

  .sr-chat-message {
    display: flex;
    gap: 3px;
  }

  /* Customer: right-aligned column, no avatar */
  .sr-chat-message.from-customer {
    flex-direction: column;
    align-self: flex-end;
    align-items: flex-end;
    max-width: 82%;
  }

  /* Seller: column — name on top, then row of [avatar + bubble] */
  .sr-chat-message.from-seller {
    flex-direction: column;
    align-self: flex-start;
    align-items: flex-start;
    max-width: 82%;
    gap: 3px;
  }

  .sr-chat-sender-name {
    font-size: 11px;
    font-weight: 600;
    color: var(--muted-foreground);
    margin-left: 36px;
  }

  .sr-chat-msg-row {
    display: flex;
    flex-direction: row;
    align-items: flex-start;
    gap: 8px;
  }

  .sr-chat-msg-avatar {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: color-mix(in srgb, var(--primary) 15%, var(--card));
    color: var(--primary);
    font-size: 11px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    border: 1px solid var(--border);
    margin-top: 2px;
  }

  .sr-chat-msg-avatar img {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    object-fit: cover;
  }

  .sr-chat-msg-body {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 3px;
    max-width: 100%;
  }

  .sr-chat-bubble {
    padding: 9px 13px;
    border-radius: 16px;
    font-size: 14px;
    line-height: 1.5;
    word-break: break-word;
  }

  .from-customer .sr-chat-bubble {
    background: var(--primary);
    color: var(--primary-foreground, #fff);
    border-bottom-right-radius: 4px;
  }

  .from-seller .sr-chat-bubble {
    background: var(--card);
    color: var(--foreground);
    border-bottom-left-radius: 4px;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
  }

  .sr-chat-time {
    font-size: 10px;
    color: var(--muted-foreground);
    padding: 0 2px;
  }

  .sr-chat-show-original {
    background: none;
    border: none;
    font-size: 10px;
    color: var(--primary);
    cursor: pointer;
    padding: 0 2px;
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  /* ── Typing indicator ── */
  .sr-chat-typing {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 12px 16px;
    background: var(--card);
    border-radius: 16px;
    border-bottom-left-radius: 4px;
    width: fit-content;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
    align-self: flex-start;
  }

  .sr-chat-typing-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--muted-foreground);
    animation: sr-chat-bounce 1.3s ease-in-out infinite;
  }

  .sr-chat-typing-dot:nth-child(2) { animation-delay: 0.2s; }
  .sr-chat-typing-dot:nth-child(3) { animation-delay: 0.4s; }

  @keyframes sr-chat-bounce {
    0%, 60%, 100% { transform: translateY(0); opacity: 0.5; }
    30% { transform: translateY(-5px); opacity: 1; }
  }

  /* ── Rate limit notice ── */
  .sr-chat-rate-limit {
    margin: 0 12px 8px;
    padding: 8px 12px;
    background: color-mix(in srgb, var(--destructive, #ef4444) 10%, transparent);
    border: 1px solid color-mix(in srgb, var(--destructive, #ef4444) 30%, transparent);
    border-radius: var(--radius);
    font-size: 12px;
    color: var(--destructive, #ef4444);
    text-align: center;
    flex-shrink: 0;
  }

  /* ── Footer ── */
  .sr-chat-footer {
    padding: 12px;
    background: var(--card);
    border-top: 1px solid var(--border);
    flex-shrink: 0;
  }

  .sr-chat-composer {
    border: 1.5px solid var(--border);
    border-radius: 14px;
    background: var(--input);
    transition: border-color 0.2s ease;
    overflow: hidden;
  }

  .sr-chat-composer:focus-within {
    border-color: var(--primary);
  }

  .sr-chat-input {
    display: block;
    width: 100%;
    padding: 12px 14px 6px;
    background: transparent;
    border: none;
    font-size: 14px;
    font-family: inherit;
    color: var(--foreground);
    resize: none;
    outline: none;
    line-height: 1.5;
    max-height: 120px;
    overflow-y: auto;
    box-sizing: border-box;
  }

  .sr-chat-input::placeholder {
    color: var(--muted-foreground);
  }

  .sr-chat-composer-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    padding: 4px 8px 8px;
  }

  .sr-chat-send-btn {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: var(--primary);
    color: var(--primary-foreground, #fff);
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: opacity 0.15s ease, transform 0.15s ease;
  }

  .sr-chat-send-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .sr-chat-send-btn:not(:disabled):hover {
    opacity: 0.88;
    transform: scale(1.05);
  }

  /* ── Branding ── */
  .sr-chat-branding {
    padding: 6px 0 8px;
    text-align: center;
    font-size: 10px;
    color: var(--muted-foreground);
    flex-shrink: 0;
  }

  .sr-chat-branding a {
    color: var(--primary);
    text-decoration: none;
  }

  /* ── Mobile ── */
  @media (max-width: 480px) {
    .sr-chat-launcher {
      bottom: 16px;
      left: 16px;
    }

    .sr-chat-launcher.bottom-right {
      left: auto;
      right: 16px;
    }

    .sr-chat-open-btn {
      width: var(--chat-size-sm);
      height: var(--chat-size-sm);
    }
  }

  /* ── Seen indicator ── */
  .sr-chat-seen {
    font-size: 10px;
    color: var(--muted-foreground);
    padding: 0 2px;
    display: flex;
    align-items: center;
    gap: 3px;
  }

  /* ── Failed message ── */
  .sr-chat-message.failed .sr-chat-bubble {
    opacity: 0.6;
  }

  .sr-chat-retry {
    background: none;
    border: none;
    font-size: 11px;
    color: var(--destructive, #ef4444);
    cursor: pointer;
    padding: 0 2px;
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  /* ── Pre-chat email field ── */
  .sr-chat-email-row {
    padding: 0 0 8px;
  }

  .sr-chat-email-input {
    display: block;
    width: 100%;
    padding: 9px 12px;
    background: var(--input);
    border: 1.5px solid var(--border);
    border-radius: 10px;
    font-size: 13px;
    font-family: inherit;
    color: var(--foreground);
    outline: none;
    box-sizing: border-box;
    transition: border-color 0.2s ease;
  }

  .sr-chat-email-input:focus {
    border-color: var(--primary);
  }

  .sr-chat-email-input::placeholder {
    color: var(--muted-foreground);
  }

  /* ── Closed conversation notice ── */
  .sr-chat-closed-notice {
    margin: 0 12px 8px;
    padding: 10px 14px;
    background: color-mix(in srgb, var(--muted-foreground) 8%, transparent);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    font-size: 12px;
    color: var(--muted-foreground);
    text-align: center;
    flex-shrink: 0;
  }
`;

export class ChatWidget extends ShoprocketElement {
  protected override createRenderRoot(): Element | ShadowRoot {
    const root = super.createRenderRoot() as ShadowRoot;
    const sheet = chatStyles.styleSheet;
    if (sheet && 'adoptedStyleSheets' in root) {
      root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];
    }
    return root;
  }

  @property({ type: String }) position = 'bottom-left';
  @property({ type: String, attribute: 'widget-style' }) widgetStyle = 'bubble';
  @property({ type: String }) welcome = 'Hi! How can we help you today? 👋';

  @state() private isOpen = false;
  @state() private messages: ChatMessage[] = [];
  @state() private inputValue = '';
  @state() private emailValue = '';
  @state() private unreadCount = 0;
  @state() private isAgentTyping = false;
  @state() private isLoading = false;
  @state() private isSending = false;
  @state() private rateLimited = false;
  @state() private showOriginalId: string | null = null;
  @state() private conversationStatus: 'open' | 'pending' | 'closed' | null = null;
  @state() private muted = false;
  @state() private teamOnline = false;

  private conversationId: string | null = null;
  private _initPromise: Promise<void> | null = null;
  private _pollTimer: ReturnType<typeof setInterval> | null = null;
  private _badgePollTimer: ReturnType<typeof setInterval> | null = null;
  private _audioCtx: AudioContext | null = null;

  private readonly _handleOpen = () => this._open();
  private readonly _handleClose = () => this._close();
  private readonly _handleToggle = () => this._toggle();
  // Keep AudioContext unblocked — browsers suspend it without a recent user gesture
  private readonly _handleUserGesture = () => {
    if (this._audioCtx?.state === 'suspended') this._audioCtx.resume().catch(() => {});
  };

  private get _storageKey(): string {
    return `shoprocket_conv_${this.sdk?.getPublishableKey() ?? 'default'}`;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener('open-chat', this._handleOpen);
    window.addEventListener('close-chat', this._handleClose);
    window.addEventListener('toggle-chat', this._handleToggle);
    document.addEventListener('click', this._handleUserGesture);
    try { this.muted = localStorage.getItem('shoprocket_chat_muted') === '1'; } catch {}
    this.updateComplete.then(() => {
      this._initConversation();
      this._startBadgePoll();
    });
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener('open-chat', this._handleOpen);
    window.removeEventListener('close-chat', this._handleClose);
    window.removeEventListener('toggle-chat', this._handleToggle);
    document.removeEventListener('click', this._handleUserGesture);
    this._stopPolling();
    this._stopBadgePoll();
    this._audioCtx?.close().catch(() => {});
  }

  private _initConversation(): Promise<void> {
    if (!this._initPromise) {
      this._initPromise = (async () => {
        if (!this.sdk) return;
        // Restore from localStorage for instant UI (avoids flicker)
        const stored = localStorage.getItem(this._storageKey);
        if (stored) this.conversationId = stored;
        try {
          const result = await this.sdk.chat.getCurrent();
          this.teamOnline = result.teamOnline;
          const conversation = result.conversation;
          if (conversation) {
            this.conversationId = conversation.id;
            this.conversationStatus = conversation.status;
            this.unreadCount = conversation.unread_count;
            localStorage.setItem(this._storageKey, conversation.id);
          } else {
            // No active conversation — clear stale stored ID
            this.conversationId = null;
            localStorage.removeItem(this._storageKey);
          }
        } catch {
          // Keep stored ID as fallback if API unreachable
        }
      })();
    }
    return this._initPromise;
  }

  private async _open(): Promise<void> {
    this.isOpen = true;
    this.unreadCount = 0;
    this._stopBadgePoll();
    window.dispatchEvent(new CustomEvent('shoprocket:chat:open'));

    await this._initConversation();

    if (this.conversationId) {
      this.isLoading = true;
      await this._loadMessages(true); // silent — don't re-play sound for messages already notified
      this.isLoading = false;
      this._startPolling();
    }

    this._scrollToBottom();
  }

  private _close(): void {
    this.isOpen = false;
    this._stopPolling();
    this._startBadgePoll();
    window.dispatchEvent(new CustomEvent('shoprocket:chat:close'));
  }

  private _toggle(): void {
    // Eagerly create AudioContext on the first real user gesture so it starts
    // in 'running' state — timers (badge poll) cannot unblock a suspended context.
    if (!this._audioCtx) {
      try { this._audioCtx = new AudioContext(); } catch {}
    }
    this.isOpen ? this._close() : this._open();
  }

  private async _loadMessages(silent = false): Promise<void> {
    if (!this.sdk || !this.conversationId) return;
    try {
      const result = await this.sdk.chat.getMessages(this.conversationId);
      this.teamOnline = result.teamOnline;
      this.conversationStatus = result.status;
      const mapped = result.messages.map(mapMessage);

      // Detect new seller messages for auto-scroll / sound
      const existingIds = new Set(this.messages.map(m => m.id));
      const hasNewSeller = mapped.some(m => m.from === 'seller' && !existingIds.has(m.id));

      // Merge: keep any pending/failed optimistic messages that aren't in the real set
      const realIds = new Set(mapped.map(m => m.id));
      const optimistic = this.messages.filter(
        m => (m.status === 'sending' || m.status === 'failed') && !realIds.has(m.id)
      );
      this.messages = [...mapped, ...optimistic];

      if (hasNewSeller) {
        this._scrollToBottom();
        if (!silent) this._playNotification();
      }
    } catch {
      // Silent — next poll will retry
    }
  }

  private _startPolling(): void {
    this._stopPolling();
    this._pollTimer = setInterval(() => {
      if (this.conversationId) this._loadMessages();
    }, 5000);
  }

  private _stopPolling(): void {
    if (this._pollTimer !== null) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
    }
  }

  private _startBadgePoll(): void {
    this._stopBadgePoll();
    this._badgePollTimer = setInterval(async () => {
      if (!this.sdk || this.isOpen) return;
      try {
        const result = await this.sdk.chat.getCurrent();
        this.teamOnline = result.teamOnline;
        const conv = result.conversation;
        if (conv) {
          if (conv.unread_count > this.unreadCount && !this.isOpen) this._playNotification();
          this.unreadCount = conv.unread_count;
          this.conversationStatus = conv.status;
          if (!this.conversationId) {
            this.conversationId = conv.id;
            localStorage.setItem(this._storageKey, conv.id);
          }
        }
      } catch {}
    }, 8000);
  }

  private _stopBadgePoll(): void {
    if (this._badgePollTimer !== null) {
      clearInterval(this._badgePollTimer);
      this._badgePollTimer = null;
    }
  }

  private _playNotification(): void {
    if (this.muted) return;
    try {
      if (!this._audioCtx) this._audioCtx = new AudioContext();
      const ctx = this._audioCtx;
      const resume = ctx.state === 'suspended' ? ctx.resume() : Promise.resolve();
      resume.then(() => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.12);
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.35);
      }).catch(() => {});
    } catch {}
  }

  private _toggleMute(): void {
    this.muted = !this.muted;
    try { localStorage.setItem('shoprocket_chat_muted', this.muted ? '1' : '0'); } catch {}
  }

  private _scrollToBottom(): void {
    this.updateComplete.then(() => {
      const el = this.renderRoot?.querySelector('.sr-chat-messages') as HTMLElement | null;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }

  private _onInput(e: Event): void {
    this.inputValue = (e.target as HTMLTextAreaElement).value;
  }

  private _onKeydown(e: KeyboardEvent): void {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      this._send();
    }
  }

  private async _send(): Promise<void> {
    const content = this.inputValue.trim();
    if (!content || this.isSending || this.rateLimited) return;

    this.isSending = true;
    this.inputValue = '';

    const tempId = `temp-${Date.now()}`;
    const optimistic: ChatMessage = {
      id: tempId,
      from: 'customer',
      content,
      isTranslated: false,
      originalContent: content,
      senderName: null,
      senderAvatarUrl: null,
      isRead: false,
      timestamp: new Date(),
      status: 'sending',
    };
    this.messages = [...this.messages, optimistic];
    this._scrollToBottom();
    window.dispatchEvent(new CustomEvent('shoprocket:chat:message', { detail: { content } }));

    try {
      if (!this.conversationId) {
        const locale = navigator.languages?.[0] ?? navigator.language ?? 'en';
        const email = this.emailValue.trim() || undefined;
        const result = await this.sdk.chat.create(content, { locale, email });
        this.conversationId = result.conversationId;
        this.conversationStatus = 'open';
        localStorage.setItem(this._storageKey, result.conversationId);
        this.emailValue = '';
        // Replace optimistic in-place with the real message — no flicker
        if (result.message) {
          this.messages = this.messages.map(m => m.id === tempId ? mapMessage(result.message) : m);
        }
        await this._loadMessages();
        this._startPolling();
      } else {
        const sent = await this.sdk.chat.sendMessage(this.conversationId, content);
        // Replace optimistic in-place with the real message — no flicker
        if (sent) {
          this.messages = this.messages.map(m => m.id === tempId ? mapMessage(sent) : m);
        }
        await this._loadMessages();
      }
    } catch (err: any) {
      // Mark optimistic as failed with retry option
      this.messages = this.messages.map(m =>
        m.id === tempId ? { ...m, status: 'failed' as const } : m
      );
      if (err?.status === 429) {
        this.rateLimited = true;
        setTimeout(() => { this.rateLimited = false; }, 15000);
      }
    } finally {
      this.isSending = false;
    }
  }

  private _retry(msg: ChatMessage): void {
    // Remove the failed message and restore its content to the input
    this.messages = this.messages.filter(m => m.id !== msg.id);
    this.inputValue = msg.originalContent;
  }

  private _formatTime(d: Date): string {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  private _renderMessage(msg: ChatMessage, showSeen: boolean): TemplateResult {
    const showOriginal = this.showOriginalId === msg.id;
    const displayContent = showOriginal ? msg.originalContent : msg.content;
    const timeMeta = html`
      <span class="sr-chat-time">${this._formatTime(msg.timestamp)}</span>
      ${msg.isTranslated ? html`
        <button class="sr-chat-show-original" @click="${() => {
          this.showOriginalId = showOriginal ? null : msg.id;
        }}">${showOriginal ? 'Show translation' : 'Show original'}</button>
      ` : ''}
    `;

    if (msg.from === 'seller') {
      const initial = msg.senderName?.[0]?.toUpperCase() ?? 'S';
      return html`
        <div class="sr-chat-message from-seller">
          <span class="sr-chat-sender-name">${msg.senderName ?? 'Support'}</span>
          <div class="sr-chat-msg-row">
            <div class="sr-chat-msg-avatar" aria-hidden="true">
              ${msg.senderAvatarUrl
                ? html`<img src="${msg.senderAvatarUrl}" alt="${msg.senderName ?? 'Support'}">`
                : initial}
            </div>
            <div class="sr-chat-msg-body">
              <div class="sr-chat-bubble">${displayContent}</div>
              ${timeMeta}
            </div>
          </div>
        </div>
      `;
    }

    return html`
      <div class="sr-chat-message from-customer ${msg.status === 'failed' ? 'failed' : ''}">
        <div class="sr-chat-bubble">${displayContent}</div>
        ${msg.status === 'sending'
          ? html`<span class="sr-chat-time">Sending…</span>`
          : timeMeta}
        ${msg.status === 'failed' ? html`
          <button class="sr-chat-retry" @click="${() => this._retry(msg)}">
            Failed to send · Tap to retry
          </button>
        ` : ''}
        ${showSeen ? html`<span class="sr-chat-seen">Seen</span>` : ''}
      </div>
    `;
  }

  private _renderMessages(): TemplateResult {
    if (this.isLoading) {
      return html`<div class="sr-chat-empty"><div class="sr-chat-spinner"></div></div>`;
    }

    if (this.messages.length === 0) {
      return html`
        <div class="sr-chat-empty">
          <div class="sr-chat-empty-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
            </svg>
          </div>
          <div class="sr-chat-empty-title">${this.welcome}</div>
          <div class="sr-chat-empty-subtitle">${this.teamOnline
            ? "Send us a message and we'll get back to you as soon as we can."
            : "We're offline right now. Leave a message and we'll reply when we're back."
          }</div>
        </div>
      `;
    }

    // Find the last customer message with is_read=true for "Seen" indicator
    let lastReadId: string | null = null;
    for (let i = this.messages.length - 1; i >= 0; i--) {
      if (this.messages[i].from === 'customer' && this.messages[i].isRead) {
        lastReadId = this.messages[i].id;
        break;
      }
    }

    return html`
      <div class="sr-chat-messages" role="log" aria-live="polite" aria-label="Chat messages">
        ${this.messages.map(msg => this._renderMessage(msg, msg.id === lastReadId))}
        ${this.isAgentTyping ? html`
          <div class="sr-chat-typing" aria-label="Agent is typing">
            <span class="sr-chat-typing-dot"></span>
            <span class="sr-chat-typing-dot"></span>
            <span class="sr-chat-typing-dot"></span>
          </div>
        ` : ''}
      </div>
    `;
  }

  protected override render(): TemplateResult {
    const { isOpen, position, widgetStyle } = this;
    const isClosed = this.conversationStatus === 'closed';
    const openClosed = isOpen ? 'open' : 'closed';
    const launcherClass = `sr-chat-launcher ${position}`;
    const overlayClass = `sr-chat-overlay ${openClosed}`;
    const panelClass = `sr-chat-panel sr-chat-panel-${widgetStyle} sr-chat-panel-${position} ${openClosed}`;
    const launcherLabel = `Chat with us${this.unreadCount > 0 ? ` (${this.unreadCount} unread)` : ''}`;

    return html`
      <div class="${overlayClass}" @click="${this._close}"></div>

      ${this.hasFeature('launcher') ? html`
        <div class="${launcherClass}">
          <button
            class="sr-chat-open-btn"
            @click="${this._toggle}"
            aria-label="${launcherLabel}"
            title="Chat with us"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
            ${!isOpen && this.unreadCount > 0 ? html`
              <span class="sr-chat-badge" aria-label="${this.unreadCount} unread messages">${this.unreadCount}</span>
            ` : ''}
          </button>
        </div>
      ` : ''}

      <div class="${panelClass}" role="dialog" aria-label="Live chat" aria-hidden="${!isOpen}">

        <div class="sr-chat-header">
          <div class="sr-chat-store-info">
            <div class="sr-chat-avatar" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
              </svg>
            </div>
            <div>
              <div class="sr-chat-store-name">Support Chat</div>
              <div class="sr-chat-status">
                <span class="sr-chat-status-dot ${this.teamOnline ? '' : 'offline'}" aria-hidden="true"></span>
                ${this.teamOnline ? 'Online · Replies in minutes' : 'Currently offline'}
              </div>
            </div>
          </div>
          <div class="sr-chat-header-actions">
            <button
              class="sr-chat-mute-btn ${this.muted ? 'muted' : ''}"
              @click="${this._toggleMute}"
              aria-label="${this.muted ? 'Unmute notifications' : 'Mute notifications'}"
              title="${this.muted ? 'Unmute notifications' : 'Mute notifications'}"
            >
              ${this.muted
                ? html`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.268 21a2 2 0 0 0 3.464 0"/><path d="M17 17H4a1 1 0 0 1-.74-1.673C4.59 13.956 6 12.499 6 8a6 6 0 0 1 .258-1.742"/><path d="m2 2 20 20"/><path d="M8.668 3.01A6 6 0 0 1 18 8c0 2.687.77 4.653 1.707 6.05"/></svg>`
                : html`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.268 21a2 2 0 0 0 3.464 0"/><path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"/></svg>`
              }
            </button>
            <button class="sr-chat-close-btn" @click="${this._close}" aria-label="Close chat">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>

        ${this._renderMessages()}

        ${this.rateLimited ? html`
          <div class="sr-chat-rate-limit" role="alert">
            Please wait a moment before sending another message.
          </div>
        ` : ''}

        ${isClosed ? html`
          <div class="sr-chat-closed-notice" role="status">
            This conversation is closed.
          </div>
        ` : html`
          <div class="sr-chat-footer">
            ${!this.conversationId ? html`
              <div class="sr-chat-email-row">
                <input
                  class="sr-chat-email-input"
                  type="email"
                  placeholder="Your email (optional)"
                  .value="${this.emailValue}"
                  @input="${(e: Event) => { this.emailValue = (e.target as HTMLInputElement).value; }}"
                  autocomplete="email"
                  aria-label="Your email address"
                />
              </div>
            ` : ''}
            <div class="sr-chat-composer">
              <textarea
                class="sr-chat-input"
                placeholder="Type a message…"
                rows="2"
                .value="${this.inputValue}"
                @input="${this._onInput}"
                @keydown="${this._onKeydown}"
                ?disabled="${this.isSending || this.rateLimited}"
                aria-label="Message input"
              ></textarea>
              <div class="sr-chat-composer-actions">
                <button
                  class="sr-chat-send-btn"
                  ?disabled="${!this.inputValue.trim() || this.isSending || this.rateLimited}"
                  @click="${this._send}"
                  aria-label="Send message"
                >
                  ${this.isSending
                    ? html`<div class="sr-chat-spinner" style="width:14px;height:14px;border-width:2px;border-color:rgba(255,255,255,0.3);border-top-color:#fff"></div>`
                    : html`<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>`
                  }
                </button>
              </div>
            </div>
          </div>
        `}

        ${this.hasFeature('branding') ? html`
          <div class="sr-chat-branding">
            Powered by <a href="https://shoprocket.io" target="_blank" rel="noopener noreferrer">Shoprocket</a>
          </div>
        ` : ''}

      </div>
    `;
  }
}
