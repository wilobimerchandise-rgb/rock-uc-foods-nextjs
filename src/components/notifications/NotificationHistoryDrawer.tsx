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
}

export function NotificationHistoryDrawer({ orderId }: NotificationHistoryProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationMessage[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let ignore = false;
    if (isOpen && orderId) {
      fetch(`/api/notifications?orderId=${encodeURIComponent(orderId)}`)
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
    }
    return () => {
      ignore = true;
    };
  }, [isOpen, orderId]);

  return (
    <div className="bg-[#17120F] border border-white/10 rounded-2xl overflow-hidden text-[#F7EFD9]">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors text-left"
      >
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-[#6B1230] border border-[#D4AF37]/50 flex items-center justify-center shrink-0">
            <Bell className="w-4 h-4 text-[#D4AF37]" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white flex items-center gap-2">
              <span>Automated WhatsApp &amp; SMS Alerts</span>
              {notifications.length > 0 && (
                <span className="px-1.5 py-0.2 bg-[#D4AF37]/20 text-[#D4AF37] rounded-full text-[10px]">
                  {notifications.length}
                </span>
              )}
            </h4>
            <p className="text-[10px] text-stone-400">
              Live outbox records dispatched for this order.
            </p>
          </div>
        </div>

        {isOpen ? (
          <ChevronUp className="w-4 h-4 text-stone-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-stone-400" />
        )}
      </button>

      {isOpen && (
        <div className="p-4 pt-0 border-t border-white/5 space-y-3">
          {loading ? (
            <div className="py-4 text-center text-xs text-stone-400 flex items-center justify-center space-x-2">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#D4AF37]" />
              <span>Fetching notification history...</span>
            </div>
          ) : notifications.length === 0 ? (
            <div className="py-4 text-center text-xs text-stone-400">
              No notifications dispatched yet for this order.
            </div>
          ) : (
            <div className="space-y-2.5">
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className="p-3 bg-black/40 border border-white/10 rounded-xl space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[#D4AF37]">
                      {n.channel === 'whatsapp' ? (
                        <>
                          <MessageSquare className="w-3 h-3 text-emerald-400" /> WhatsApp
                        </>
                      ) : (
                        <>
                          <Smartphone className="w-3 h-3 text-sky-400" /> SMS
                        </>
                      )}
                      <span>• {n.eventType.replace(/_/g, ' ')}</span>
                    </span>

                    <span className="text-[10px] text-stone-500 flex items-center gap-1 font-mono">
                      <Clock className="w-2.5 h-2.5" />
                      {new Date(n.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  <p className="text-stone-300 font-sans text-[11px] leading-relaxed whitespace-pre-line">
                    {n.message}
                  </p>

                  {n.whatsAppUrl && (
                    <div className="pt-1 flex items-center justify-end">
                      <a
                        href={n.whatsAppUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 border border-emerald-500/40 transition-colors"
                      >
                        <MessageSquare className="w-3 h-3" />
                        <span>Open in WhatsApp</span>
                        <ExternalLink className="w-2.5 h-2.5 ml-0.5 opacity-60" />
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
