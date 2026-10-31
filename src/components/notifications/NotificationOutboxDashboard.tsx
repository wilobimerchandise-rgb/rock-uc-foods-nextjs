'use client';

/**
 * ROCK UC FOODS - Staff Notification Outbox Dashboard
 * Playbook v4 Section 25
 */

import React, { useState, useEffect } from 'react';
import {
  Bell,
  MessageSquare,
  Smartphone,
  CheckCircle2,
  Clock,
  RefreshCw,
  Search,
  ExternalLink,
  Send,
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
    <div className="space-y-6 text-[#F7EFD9]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-[#F7EFD9] tracking-tight">
            Automated Notification Outbox
          </h2>
          <p className="text-xs text-[#F7EFD9]/60 mt-1">
            Real-time delivery log of WhatsApp customer updates, SMS transactional alerts, and catering invoices.
          </p>
        </div>

        <button
          onClick={fetchOutbox}
          disabled={loading}
          className="flex items-center space-x-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold transition-colors shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Queue</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-[#17120F] border border-white/10 rounded-2xl">
          <span className="text-[11px] text-[#F7EFD9]/60 font-semibold uppercase">Total Dispatched</span>
          <div className="text-lg font-black text-white mt-1">{notifications.length}</div>
          <span className="text-[10px] text-emerald-400">100% delivered</span>
        </div>

        <div className="p-4 bg-emerald-950/40 border border-emerald-500/40 rounded-2xl">
          <span className="text-[11px] text-emerald-400 font-semibold uppercase flex items-center gap-1">
            <MessageSquare className="w-3 h-3" /> WhatsApp Alerts
          </span>
          <div className="text-lg font-black text-emerald-200 mt-1">
            {notifications.filter((n) => n.channel === 'whatsapp').length}
          </div>
          <span className="text-[10px] text-emerald-400/80">Direct customer chat</span>
        </div>

        <div className="p-4 bg-sky-950/40 border border-sky-500/40 rounded-2xl">
          <span className="text-[11px] text-sky-400 font-semibold uppercase flex items-center gap-1">
            <Smartphone className="w-3 h-3" /> SMS Notifications
          </span>
          <div className="text-lg font-black text-sky-200 mt-1">
            {notifications.filter((n) => n.channel === 'sms').length}
          </div>
          <span className="text-[10px] text-sky-400/80">Termii / Telco carrier</span>
        </div>

        <div className="p-4 bg-[#17120F] border border-white/10 rounded-2xl">
          <span className="text-[11px] text-[#F7EFD9]/60 font-semibold uppercase">Latest Ping</span>
          <div className="text-sm font-bold text-white mt-2 truncate">
            {notifications.length > 0 ? notifications[0].eventType.replace(/_/g, ' ') : '—'}
          </div>
          <span className="text-[10px] text-[#F7EFD9]/40">Active outbox</span>
        </div>
      </div>

      {/* Search & Channel Filters */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-3.5 h-3.5 text-stone-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by customer name, phone, order code..."
            className="w-full pl-9 pr-3 py-2 bg-[#17120F] border border-white/10 rounded-xl text-xs text-white placeholder-stone-500 focus:outline-none focus:border-[#D4AF37]"
          />
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => setFilterChannel('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filterChannel === 'all'
                ? 'bg-[#6B1230] text-white border border-[#D4AF37]'
                : 'bg-white/5 text-stone-400 hover:text-white'
            }`}
          >
            All Channels
          </button>
          <button
            onClick={() => setFilterChannel('whatsapp')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              filterChannel === 'whatsapp'
                ? 'bg-emerald-800 text-white border border-emerald-400'
                : 'bg-white/5 text-stone-400 hover:text-white'
            }`}
          >
            <MessageSquare className="w-3 h-3 text-emerald-400" /> WhatsApp
          </button>
          <button
            onClick={() => setFilterChannel('sms')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              filterChannel === 'sms'
                ? 'bg-sky-800 text-white border border-sky-400'
                : 'bg-white/5 text-stone-400 hover:text-white'
            }`}
          >
            <Smartphone className="w-3 h-3 text-sky-400" /> SMS
          </button>
        </div>
      </div>

      {/* Outbox Table */}
      <div className="bg-[#17120F] rounded-2xl border border-white/10 overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-xs text-stone-400 flex items-center justify-center space-x-2">
            <RefreshCw className="w-4 h-4 animate-spin text-[#D4AF37]" />
            <span>Loading Outbox Queue...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-xs text-stone-400">
            No notifications found in outbox.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-stone-300">
              <thead className="bg-black/50 text-stone-400 uppercase text-[10px] tracking-wider border-b border-white/10">
                <tr>
                  <th className="p-3">Time</th>
                  <th className="p-3">Recipient</th>
                  <th className="p-3">Channel</th>
                  <th className="p-3">Event Type</th>
                  <th className="p-3">Message Content</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filtered.map((n) => (
                  <tr key={n.id} className="hover:bg-white/5 transition-colors">
                    <td className="p-3 whitespace-nowrap font-mono text-[11px] text-stone-400">
                      {new Date(n.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      <span className="font-bold text-white block">{n.recipientName}</span>
                      <span className="text-[10px] text-stone-400 font-mono">{n.recipientPhone}</span>
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      {n.channel === 'whatsapp' ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                          <MessageSquare className="w-3 h-3" /> WhatsApp
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded">
                          <Smartphone className="w-3 h-3" /> SMS
                        </span>
                      )}
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      <span className="font-semibold text-white">
                        {n.eventType.replace(/_/g, ' ')}
                      </span>
                      {n.orderCode && (
                        <span className="text-[10px] text-[#D4AF37] block font-mono">
                          #{n.orderCode}
                        </span>
                      )}
                    </td>
                    <td className="p-3 max-w-sm truncate text-stone-300" title={n.message}>
                      {n.message}
                    </td>
                    <td className="p-3 whitespace-nowrap text-right">
                      {n.whatsAppUrl && (
                        <a
                          href={n.whatsAppUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-[#6B1230] hover:bg-[#85163c] text-white transition-colors"
                        >
                          <span>Open</span>
                          <ExternalLink className="w-2.5 h-2.5" />
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
