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
import { repeat } from 'lit/directives/repeat.js';
import { property, state } from 'lit/decorators.js';
import { ShoprocketElement } from '../core/base-component';
import { CookieManager } from '../utils/cookie-manager';
import type { ApiChatMessage } from '@shoprocket/core';

// Use browser's built-in email validation (avoids regex maintenance)
function isValidEmail(email: string): boolean {
  const el = document.createElement('input');
  el.type = 'email';
  el.value = email;
  return el.checkValidity();
}

// ── Reverb/Pusher WebSocket connection — supports multiple channel subscriptions ──
class ReverbConnection {
  private ws: WebSocket | null = null;
  private socketId: string | null = null;
  private reconnectDelay = 1000;
  private destroyed = false;
  // channel → callback
  private listeners = new Map<string, (event: string, data: any) => void>();
  private onlineHandler: () => void;
  private visibilityHandler: () => void;

  constructor(
    private authUrl: string,
    private authHeaders: Record<string, string>,
  ) {
    this.connect();
    // Reconnect immediately when network comes back (e.g. machine woke from sleep)
    this.onlineHandler = () => {
      console.log('[Reverb] online event fired, readyState:', this.ws?.readyState);
      if (!this.destroyed && this.ws?.readyState !== WebSocket.OPEN) {
        this.reconnectDelay = 1000;
        this.ws?.close();
        this.connect();
      }
    };
    // Reconnect when tab becomes visible again after being hidden
    this.visibilityHandler = () => {
      console.log('[Reverb] visibilitychange, hidden:', document.hidden);
      if (!document.hidden) this.onlineHandler();
    };
    window.addEventListener('online', this.onlineHandler);
    document.addEventListener('visibilitychange', this.visibilityHandler);
  }

  /** Subscribe to a private channel. Safe to call before connection is established. */
  subscribe(channel: string, callback: (event: string, data: any) => void): void {
    this.listeners.set(channel, callback);
    if (this.socketId) void this.doSubscribe(channel);
    // else: will be subscribed once connection_established fires
  }

