'use client';

/**
 * ROCK UC FOODS - Customer AI Assistant Widget
 * Playbook v2 Section 19.2, 32 & 35
 *
 * - Native Popover API (`popover="auto"`) for top-layer panel, Escape dismissal, light dismiss, and native focus return
 * - Styled exclusively via CSS custom properties in app/globals.css (zero hex literals)
 * - Polite live region (`aria-live="polite"`) with strict React text rendering (never HTML)
 * - `AbortController` on every fetch (aborts prior request on new send and aborts on unmount)
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MessageSquare, X, Send, ExternalLink, Bot, AlertCircle } from 'lucide-react';
import { AssistantReply } from '../assistant/types';
import { BUSINESS_CONTACT } from '../policy/content';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  reply: AssistantReply;
}

export interface AssistantWidgetProps {
  initialMessages?: ChatMessage[];
  initialLoading?: boolean;
  initialError?: string | null;
}

export const ASSISTANT_PANEL_ID = 'ruc-assistant-panel';
const ASSISTANT_TITLE_ID = 'ruc-assistant-title';
const MAX_INPUT_CHARS = 500;

const DEFAULT_WELCOME_MESSAGE: ChatMessage = {
  id: 'welcome',
  sender: 'assistant',
  reply: {
    kind: 'answer',
    text: 'Welcome to ROCK UC FOODS! How can I assist you with our luxury menu, ordering, or catering inquiries today?',
  },
};

export function isSafeInternalLink(url?: string): url is string {
  return typeof url === 'string' && url.startsWith('/') && !url.startsWith('//');
}

export interface AssistantRequestController {
  abortCurrent: () => void;
  send: (
    query: string,
    fetchImpl?: typeof fetch
  ) => Promise<{ aborted: true } | { aborted: false; reply: AssistantReply; ok: boolean }>;
}

export function createAssistantRequestController(): AssistantRequestController {
  let activeController: AbortController | null = null;

  const abortCurrent = () => {
    if (activeController) {
      activeController.abort();
      activeController = null;
    }
  };

  const send: AssistantRequestController['send'] = async (query, fetchImpl = fetch) => {
    abortCurrent();
    const controller = new AbortController();
    activeController = controller;

    try {
      const res = await fetchImpl('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: query }),
        signal: controller.signal,
      });

      const data = (await res.json()) as Partial<AssistantReply> | null;
      if (controller.signal.aborted) {
        return { aborted: true };
      }

      if (data && typeof data.text === 'string' && typeof data.kind === 'string') {
        return {
          aborted: false,
          ok: res.ok,
          reply: data as AssistantReply,
        };
      }

      return {
        aborted: false,
        ok: false,
        reply: {
          kind: 'unavailable',
          text: `Our assistant service is temporarily unreachable. Please contact us on WhatsApp at ${BUSINESS_CONTACT.phone}.`,
          whatsappUrl: BUSINESS_CONTACT.whatsappUrl,
        },
      };
    } catch (error) {
      if (
        controller.signal.aborted ||
        (typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError')
      ) {
        return { aborted: true };
      }

      return {
        aborted: false,
        ok: false,
        reply: {
          kind: 'unavailable',
          text: `Our assistant service is temporarily unreachable. Please contact us on WhatsApp at ${BUSINESS_CONTACT.phone}.`,
          whatsappUrl: BUSINESS_CONTACT.whatsappUrl,
        },
      };
    } finally {
      if (activeController === controller) {
        activeController = null;
      }
    }
  };

  return { abortCurrent, send };
}

export function AssistantWidget({
  initialMessages,
  initialLoading = false,
  initialError = null,
}: AssistantWidgetProps = {}) {
  const pathname = usePathname();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(initialLoading);
  const [errorMessage, setErrorMessage] = useState<string | null>(initialError);
  const [messages, setMessages] = useState<ChatMessage[]>(
    initialMessages ?? [DEFAULT_WELCOME_MESSAGE]
  );

  const panelRef = useRef<HTMLElement>(null);
  const fabRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const requestControllerRef = useRef<AssistantRequestController | null>(null);
  const inFlightRef = useRef(initialLoading);
  const wasLoadingRef = useRef(initialLoading);

  const getRequestController = useCallback((): AssistantRequestController => {
    if (requestControllerRef.current == null) {
      requestControllerRef.current = createAssistantRequestController();
    }
    return requestControllerRef.current;
  }, []);

  const scrollToLatest = useCallback(() => {
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    messagesEndRef.current?.scrollIntoView({
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
    });
  }, []);

  useEffect(() => {
    scrollToLatest();
  }, [messages, scrollToLatest]);

  useEffect(() => {
    if (wasLoadingRef.current && !loading) {
      if (panelRef.current?.matches(':popover-open')) {
        inputRef.current?.focus();
      }
    }
    wasLoadingRef.current = loading;
  }, [loading]);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;

    const handleNativeToggle = (event: Event) => {
      const toggleEvent = event as Event & { newState?: string };
      if (toggleEvent.newState === 'open') {
        scrollToLatest();
        inputRef.current?.focus();
      } else if (toggleEvent.newState === 'closed') {
        const active = document.activeElement;
        if (!active || active === document.body || active === document.documentElement || panel.contains(active)) {
          fabRef.current?.focus();
        }
      }
    };

    panel.addEventListener('toggle', handleNativeToggle);
    return () => {
      panel.removeEventListener('toggle', handleNativeToggle);
    };
  }, [scrollToLatest]);

  useEffect(() => {
    return () => {
      requestControllerRef.current?.abortCurrent();
      inFlightRef.current = false;
    };
  }, []);

  const isSuppressed =
    Boolean(pathname) &&
    (pathname === '/login' ||
      pathname.startsWith('/login/') ||
      pathname === '/admin' ||
      pathname.startsWith('/admin/'));

  if (isSuppressed) {
    return null;
  }

  const closeNativePopover = () => {
    const el = panelRef.current as (HTMLElement & { hidePopover?: () => void }) | null;
    if (el && typeof el.hidePopover === 'function') {
      try {
        el.hidePopover();
      } catch {
        // Ignore if popover is already closed
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (inFlightRef.current || loading) return;

    const query = input.trim();
    if (!query) {
      setErrorMessage('Please type a question before sending.');
      return;
    }

    inFlightRef.current = true;
    setErrorMessage(null);
    setLoading(true);
    setInput('');

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      sender: 'user',
      reply: { kind: 'answer', text: query },
    };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const outcome = await getRequestController().send(query);
      if (outcome.aborted) {
        return;
      }

      if (!outcome.ok && outcome.reply.kind === 'unavailable') {
        setErrorMessage('Assistant response could not be completed. Use WhatsApp below for immediate help.');
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          sender: 'assistant',
          reply: outcome.reply,
        },
      ]);
    } finally {
      inFlightRef.current = false;
      setLoading(false);
    }
  };

  return (
    <div className="fixed z-50 pointer-events-none bottom-[calc(72px+env(safe-area-inset-bottom,0px))] md:bottom-[calc(1.25rem+env(safe-area-inset-bottom,0px))] right-[calc(1rem+env(safe-area-inset-right,0px))] md:right-[calc(1.25rem+env(safe-area-inset-right,0px))]">
      {/* Native Popover Trigger Button */}
      <button
        ref={fabRef}
        type="button"
        popoverTarget={ASSISTANT_PANEL_ID}
        popoverTargetAction="toggle"
        aria-label="Open chat with our AI assistant"
        aria-controls={ASSISTANT_PANEL_ID}
        data-testid="floating-assistant-button"
        className="ruc-assistant-fab pointer-events-auto flex items-center justify-center w-14 h-14 min-w-[44px] min-h-[44px] rounded-full shadow-2xl"
      >
        <MessageSquare className="w-6 h-6" aria-hidden="true" />
      </button>

      {/* Native Auto Popover Chat Panel (handles Escape-to-close, light dismiss, and focus return natively) */}
      <section
        ref={panelRef}
        id={ASSISTANT_PANEL_ID}
        popover="auto"
        role="dialog"
        aria-modal="false"
        aria-labelledby={ASSISTANT_TITLE_ID}
        data-testid="assistant-panel"
        className="ruc-assistant-panel pointer-events-auto"
      >
        {/* Header */}
        <header className="ruc-assistant-header">
          <div className="flex items-center gap-2 min-w-0">
            <Bot className="w-5 h-5 ruc-assistant-header-icon" aria-hidden="true" />
            <div className="min-w-0">
              <h3 id={ASSISTANT_TITLE_ID} className="ruc-assistant-title tracking-wide">
                ROCK UC FOODS assistant
              </h3>
              <p className="ruc-assistant-subtitle">AI assistant, not a person</p>
            </div>
          </div>
          <button
            type="button"
            popoverTarget={ASSISTANT_PANEL_ID}
            popoverTargetAction="hide"
            aria-label="Close assistant chat"
            data-testid="assistant-close-button"
            className="ruc-assistant-close"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </header>

        {/* Accessible Polite Live Region for Messages */}
        <div
          role="log"
          aria-live="polite"
          aria-relevant="additions text"
          aria-label="Assistant messages"
          data-testid="assistant-messages"
          className="ruc-assistant-messages"
        >
          {messages.length === 0 && (
            <p className="ruc-assistant-empty" data-testid="assistant-empty-state">
              Ask a question about our menu, pricing, or catering.
            </p>
          )}

          {messages.map((m) => {
            const isAssistant = m.sender === 'assistant';
            const showWhatsapp = isAssistant && m.reply.kind !== 'answer';
            const showInternalLink = isAssistant && isSafeInternalLink(m.reply.linkUrl);

            return (
              <div
                key={m.id}
                className={`flex flex-col ${isAssistant ? 'items-start' : 'items-end'}`}
              >
                <div
                  className={
                    isAssistant ? 'ruc-assistant-bubble-assistant' : 'ruc-assistant-bubble-user'
                  }
                >
                  <p className="whitespace-pre-wrap break-words">{m.reply.text}</p>

                  {showInternalLink && (
                    <div className="ruc-assistant-divider">
                      <Link
                        href={m.reply.linkUrl!}
                        onClick={closeNativePopover}
                        data-testid="assistant-estimator-link"
                        className="ruc-assistant-cta-gold"
                      >
                        <span>{m.reply.linkLabel || 'Open link'}</span>
                      </Link>
                    </div>
                  )}

                  {showWhatsapp && (
                    <div className="ruc-assistant-divider">
                      <a
                        href={m.reply.whatsappUrl || BUSINESS_CONTACT.whatsappUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        data-testid="assistant-whatsapp-link"
                        className="ruc-assistant-whatsapp"
                      >
                        <span>Chat on WhatsApp ({BUSINESS_CONTACT.phone})</span>
                        <ExternalLink className="w-4 h-4 shrink-0" aria-hidden="true" />
                      </a>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {loading && (
            <div className="ruc-assistant-loading" role="status" data-testid="assistant-loading">
              <Bot className="w-4 h-4 ruc-assistant-spinner" aria-hidden="true" />
              <span>Assistant is drafting a response...</span>
            </div>
          )}

          {errorMessage && (
            <div className="ruc-assistant-error" role="alert" data-testid="assistant-error">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="ruc-assistant-form" noValidate>
          <label htmlFor="assistant-input" className="sr-only">
            Ask our AI assistant a question
          </label>
          <input
            ref={inputRef}
            id="assistant-input"
            type="text"
            maxLength={MAX_INPUT_CHARS}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              if (errorMessage) setErrorMessage(null);
            }}
            placeholder="Ask about dishes, pricing, or catering..."
            disabled={loading}
            className="ruc-assistant-input"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            aria-label="Send message to AI assistant"
            data-testid="assistant-send-button"
            className="ruc-assistant-send"
          >
            <Send className="w-4 h-4 ruc-assistant-send-icon" aria-hidden="true" />
          </button>
        </form>
      </section>
    </div>
  );
}

