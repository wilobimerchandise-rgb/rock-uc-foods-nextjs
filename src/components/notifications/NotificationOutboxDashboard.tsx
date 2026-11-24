'use client';

/**
 * ROCK UC FOODS - Staff Notification Outbox Dashboard
 * Playbook v4 Section 25 & Section 35
 */

import React, { useState, useEffect } from 'react';
import {
  MessageSquare,
  Smartphone,
  RefreshCw,
  Search,
  ExternalLink,
} from 'lucide-react';
import { NotificationMessage } from '../../types/notification';

export function NotificationOutboxDashboard() {
  const [notifications, setNotifications] = useState<NotificationMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterChannel, setFilterChannel] = useState<'all' | 'whatsapp' | 'sms'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchOutbox = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/notifications');
      const data = await res.json();
      if (res.ok) {
        setNotifications(data.notifications || []);
      }
    } catch {
      // Offline fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let ignore = false;
    fetch('/api/notifications')
      .then((res) => res.json())
      .then((data) => {
        if (!ignore) {
          setNotifications(data.notifications || []);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, []);

  const filtered = notifications.filter((n) => {
    if (filterChannel !== 'all' && n.channel !== filterChannel) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        n.recipientName.toLowerCase().includes(q) ||
        n.recipientPhone.includes(q) ||
        (n.orderCode && n.orderCode.toLowerCase().includes(q)) ||
        n.message.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6 text-[var(--text-primary)] min-w-0 max-w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[var(--border-subtle-card)]">
        <div className="min-w-0">
          <h2 className="text-xl md:text-2xl font-black text-[var(--text-primary)] tracking-tight">
            Automated Notification Outbox
          </h2>
          <p className="text-sm text-[var(--text-body-muted)] mt-1">
            Real-time delivery log of WhatsApp customer updates, SMS transactional alerts, and catering invoices.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchOutbox}
          disabled={loading}
          className="min-h-[44px] inline-flex items-center justify-center space-x-2 px-4 py-2 bg-[var(--bg-card)] hover:border-[var(--border-gold)] border border-[var(--border-card)] text-[var(--text-primary)] rounded-xl text-sm font-semibold transition-colors shrink-0"
        >
          <RefreshCw className={`w-4 h-4 text-[var(--text-accent)] ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Queue</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-[var(--bg-card)] border border-[var(--border-subtle-card)] rounded-2xl">
          <span className="text-sm text-[var(--text-body-muted)] font-semibold uppercase block">
            Total Dispatched
          </span>
          <div className="text-2xl font-black text-[var(--text-primary)] price-tabular mt-1">
            {notifications.length}
          </div>
          <span className="text-sm text-[var(--text-money-positive)] font-medium">
            Outbox records logged
          </span>
        </div>

        <div className="p-4 bg-[var(--status-success-bg)] border border-[var(--status-success-border)] rounded-2xl">
          <span className="text-sm text-[var(--status-success-text)] font-semibold uppercase flex items-center gap-1.5">
            <MessageSquare className="w-4 h-4 shrink-0" /> WhatsApp Alerts
          </span>
          <div className="text-2xl font-black text-[var(--status-success-text)] price-tabular mt-1">
            {notifications.filter((n) => n.channel === 'whatsapp').length}
          </div>
          <span className="text-sm text-[var(--status-success-text)] opacity-90">
            Direct customer chat
          </span>
        </div>

        <div className="p-4 bg-[var(--status-info-bg)] border border-[var(--status-info-border)] rounded-2xl">
          <span className="text-sm text-[var(--status-info-text)] font-semibold uppercase flex items-center gap-1.5">
            <Smartphone className="w-4 h-4 shrink-0" /> SMS Notifications
          </span>
          <div className="text-2xl font-black text-[var(--status-info-text)] price-tabular mt-1">
            {notifications.filter((n) => n.channel === 'sms').length}
          </div>
          <span className="text-sm text-[var(--status-info-text)] opacity-90">
            Termii / Telco carrier
          </span>
        </div>

        <div className="p-4 bg-[var(--bg-card)] border border-[var(--border-subtle-card)] rounded-2xl min-w-0">
          <span className="text-sm text-[var(--text-body-muted)] font-semibold uppercase block">
            Latest Ping
          </span>
          <div className="text-base font-bold text-[var(--text-primary)] mt-1 truncate">
            {notifications.length > 0 ? notifications[0].eventType.replace(/_/g, ' ') : '—'}
          </div>
          <span className="text-sm text-[var(--text-body-muted)]">Active outbox</span>
        </div>
      </div>

      {/* Search & Channel Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 min-w-0">
        <div className="relative flex-1 min-w-0">
          <Search className="w-4 h-4 text-[var(--text-body-muted)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            aria-label="Search notifications"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by customer name, phone, order code..."
            className="w-full min-h-[44px] pl-10 pr-3 py-2 bg-[var(--bg-card)] border border-[var(--border-card)] rounded-xl text-sm text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none focus:border-[var(--border-gold)]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setFilterChannel('all')}
            className={`min-h-[44px] px-4 py-2 rounded-xl text-sm font-semibold transition-all border ${
              filterChannel === 'all'
                ? 'bg-[#6B1230] text-[#F7EFD9] border-[#D4AF37]'
                : 'bg-[var(--bg-card)] text-[var(--text-body-muted)] border-[var(--border-subtle-card)] hover:text-[var(--text-primary)]'
            }`}
          >
            All Channels
          </button>
          <button
            type="button"
            onClick={() => setFilterChannel('whatsapp')}
            className={`min-h-[44px] px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-1.5 border ${
              filterChannel === 'whatsapp'
                ? 'bg-[var(--status-success-bg)] text-[var(--status-success-text)] border-[var(--status-success-border)]'
                : 'bg-[var(--bg-card)] text-[var(--text-body-muted)] border-[var(--border-subtle-card)] hover:text-[var(--text-primary)]'
            }`}
          >
            <MessageSquare className="w-4 h-4 shrink-0" /> WhatsApp
          </button>
          <button
            type="button"
            onClick={() => setFilterChannel('sms')}
            className={`min-h-[44px] px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-1.5 border ${
              filterChannel === 'sms'
                ? 'bg-[var(--status-info-bg)] text-[var(--status-info-text)] border-[var(--status-info-border)]'
                : 'bg-[var(--bg-card)] text-[var(--text-body-muted)] border-[var(--border-subtle-card)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Smartphone className="w-4 h-4 shrink-0" /> SMS
          </button>
        </div>
      </div>

      {/* Outbox Table */}
      <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-subtle-card)] overflow-hidden min-w-0">
        {loading ? (
          <div className="py-12 text-center text-sm text-[var(--text-body-muted)] flex items-center justify-center space-x-2">
            <RefreshCw className="w-4 h-4 animate-spin text-[var(--text-accent)]" />
            <span>Loading Outbox Queue...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-sm text-[var(--text-body-muted)]">
            No notifications found in outbox.
          </div>
        ) : (
          <div className="overflow-x-auto max-w-full">
            <table className="w-full text-left text-sm text-[var(--text-primary)]">
              <thead className="bg-[var(--bg-surface-muted)] text-[var(--text-body-muted)] uppercase text-sm tracking-wider border-b border-[var(--border-subtle-card)]">
                <tr>
                  <th className="p-3.5">Time</th>
                  <th className="p-3.5">Recipient</th>
                  <th className="p-3.5">Channel</th>
                  <th className="p-3.5">Event Type</th>
                  <th className="p-3.5">Message Content</th>
                  <th className="p-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle-card)]">
                {filtered.map((n) => (
                  <tr key={n.id} className="hover:bg-[var(--bg-surface-muted)]/60 transition-colors">
                    <td className="p-3.5 whitespace-nowrap font-mono text-sm price-tabular text-[var(--text-body-muted)]">
                      {new Date(n.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </td>
                    <td className="p-3.5 whitespace-nowrap">
                      <span className="font-bold text-[var(--text-primary)] block">
                        {n.recipientName}
                      </span>
                      <span className="text-sm text-[var(--text-body-muted)] font-mono price-tabular">
                        {n.recipientPhone}
                      </span>
                    </td>
                    <td className="p-3.5 whitespace-nowrap">
                      {n.channel === 'whatsapp' ? (
                        <span className="inline-flex items-center gap-1.5 text-sm font-bold text-[var(--status-success-text)] bg-[var(--status-success-bg)] border border-[var(--status-success-border)] px-2.5 py-0.5 rounded-md">
                          <MessageSquare className="w-3.5 h-3.5 shrink-0" /> WhatsApp
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-sm font-bold text-[var(--status-info-text)] bg-[var(--status-info-bg)] border border-[var(--status-info-border)] px-2.5 py-0.5 rounded-md">
                          <Smartphone className="w-3.5 h-3.5 shrink-0" /> SMS
                        </span>
                      )}
                    </td>
                    <td className="p-3.5 whitespace-nowrap">
                      <span className="font-semibold text-[var(--text-primary)]">
                        {n.eventType.replace(/_/g, ' ')}
                      </span>
                      {n.orderCode && (
                        <span className="text-sm text-[var(--text-accent)] block font-mono">
                          #{n.orderCode}
                        </span>
                      )}
                    </td>
                    <td className="p-3.5 max-w-sm truncate text-[var(--text-body-muted)]" title={n.message}>
                      {n.message}
                    </td>
                    <td className="p-3.5 whitespace-nowrap text-right">
                      {n.whatsAppUrl && (
                        <a
                          href={n.whatsAppUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-bold bg-[#6B1230] hover:bg-[#85163c] text-[#F7EFD9] border border-[#D4AF37]/40 transition-colors"
                        >
                          <span>Open</span>
                          <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
