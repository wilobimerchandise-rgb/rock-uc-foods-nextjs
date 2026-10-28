'use client';

/**
 * ROCK UC FOODS - Customer AI Assistant Widget
 * Playbook v4 Section 19.2
 * 
 * Rules:
 * - Button aria-label: 'Open chat with our AI assistant'
 * - Panel titled 'ROCK UC FOODS assistant' with subtext 'AI assistant, not a person'
 * - Labelled input, maxLength 500
 * - Text rendered strictly as React text (zero raw HTML injection risk)
 * - Shows a WhatsApp link on every reply that is not a plain answer
 */

import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, ExternalLink, Bot, User } from 'lucide-react';
import { AssistantReply } from '../assistant/types';
import { BUSINESS_CONTACT } from '../policy/content';

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  reply: AssistantReply;
}

export function AssistantWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      reply: {
        kind: 'answer',
        text: 'Welcome to ROCK UC FOODS! How can I assist you with our luxury menu, ordering, or catering inquiries today?',
      },
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = input.trim();
    if (!query || loading) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      sender: 'user',
      reply: { kind: 'answer', text: query },
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: query }),
      });

      const data: AssistantReply = await res.json();
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          sender: 'assistant',
          reply: data,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sender: 'assistant',
          reply: {
            kind: 'unavailable',
            text: `Our assistant service is temporarily unreachable. Please contact us on WhatsApp at ${BUSINESS_CONTACT.phone}.`,
            whatsappUrl: BUSINESS_CONTACT.whatsappUrl,
          },
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Floating Action Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          aria-label="Open chat with our AI assistant"
          className="flex items-center justify-center w-14 h-14 rounded-full bg-[#6B1230] text-[#F7EFD9] shadow-2xl border-2 border-[#D4AF37] hover:scale-105 transition-all duration-200"
        >
          <MessageSquare className="w-6 h-6 text-[#D4AF37]" />
        </button>
      )}

      {/* Chat Panel */}
      {isOpen && (
        <div className="w-[90vw] sm:w-[380px] h-[520px] bg-[#0B0A09] border border-[#D4AF37] rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200">
          {/* Header */}
          <div className="bg-[#6B1230] p-4 text-[#F7EFD9] flex items-center justify-between border-b border-[#D4AF37]">
            <div className="flex items-center space-x-2">
              <Bot className="w-5 h-5 text-[#D4AF37]" />
              <div>
                <h3 className="font-bold text-sm tracking-wide">ROCK UC FOODS assistant</h3>
                <p className="text-[11px] text-[#F3D98B]">AI assistant, not a person</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              aria-label="Close assistant chat"
              className="p-1 rounded hover:bg-black/20 text-[#F7EFD9]"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Messages Scroll Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#0B0A09]">
            {messages.map((m) => {
              const isAssistant = m.sender === 'assistant';
              const showWhatsapp = isAssistant && m.reply.kind !== 'answer';

              return (
                <div
                  key={m.id}
                  className={`flex flex-col ${
                    isAssistant ? 'items-start' : 'items-end'
                  }`}
                >
                  <div
                    className={`max-w-[85%] rounded-lg p-3 text-sm leading-relaxed ${
                      isAssistant
                        ? 'bg-[#17120F] border border-[#D4AF37]/30 text-[#F7EFD9]'
                        : 'bg-[#6B1230] text-[#FFFFFF]'
                    }`}
                  >
                    {/* Rendered strictly as React text (zero raw HTML) */}
                    <p className="whitespace-pre-wrap">{m.reply.text}</p>

                    {/* WhatsApp handoff button for non-plain answers */}
                    {showWhatsapp && (
                      <div className="mt-3 pt-2 border-t border-[#D4AF37]/20">
                        <a
                          href={m.reply.whatsappUrl || BUSINESS_CONTACT.whatsappUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center text-xs font-semibold text-[#F2C230] hover:underline space-x-1"
                        >
                          <span>Chat on WhatsApp ({BUSINESS_CONTACT.phone})</span>
                          <ExternalLink className="w-3.5 h-3.5 ml-1" />
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {loading && (
              <div className="flex items-center space-x-2 text-xs text-[#F3D98B] italic">
                <Bot className="w-4 h-4 animate-spin text-[#D4AF37]" />
                <span>Assistant is drafting a response...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Form */}
          <form
            onSubmit={handleSubmit}
            className="p-3 bg-[#17120F] border-t border-[#D4AF37]/30 flex items-center space-x-2"
          >
            <label htmlFor="assistant-input" className="sr-only">
              Ask our AI assistant a question
            </label>
            <input
              id="assistant-input"
              type="text"
              maxLength={500}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about dishes, pricing, or catering..."
              disabled={loading}
              className="flex-1 bg-[#0B0A09] border border-[#D4AF37]/40 rounded-lg px-3 py-2 text-xs text-[#F7EFD9] placeholder:text-stone-500 focus:outline-none focus:border-[#D4AF37]"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              aria-label="Send message to AI assistant"
              className="p-2 rounded-lg bg-[#6B1230] text-[#F7EFD9] hover:bg-[#85163c] disabled:opacity-50 border border-[#D4AF37]/50"
            >
              <Send className="w-4 h-4 text-[#D4AF37]" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
