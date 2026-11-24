'use client';

/**
 * ROCK UC FOODS - Order Notification History Drawer
 * Playbook v4 Section 25
 */

import React, { useState, useEffect } from 'react';
import {
  Bell,
  MessageSquare,
  Smartphone,
  ExternalLink,
  Clock,
  CheckCircle2,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { NotificationMessage } from '../../types/notification';

interface NotificationHistoryProps {
  orderId: string;
  orderToken?: string;
}

export function NotificationHistoryDrawer({ orderId, orderToken }: NotificationHistoryProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationMessage[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let ignore = false;
    if (isOpen && orderId) {
      const urlToken =
        orderToken ||
        (typeof window !== 'undefined'
          ? new URLSearchParams(window.location.search).get('token')?.trim() || ''
          : '');
      const query = `orderId=${encodeURIComponent(orderId)}${
        urlToken ? `&token=${encodeURIComponent(urlToken)}` : ''
      }`;
      fetch(`/api/notifications?${query}`)
        .then((res) => (res.ok ? res.json() : { notifications: [] }))
        .then((data) => {
          if (!ignore) {
            setNotifications(data.notifications || []);
          }
        })
        .catch(() => {})
        .finally(() => {
          if (!ignore) setLoading(false);
        });
    }
    return () => {
      ignore = true;
    };
  }, [isOpen, orderId, orderToken]);

  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-2xl overflow-hidden text-[var(--text-primary)]">
      <button
        type="button"
        onClick={() => {
          const nextOpen = !isOpen;
          if (nextOpen && orderId) setLoading(true);
          setIsOpen(nextOpen);
        }}
        aria-expanded={isOpen}
        className="w-full min-h-[44px] p-4 flex items-center justify-between hover:bg-[var(--bg-surface-muted)] transition-colors text-left focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]"
      >
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-lg bg-[var(--cta-wine-bg)] border border-[var(--border-gold)] flex items-center justify-center shrink-0">
            <Bell className="w-4 h-4 text-[var(--gold-light)]" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2 flex-wrap">
              <span>Automated WhatsApp &amp; SMS Alerts</span>
              {notifications.length > 0 && (
                <span className="px-2 py-0.5 bg-[var(--status-neutral-bg)] border border-[var(--status-neutral-border)] text-[var(--status-neutral-text)] rounded-md text-sm font-semibold price-tabular">
                  {notifications.length}
                </span>
              )}
            </h4>
            <p className="text-sm text-[var(--text-body-muted)]">
              Live outbox records dispatched for this order.
            </p>
          </div>
        </div>

        {isOpen ? (
          <ChevronUp className="w-5 h-5 text-[var(--text-body-muted)] shrink-0" />
        ) : (
          <ChevronDown className="w-5 h-5 text-[var(--text-body-muted)] shrink-0" />
        )}
      </button>

      {isOpen && (
        <div className="p-4 pt-3 border-t border-[var(--border-subtle-card)] space-y-3">
          {loading ? (
            <div className="py-4 text-center text-sm text-[var(--text-body-muted)] flex items-center justify-center space-x-2">
              <RefreshCw className="w-4 h-4 animate-spin text-[var(--text-accent)]" />
              <span>Fetching notification history...</span>
            </div>
          ) : notifications.length === 0 ? (
            <div className="py-4 text-center text-sm text-[var(--text-body-muted)]">
              No notifications dispatched yet for this order.
            </div>
          ) : (
            <div className="space-y-2.5">
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className="p-3 bg-[var(--bg-surface-muted)] border border-[var(--border-subtle-card)] rounded-xl space-y-2 text-sm"
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1.5 text-sm font-bold uppercase tracking-wider text-[var(--text-accent)]">
                      {n.channel === 'whatsapp' ? (
                        <>
                          <MessageSquare className="w-4 h-4 text-[var(--status-success-text)]" /> WhatsApp
                        </>
                      ) : (
                        <>
                          <Smartphone className="w-4 h-4 text-[var(--status-info-text)]" /> SMS
                        </>
                      )}
                      <span>&bull; {n.eventType.replace(/_/g, ' ')}</span>
                    </span>

                    <span className="text-sm text-[var(--text-body-muted)] flex items-center gap-1 font-mono price-tabular">
                      <Clock className="w-3.5 h-3.5" />
                      {new Date(n.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  <p className="text-[var(--text-primary)] font-sans text-sm leading-relaxed whitespace-pre-line">
                    {n.message}
                  </p>

                  {n.whatsAppUrl && (
                    <div className="pt-1 flex items-center justify-end">
                      <a
                        href={n.whatsAppUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="min-h-[44px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-bold bg-[var(--status-success-bg)] hover:opacity-90 text-[var(--status-success-text)] border border-[var(--status-success-border)] transition-opacity"
                      >
                        <MessageSquare className="w-4 h-4 shrink-0" />
                        <span>Open in WhatsApp</span>
                        <ExternalLink className="w-3.5 h-3.5 ml-0.5 shrink-0" />
                      </a>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
