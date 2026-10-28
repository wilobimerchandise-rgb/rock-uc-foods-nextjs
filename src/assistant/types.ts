/**
 * ROCK UC FOODS - AI Customer Assistant Types
 * Playbook v4 Section 19.2
 */

export type ReplyKind =
  | 'answer'
  | 'policy'
  | 'handoff'
  | 'refused'
  | 'unavailable'
  | 'invalid';

export interface AssistantReply {
  kind: ReplyKind;
  text: string;
  whatsappUrl?: string;
  reason?: string;
}

export interface MenuFact {
  category: string;
  name: string;
  portion: string | null;
  priceKobo: bigint;
}

export type LlmClient = (args: { system: string; user: string }) => Promise<string>;

export interface AssistantDeps {
  llmClient: LlmClient | null;
  loadMenu: () => Promise<MenuFact[]>;
  checkRateLimit: (key: string, limit: number, windowSeconds: number) => Promise<{ allowed: boolean; retryAfter?: number }>;
  recordAudit?: (entry: { action: string; kind: ReplyKind; reason?: string; ipHash: string }) => Promise<void>;
  now?: () => Date;
}
