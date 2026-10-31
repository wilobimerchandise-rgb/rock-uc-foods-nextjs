/**
 * ROCK UC FOODS - Estimates & Invoices In-Memory / Test State Repository
 * Enforces unique constraints and immutable revisions.
 */

import { StoredEstimate, StoredInvoice } from './types';

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

export const estimateRepository = new EstimateRepository();
export const invoiceRepository = new InvoiceRepository();
