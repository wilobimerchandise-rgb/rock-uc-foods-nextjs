/**
 * ROCK UC FOODS - Estimates & Invoices In-Memory / Test State Repository
 * Enforces unique constraints and immutable revisions.
 */

import { StoredEstimate, StoredInvoice, StoredInvoiceLink, InvoiceVersionRecord } from './types';

class EstimateRepository {
  private estimates = new Map<string, StoredEstimate>();

  clear() {
    this.estimates.clear();
  }

  save(estimate: StoredEstimate): StoredEstimate {
    this.estimates.set(estimate.id, { ...estimate });
    return estimate;
  }

  getById(id: string): StoredEstimate | undefined {
    const found = this.estimates.get(id);
    return found ? { ...found } : undefined;
  }

  getAll(): StoredEstimate[] {
    return Array.from(this.estimates.values());
  }
}

class InvoiceRepository {
  private invoices = new Map<string, StoredInvoice>();

  clear() {
    this.invoices.clear();
  }

  save(invoice: StoredInvoice): StoredInvoice {
    // Unique check on publicRef
    for (const [id, inv] of this.invoices.entries()) {
      if (id !== invoice.id && inv.publicRef === invoice.publicRef) {
        throw new Error(`Invoice with publicRef '${invoice.publicRef}' already exists.`);
      }
    }

    // Unique check on estimateId
    for (const [id, inv] of this.invoices.entries()) {
      if (id !== invoice.id && inv.estimateId === invoice.estimateId) {
        throw new Error(`Invoice for estimateId '${invoice.estimateId}' already exists.`);
      }
    }

    this.invoices.set(invoice.id, { ...invoice });
    return invoice;
  }

  getById(id: string): StoredInvoice | undefined {
    const found = this.invoices.get(id);
    return found ? { ...found } : undefined;
  }

  getByEstimateId(estimateId: string): StoredInvoice | undefined {
    for (const inv of this.invoices.values()) {
      if (inv.estimateId === estimateId) {
        return { ...inv };
      }
    }
    return undefined;
  }

  getByPublicRef(publicRef: string): StoredInvoice | undefined {
    for (const inv of this.invoices.values()) {
      if (inv.publicRef === publicRef) {
        return { ...inv };
      }
    }
    return undefined;
  }

  hasPublicRef(publicRef: string): boolean {
    for (const inv of this.invoices.values()) {
      if (inv.publicRef === publicRef) {
        return true;
      }
    }
    return false;
  }

  getAll(): StoredInvoice[] {
    return Array.from(this.invoices.values());
  }
}

class InvoiceLinksRepository {
  private links = new Map<string, StoredInvoiceLink>();

  clear() {
    this.links.clear();
  }

  createLink(link: StoredInvoiceLink): StoredInvoiceLink {
    for (const existing of this.links.values()) {
      if (existing.tokenHash === link.tokenHash) {
        throw new Error(`Invoice link with tokenHash already exists.`);
      }
    }
    this.links.set(link.id, { ...link });
    return link;
  }

  getLinkByTokenHash(tokenHash: string): StoredInvoiceLink | undefined {
    for (const l of this.links.values()) {
      if (l.tokenHash === tokenHash) {
        return { ...l };
      }
    }
    return undefined;
  }

  getLinksByInvoiceId(invoiceId: string): StoredInvoiceLink[] {
    const res: StoredInvoiceLink[] = [];
    for (const l of this.links.values()) {
      if (l.invoiceId === invoiceId) {
        res.push({ ...l });
      }
    }
    return res.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  revokeLinksByInvoiceId(invoiceId: string, revokedAt: string = new Date().toISOString()): number {
    let count = 0;
    for (const [id, l] of this.links.entries()) {
      if (l.invoiceId === invoiceId && !l.revokedAt) {
        this.links.set(id, { ...l, revokedAt });
        count++;
      }
    }
    return count;
  }

  getAll(): StoredInvoiceLink[] {
    return Array.from(this.links.values());
  }
}

class InvoiceVersionsRepository {
  private versions = new Map<string, InvoiceVersionRecord>();

  clear() {
    this.versions.clear();
  }

  saveVersion(record: InvoiceVersionRecord): InvoiceVersionRecord {
    this.versions.set(record.id, { ...record });
    return record;
  }

  getVersionsByInvoiceId(invoiceId: string): InvoiceVersionRecord[] {
    const res: InvoiceVersionRecord[] = [];
    for (const v of this.versions.values()) {
      if (v.invoiceId === invoiceId) {
        res.push({ ...v });
      }
    }
    return res.sort((a, b) => b.revision - a.revision);
  }

  getAll(): InvoiceVersionRecord[] {
    return Array.from(this.versions.values());
  }
}

export const estimateRepository = new EstimateRepository();
export const invoiceRepository = new InvoiceRepository();
export const invoiceLinksRepository = new InvoiceLinksRepository();
export const invoiceVersionsRepository = new InvoiceVersionsRepository();