  /** Unsubscribe from a channel. */
  unsubscribe(channel: string): void {
    this.listeners.delete(channel);
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ event: 'pusher:unsubscribe', data: { channel } }));
    }
  }

  /** Send a client event (typing indicator) on a specific channel. */
  whisper(channel: string, data: object): void {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ event: 'client-typing', channel, data: JSON.stringify(data) }));
  }

  destroy(): void {
    this.destroyed = true;
    this.ws?.close();
    this.ws = null;
    window.removeEventListener('online', this.onlineHandler);
    document.removeEventListener('visibilitychange', this.visibilityHandler);
  }

  private connect(): void {
    const host = import.meta.env.VITE_REVERB_HOST;
    const port = import.meta.env.VITE_REVERB_PORT;
    const scheme = import.meta.env.VITE_REVERB_SCHEME === 'https' ? 'wss' : 'ws';
    const key = import.meta.env.VITE_REVERB_APP_KEY;
    const url = `${scheme}://${host}:${port}/app/${key}?protocol=7&client=js&version=8.0.0`;
    console.log('[Reverb] connecting to', url, '— reconnectDelay was', this.reconnectDelay);
    this.ws = new WebSocket(url);

    // If we don't get connection_established within 10s, the socket is likely
    // hanging (e.g. routing change after VPN toggle) — close and retry
    const ws = this.ws;
    const connectTimeout = setTimeout(() => {
      console.log('[Reverb] connect timeout (10s), readyState:', ws.readyState, '— forcing close');
      if (ws.readyState !== WebSocket.OPEN) ws.close();
    }, 10000);

    this.ws.onmessage = async (e) => {
      const msg = JSON.parse(e.data);
      const d = (raw: any) => typeof raw === 'string' ? JSON.parse(raw || '{}') : (raw ?? {});
      if (msg.event === 'pusher:connection_established') {
        clearTimeout(connectTimeout);
        this.socketId = d(msg.data).socket_id;
        this.reconnectDelay = 1000;
        console.log('[Reverb] connected, socket_id:', this.socketId, '— subscribing', this.listeners.size, 'channel(s)');
        for (const channel of this.listeners.keys()) await this.doSubscribe(channel);
      } else if (msg.event === 'pusher:ping') {
        this.ws?.send(JSON.stringify({ event: 'pusher:pong', data: {} }));
      } else if (msg.event === 'pusher:error') {
        const code = d(msg.data).code ?? 0;
        console.error('[Reverb] server error, code:', code);
        if (code > 0 && code < 4100) this.destroyed = true;
      } else if (!msg.event?.startsWith('pusher_internal:') && msg.channel) {
        this.listeners.get(msg.channel)?.(msg.event as string, d(msg.data));
      }
    };

    this.ws.onerror = (e) => {
      console.log('[Reverb] ws error', e);
    };

    this.ws.onclose = (e) => {
      clearTimeout(connectTimeout);
      this.socketId = null;
      console.log('[Reverb] closed, code:', e.code, 'reason:', e.reason || '(none)', '— next retry in', this.reconnectDelay, 'ms');
      if (this.destroyed) return;
      setTimeout(() => this.connect(), this.reconnectDelay);
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, 8000);
    };
  }

  private async doSubscribe(channel: string, attempt = 0): Promise<void> {
    if (!this.socketId || this.destroyed) return;
    console.log('[Reverb] subscribing to', channel, attempt > 0 ? `(attempt ${attempt + 1})` : '');
    try {
      const res = await fetch(this.authUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...this.authHeaders },
        body: JSON.stringify({ socket_id: this.socketId, channel_name: channel }),
      });
      if (!res.ok) { console.error('[Reverb] auth failed', res.status); return; }
      const { auth } = await res.json();
      if (!auth) { console.error('[Reverb] auth missing token'); return; }
      this.ws?.send(JSON.stringify({ event: 'pusher:subscribe', data: { channel, auth } }));
      console.log('[Reverb] subscribed to', channel);
    } catch (err) {
      console.error('[Reverb] auth fetch error (attempt', attempt + 1, '):', err);
      // Network error (e.g. machine woke from sleep) — retry with backoff, max 3 attempts
      if (attempt < 3 && !this.destroyed) {
        console.log('[Reverb] retrying subscribe in', 2000 * (attempt + 1), 'ms');
        setTimeout(() => void this.doSubscribe(channel, attempt + 1), 2000 * (attempt + 1));
      }
    }
  }
}
// ─────────────────────────────────────────────────────────────────────────────

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
    flex: 1 1 0;
    min-height: 0;
    overflow-y: auto;
    padding: 16px;
    display: flex;
    flex-direction: column-reverse;
    gap: 12px;
    background: var(--background);
    overscroll-behavior: contain;
    scroll-behavior: smooth;
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

  /* ── Load more history ── */
  .sr-chat-load-more {
    display: flex;
    justify-content: center;
    padding: 8px 0 4px;
  }

  .sr-chat-load-more-btn {
    font-size: 12px;
    color: var(--muted-foreground);
    background: none;
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 4px 12px;
    cursor: pointer;
    transition: color 0.15s, border-color 0.15s;
  }

  .sr-chat-load-more-btn:hover {
    color: var(--foreground);
    border-color: var(--muted-foreground);
  }

  .sr-chat-load-more-spinner {
    display: inline-block;
    width: 16px;
    height: 16px;
    border: 2px solid var(--border);
    border-top-color: var(--muted-foreground);
    border-radius: 50%;
    animation: sr-chat-spin 0.6s linear infinite;
  }

  @keyframes sr-chat-spin {
    to { transform: rotate(360deg); }
  }

  /* ── Messages body wrapper (positions the new-message badge) ── */
  .sr-chat-body {
    position: relative;
    flex: 1 1 0;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  .sr-chat-new-msg-btn {
    position: absolute;
    bottom: 12px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--primary);
    color: var(--primary-foreground, #fff);
    border: none;
    border-radius: 999px;
    padding: 6px 14px 6px 10px;
    font-size: 13px;
    font-weight: 500;
    font-family: inherit;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 5px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.18);
    white-space: nowrap;
    z-index: 10;
    transition: transform 0.15s ease, box-shadow 0.15s ease;
  }

  .sr-chat-new-msg-btn:hover {
    transform: translateX(-50%) translateY(-1px);
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.22);
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
    font-size: 16px; /* Prevent iOS zoom */
    font-family: inherit;
    color: var(--foreground);
    resize: none;
    outline: none;
    line-height: 1.5;
    max-height: 120px;
    overflow-y: auto;
    box-sizing: border-box;
  }

  @media (min-width: 640px) {
    .sr-chat-input { font-size: 14px; }
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

  /* ── Read receipts (ticks) ── */
  .sr-chat-tick { display: inline-flex; align-items: center; flex-shrink: 0; }
  .sr-chat-tick.sent { color: var(--muted-foreground); opacity: 0.5; }
  .sr-chat-tick.read { color: #3b82f6; }

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

  .sr-chat-email-input.invalid {
    border-color: var(--destructive, #ef4444);
  }

  .sr-chat-email-input::placeholder {
    color: var(--muted-foreground);
  }

  /* ── Email nudge (post-conversation) ── */
  .sr-chat-email-nudge {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 0 0 8px;
  }

  .sr-chat-email-nudge-link {
    display: flex;
    align-items: center;
    gap: 5px;
    flex: 1;
    background: none;
    border: none;
    padding: 0;
    font-size: 12px;
    font-family: inherit;
    color: var(--primary);
    cursor: pointer;
    text-align: start;
    line-height: 1.4;
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  .sr-chat-email-nudge-form {
    display: flex;
    gap: 6px;
    flex: 1;
    align-items: center;
  }

  .sr-chat-email-nudge-form .sr-chat-email-input {
    flex: 1;
    padding: 7px 10px;
    font-size: 13px;
  }

  .sr-chat-email-nudge-save {
    flex-shrink: 0;
    padding: 7px 12px;
    background: var(--primary);
    color: var(--primary-foreground);
    border: none;
    border-radius: 10px;
    font-size: 12px;
    font-family: inherit;
    font-weight: 500;
    cursor: pointer;
    white-space: nowrap;
  }

  .sr-chat-email-nudge-save:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .sr-chat-email-nudge-dismiss {
    background: none;
    border: none;
    padding: 2px 4px;
    font-size: 16px;
    color: var(--muted-foreground);
    cursor: pointer;
    line-height: 1;
    flex-shrink: 0;
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
  @state() private emailInvalid = false;
  @state() private showOriginalId: string | null = null;
  @state() private hasMoreHistory = false;
  @state() private isLoadingHistory = false;
  @state() private _newMsgPending = false;
  @state() private conversationStatus: 'open' | 'pending' | 'closed' | null = null;
  @state() private muted = false;
  @state() private teamOnline = false;
  @state() private showEmailNudge = false;
  @state() private emailNudgeExpanded = false;
  @state() private emailNudgeSubmitting = false;

  private conversationId: string | null = null;
  private _initPromise: Promise<void> | null = null;
  private _reverb: ReverbConnection | null = null;
  private _typingTimeout: ReturnType<typeof setTimeout> | null = null;
  private _typingTimer: ReturnType<typeof setTimeout> | null = null;
  private _audioCtx: AudioContext | null = null;

  private readonly _handleOpen = () => this._open();
  private readonly _handleClose = () => this._close();
  private readonly _handleToggle = () => this._toggle();
  // Keep AudioContext unblocked — browsers suspend it without a recent user gesture
  private readonly _handleUserGesture = () => {
    if (!this._audioCtx) {
      try { this._audioCtx = new AudioContext(); } catch {}
    } else if (this._audioCtx.state === 'suspended') {
      this._audioCtx.resume().catch(() => {});
    }
    // Once unlocked, no need to keep listening
    if (this._audioCtx?.state === 'running') {
      document.removeEventListener('pointerdown', this._handleUserGesture);
      document.removeEventListener('keydown', this._handleUserGesture);
    }
  };

  private get _storageKey(): string {
    return `shoprocket_conv_${this.sdk?.getPublishableKey() ?? 'default'}`;
  }

  private _emailNudgeKey(conversationId: string): string {
    return `${this._storageKey}_email_${conversationId}`;
  }

  private _checkEmailNudge(): void {
    if (!this.conversationId) return;
    const status = localStorage.getItem(this._emailNudgeKey(this.conversationId));
    this.showEmailNudge = !status;
  }

  private async _submitEmail(): Promise<void> {
    const email = this.emailValue.trim();
    if (!email || !this.conversationId || this.emailNudgeSubmitting) return;
    if (!isValidEmail(email)) { this.emailInvalid = true; return; }
    this.emailNudgeSubmitting = true;
    try {
      await this.sdk.chat.updateEmail(this.conversationId, email);
      localStorage.setItem(this._emailNudgeKey(this.conversationId), '1');
      this.showEmailNudge = false;
      this.emailValue = '';
    } catch {
      // Silent — user can retry
    } finally {
      this.emailNudgeSubmitting = false;
    }
  }


  override connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener('open-chat', this._handleOpen);
    window.addEventListener('close-chat', this._handleClose);
    window.addEventListener('toggle-chat', this._handleToggle);
    document.addEventListener('pointerdown', this._handleUserGesture);
    document.addEventListener('keydown', this._handleUserGesture);
    try { this.muted = localStorage.getItem('shoprocket_chat_muted') === '1'; } catch {}
    this.updateComplete.then(async () => {
      // Wire permanent visitor identity into SDK headers before any API calls
      if (this.sdk) this.sdk.setVisitorId(CookieManager.getVisitorId());
      await this._initConversation();
      this._connectWS();
    });
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener('open-chat', this._handleOpen);
    window.removeEventListener('close-chat', this._handleClose);
    window.removeEventListener('toggle-chat', this._handleToggle);
    document.removeEventListener('pointerdown', this._handleUserGesture);
    document.removeEventListener('keydown', this._handleUserGesture);
    this._disconnectWS();
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
            this._checkEmailNudge();
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
    window.dispatchEvent(new CustomEvent('shoprocket:chat:open'));

    // Reset so _initConversation re-fetches fresh state — catches conversations
    // created on another device since this component mounted.
    this._initPromise = null;
    await this._initConversation();

    if (this.conversationId) {
      this.isLoading = true;
      await this._loadMessages(true); // silent — don't re-play sound for messages already notified
      this.isLoading = false;
      // WS is already connected from mount; ensure conversation channel is subscribed
      this._subscribeConversation(this.conversationId);
    }
    // No scroll needed: column-reverse means scrollTop=0 is already the bottom.
  }

  private _close(): void {
    this.isOpen = false;
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
      this.hasMoreHistory = result.hasMore;
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
        if (this._isAtBottom()) {
          this._scrollToBottom();
        } else {
          this._newMsgPending = true;
        }
        if (!silent && !this.isOpen) this._playNotification();
      }
    } catch {
      // Silent — next poll will retry
    }
  }

  private async _loadMoreMessages(): Promise<void> {
    if (!this.sdk || !this.conversationId || this.isLoadingHistory || !this.hasMoreHistory) return;
    const oldestId = this.messages.find(m => !m.id.startsWith('temp-'))?.id;
    if (!oldestId) return;

    this.isLoadingHistory = true;
    try {
      const result = await this.sdk.chat.getMessages(this.conversationId, oldestId);
      this.hasMoreHistory = result.hasMore;
      const older = result.messages.map(mapMessage);
      if (older.length > 0) {
        const existingIds = new Set(this.messages.map(m => m.id));
        const newOlder = older.filter(m => !existingIds.has(m.id));
        this.messages = [...newOlder, ...this.messages];
        // No scroll restoration needed: column-reverse + overflow-anchor keeps
        // the viewport stable when content is prepended at the top.
      }
    } catch {
    } finally {
      this.isLoadingHistory = false;
    }
  }

  private _connectWS(): void {
    if (this._reverb) return;
    const pk = this.sdk.getPublishableKey();
    const authUrl = `${this.sdk.getApiUrl()}/public/${pk}/broadcasting/auth`;
    const visitorId = CookieManager.getVisitorId();
    this._reverb = new ReverbConnection(authUrl, { 'X-Visitor-Id': visitorId });
    // Always subscribe to visitor channel for proactive messages from seller
    this._reverb.subscribe(`private-visitor.${visitorId}`, (event, data) => {
      if (event === 'inbox.message.created') this._onWSMessage(data);
      if (event === 'inbox.conversation.created') this._onWSConversationCreated(data);
    });
    // Subscribe to conversation channel if one already exists
    if (this.conversationId) this._subscribeConversation(this.conversationId);
  }

  private _subscribeConversation(conversationId: string): void {
    if (!this._reverb) return;
    this._reverb.subscribe(`private-conversation.${conversationId}`, (event, data) => {
      if (event === 'inbox.message.created') this._onWSMessage(data);
      if (event === 'client-typing') this._onWSTyping(data);
      if (event === 'inbox.conversation.translated') this._loadMessages(true);
      if (event === 'inbox.messages.read') this._loadMessages(true);
    });
  }

  private _onWSConversationCreated(data: any): void {
    const convId = data?.conversation_id as string | undefined;
    if (!convId || this.conversationId) return; // ignore if we already have a conversation
    this.conversationId = convId;
    this.conversationStatus = 'open';
    localStorage.setItem(this._storageKey, convId);
    this._subscribeConversation(convId);
    this._loadMessages();
    // Show unread badge if chat is closed
    if (!this.isOpen) {
      this.unreadCount++;
      this._playNotification();
    }
  }

  private _disconnectWS(): void {
    this._reverb?.destroy();
    this._reverb = null;
  }

  private _onWSMessage(data: any): void {
    const apiMsg = data?.message as ApiChatMessage | undefined;
    if (!apiMsg?.id) {
      // Payload missing full message shape — fall back to re-fetch
      this._loadMessages();
      return;
    }

    const msg = mapMessage(apiMsg);
    // Deduplicate: WS may fire before our own HTTP response has replaced temp-xxx
    if (this.messages.some(m => m.id === msg.id)) return;
    this.messages = [...this.messages, msg];

    // Clear typing indicator the moment a message lands
    if (msg.from === 'seller' && this.isAgentTyping) {
      this.isAgentTyping = false;
      if (this._typingTimeout !== null) { clearTimeout(this._typingTimeout); this._typingTimeout = null; }
    }

    if (msg.from === 'seller') {
      if (!this.isOpen) {
        this.unreadCount++;
        this._playNotification();
      } else {
        if (document.hidden) this._playNotification(); // tab not visible — play even though chat is "open"
        if (this._isAtBottom()) this._scrollToBottom();
        else this._newMsgPending = true;
      }
    }
  }

  private _onWSTyping(data: any): void {
    // Only show the typing indicator when an agent (seller) is typing
    if (data?.sender_type !== 'seller') return;
    this.isAgentTyping = true;
    if (this._isAtBottom()) this._scrollToBottom();
    if (this._typingTimeout !== null) clearTimeout(this._typingTimeout);
    this._typingTimeout = setTimeout(() => {
      this.isAgentTyping = false;
      this._typingTimeout = null;
    }, 3000);
  }

  private _playNotification(): void {
    if (this.muted) return;
    try {
      if (!this._audioCtx || this._audioCtx.state === 'suspended') return;
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

  private _isAtBottom(): boolean {
    const el = this.renderRoot?.querySelector('.sr-chat-messages') as HTMLElement | null;
    if (!el) return true;
    // column-reverse + .reverse(): DOM-first = newest = visual bottom.
    // scrollTop=0 is the visual bottom; near-0 means "at bottom".
    return el.scrollTop < 80;
  }

  private _scrollToBottom(): void {
    // column-reverse: visual bottom = scrollTop 0
    const el = this.renderRoot?.querySelector('.sr-chat-messages') as HTMLElement | null;
    if (el) el.scrollTo({ top: 0, behavior: 'smooth' });
  }

  private _jumpToBottom(): void {
    this._newMsgPending = false;
    this._scrollToBottom();
  }

  private _onMessagesScroll(e: Event): void {
    const el = e.target as HTMLElement;
    // Clear the new-message badge once the user scrolls back to the bottom (scrollTop near 0)
    if (this._newMsgPending && el.scrollTop < 80) {
      this._newMsgPending = false;
    }
    // column-reverse: user is near the oldest messages when scrollTop is near max
    if (el.scrollTop > el.scrollHeight - el.clientHeight - 80 && this.hasMoreHistory && !this.isLoadingHistory) {
      this._loadMoreMessages();
    }
  }

  private _onInput(e: Event): void {
    this.inputValue = (e.target as HTMLTextAreaElement).value;
    // Debounced typing indicator (1s)
    if (this._typingTimer !== null) return; // throttle: already sent recently
    this._typingTimer = setTimeout(() => { this._typingTimer = null; }, 2000);
    if (this.conversationId) this._reverb?.whisper(`private-conversation.${this.conversationId}`, { sender_type: 'customer' });
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
        if (email && !isValidEmail(email)) {
          this.messages = this.messages.filter(m => m.id !== tempId);
          this.inputValue = content;
          this.emailInvalid = true;
          return;
        }
        const result = await this.sdk.chat.create(content, { locale, email });
        this.conversationId = result.conversationId;
        this.conversationStatus = 'open';
        localStorage.setItem(this._storageKey, result.conversationId);
        // Show email nudge if user skipped the pre-chat email field
        if (!email) this._checkEmailNudge();
        this.emailValue = '';
        // Replace optimistic with the real message, removing any WS-added copy
        // of the same message that may have arrived before this response.
        if (result.message) {
          const real = mapMessage(result.message);
          this.messages = this.messages
            .filter(m => m.id !== real.id)
            .map(m => m.id === tempId ? real : m);
        }
        await this._loadMessages();
        // WS connection already exists; subscribe to new conversation channel
        this._subscribeConversation(result.conversationId);
      } else {
        const sent = await this.sdk.chat.sendMessage(this.conversationId, content);
        // Replace optimistic with the real message, removing any WS-added copy.
        if (sent) {
          const real = mapMessage(sent);
          this.messages = this.messages
            .filter(m => m.id !== real.id)
            .map(m => m.id === tempId ? real : m);
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

  private _tick(isRead: boolean): TemplateResult {
    return isRead
      ? html`<svg class="sr-chat-tick read" width="18" height="9" viewBox="0 0 18 9" fill="none" aria-label="Seen"><polyline points="1,5 3.5,8 9,1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><polyline points="6,5 8.5,8 14,1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`
      : html`<svg class="sr-chat-tick sent" width="10" height="9" viewBox="0 0 10 9" fill="none" aria-label="Sent"><polyline points="1,5 3.5,8 9,1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }

  private _renderMessage(msg: ChatMessage): TemplateResult {
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
          : html`${timeMeta}${this._tick(msg.isRead)}`}
        ${msg.status === 'failed' ? html`
          <button class="sr-chat-retry" @click="${() => this._retry(msg)}">
            Failed to send · Tap to retry
          </button>
        ` : ''}
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

    return html`
      <div class="sr-chat-messages" role="log" aria-live="polite" aria-label="Chat messages"
           @scroll="${this._onMessagesScroll}">
        ${this.isAgentTyping ? html`
          <div class="sr-chat-typing" aria-label="Agent is typing">
            <span class="sr-chat-typing-dot"></span>
            <span class="sr-chat-typing-dot"></span>
            <span class="sr-chat-typing-dot"></span>
          </div>
        ` : ''}
        ${repeat([...this.messages].reverse(), m => m.id, m => this._renderMessage(m))}
        ${this.hasMoreHistory ? html`
          <div class="sr-chat-load-more">
            ${this.isLoadingHistory
              ? html`<span class="sr-chat-load-more-spinner"></span>`
              : html`<button class="sr-chat-load-more-btn" @click="${this._loadMoreMessages}">Load earlier messages</button>`}
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

        <div class="sr-chat-body">
          ${this._renderMessages()}
          ${this._newMsgPending ? html`
            <button class="sr-chat-new-msg-btn" @click="${this._jumpToBottom}" aria-label="Jump to new message">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
              New message
            </button>
          ` : ''}
        </div>

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
                  class="sr-chat-email-input ${this.emailInvalid ? 'invalid' : ''}"
                  type="email"
                  placeholder="Your email (optional)"
                  .value="${this.emailValue}"
                  @input="${(e: Event) => { this.emailValue = (e.target as HTMLInputElement).value; this.emailInvalid = false; }}"
                  autocomplete="email"
                  aria-label="Your email address"
                />
              </div>
            ` : this.showEmailNudge ? html`
              <div class="sr-chat-email-nudge">
                ${this.emailNudgeExpanded ? html`
                  <div class="sr-chat-email-nudge-form">
                    <input
                      class="sr-chat-email-input ${this.emailInvalid ? 'invalid' : ''}"
                      type="email"
                      placeholder="your@email.com"
                      .value="${this.emailValue}"
                      @input="${(e: Event) => { this.emailValue = (e.target as HTMLInputElement).value; this.emailInvalid = false; }}"
                      @keydown="${(e: KeyboardEvent) => { if (e.key === 'Enter') this._submitEmail(); }}"
                      autocomplete="email"
                      aria-label="Your email address"
                    />
                    <button
                      class="sr-chat-email-nudge-save"
                      ?disabled="${!this.emailValue.trim() || this.emailNudgeSubmitting}"
                      @click="${this._submitEmail}"
                    >${this.emailNudgeSubmitting ? '…' : 'Save'}</button>
                    <button class="sr-chat-email-nudge-dismiss" @click="${() => { this.emailNudgeExpanded = false; }}" aria-label="Cancel">×</button>
                  </div>
                ` : html`
                  <button class="sr-chat-email-nudge-link" @click="${() => { this.emailNudgeExpanded = true; }}">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                    Get notified by email if you miss our reply →
                  </button>
                `}
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
                ?disabled="${this.rateLimited}"
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
