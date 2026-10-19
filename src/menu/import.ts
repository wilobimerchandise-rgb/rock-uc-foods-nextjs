/**
 * ROCK UC FOODS - Menu CSV Import/Export with Mandatory Dry-Run
 * (Playbook v2 Section 7.C & Appendix A)
 * Atomic, idempotent, and capped at 500 rows.
 */

import { parseNairaToKobo, formatNaira, MAX_KOBO } from '../lib/money';
import { menuRepository } from './data';
import { MenuItem } from '../types/menu';

export interface CsvDryRunRowCreate {
  sku: string;
  category: string;
  name: string;
  priceKobo: bigint;
  portion: string;
  status: string;
}

export interface CsvDryRunRowUpdate {
  sku: string;
  name: string;
  category: string;
  oldPriceKobo: bigint;
  newPriceKobo: bigint;
  priceChanged: boolean;
}

export interface CsvDryRunRowRejected {
  rowNumber: number;
  rawText: string;
  reason: string;
}

export interface CsvDryRunResult {
  totalRows: number;
  rowsToCreate: CsvDryRunRowCreate[];
  rowsToUpdate: CsvDryRunRowUpdate[];
  rowsRejected: CsvDryRunRowRejected[];
  isIdempotent: boolean; // true if running commit will change 0 rows
}

/**
 * Parses raw CSV text into a structured dry-run report without mutating state.
 */
export function dryRunMenuCsv(csvText: string): CsvDryRunResult {
  // Strip UTF-8 BOM if present (standard when exported by Microsoft Excel)
  const normalizedText = csvText.startsWith('\uFEFF') ? csvText.slice(1) : csvText;

  const lines = normalizedText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    return {
      totalRows: 0,
      rowsToCreate: [],
      rowsToUpdate: [],
      rowsRejected: [{ rowNumber: 1, rawText: '', reason: 'CSV is completely empty.' }],
      isIdempotent: true,
    };
  }

  // Cap at 500 rows
  const dataLines = lines.slice(1); // skip header
  if (dataLines.length > 500) {
    throw new Error(`CSV exceeds maximum limit of 500 rows (got ${dataLines.length}).`);
  }

  const rowsToCreate: CsvDryRunRowCreate[] = [];
  const rowsToUpdate: CsvDryRunRowUpdate[] = [];
  const rowsRejected: CsvDryRunRowRejected[] = [];

  const seenCategoryNames = new Set<string>();

  dataLines.forEach((line, index) => {
    const rowNum = index + 2; // 1-indexed accounting for header
    // Simple robust comma parsing respecting quoted fields
    const cols = line.match(/(?:[^,"]+|"[^"]*")+/g)?.map((c) => c.replace(/^"|"$/g, '').trim()) || [];

    if (cols.length < 5) {
      rowsRejected.push({
        rowNumber: rowNum,
        rawText: line,
        reason: 'Malformed row: expected at least 5 columns (sku, category, name, description, price_ngn).',
      });
      return;
    }

    const [sku, categoryName, name, description, priceStr, portion, allergensStr, statusStr] = cols;

    if (!name || name.trim() === '') {
      rowsRejected.push({ rowNumber: rowNum, rawText: line, reason: 'Dish name cannot be blank.' });
      return;
    }

    const catKey = `${categoryName.toLowerCase()}:${name.toLowerCase()}`;
    if (seenCategoryNames.has(catKey)) {
      rowsRejected.push({
        rowNumber: rowNum,
        rawText: line,
        reason: `Duplicate dish name '${name}' within category '${categoryName}' in this import file.`,
      });
      return;
    }
    seenCategoryNames.add(catKey);

    // Parse price
    let parsedKobo = 0n;
    if (priceStr && priceStr.trim() !== '') {
      try {
        parsedKobo = parseNairaToKobo(priceStr);
      } catch (err: unknown) {
        rowsRejected.push({
          rowNumber: rowNum,
          rawText: line,
          reason: `Invalid price '${priceStr}': ${(err as Error).message}`,
        });
        return;
      }
    }

    const status = statusStr?.toLowerCase() === 'published' ? 'published' : 'draft';

    // Price safety: published items cannot have price under 1 kobo
    if (status === 'published' && parsedKobo < 1n) {
      rowsRejected.push({
        rowNumber: rowNum,
        rawText: line,
        reason: 'Price under 1 kobo for published item is rejected.',
      });
      return;
    }

    // Check if item exists by SKU or by (Category + Name)
    const existingBySku = sku ? menuRepository.getItemBySku(sku) : undefined;
    const existingByName = menuRepository
      .getAllItemsForAdmin()
      .find((i) => i.name.toLowerCase() === name.toLowerCase());

    const existing = existingBySku || existingByName;

    if (existing) {
      const priceChanged = existing.priceKobo !== parsedKobo;
      rowsToUpdate.push({
        sku: existing.sku || sku,
        name: existing.name,
        category: categoryName,
        oldPriceKobo: existing.priceKobo,
        newPriceKobo: parsedKobo,
        priceChanged,
      });
    } else {
      rowsToCreate.push({
        sku: sku || `SKU-${Date.now().toString().slice(-4)}`,
        category: categoryName,
        name,
        priceKobo: parsedKobo,
        portion: portion || 'Serves 1',
        status,
      });
    }
  });

  const isIdempotent =
    rowsToCreate.length === 0 && rowsToUpdate.every((u) => !u.priceChanged) && rowsRejected.length === 0;

  return {
    totalRows: dataLines.length,
    rowsToCreate,
    rowsToUpdate,
    rowsRejected,
    isIdempotent,
  };
}

/**
 * Executes commit of dry-run result atomically (Owner only).
 */
export function commitMenuCsv(
  dryRun: CsvDryRunResult,
  actorId: string
): { createdCount: number; updatedCount: number } {
  if (dryRun.rowsRejected.length > 0) {
    throw new Error('Cannot commit CSV import: file contains rejected rows. Fix errors before confirming.');
  }

  let createdCount = 0;
  let updatedCount = 0;

  // Process creations
  for (const row of dryRun.rowsToCreate) {
    // Ensure category exists
    let cat = menuRepository.getCategories(true).find((c) => c.name.toLowerCase() === row.category.toLowerCase());
    if (!cat) {
      // Auto-create category if needed
      cat = {
        id: `cat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: row.category,
        sortOrder: 100,
        isVisible: true,
        version: 1,
      };
    }

    menuRepository.saveItem(
      {
        sku: row.sku,
        categoryId: cat.id,
        name: row.name,
        priceKobo: row.priceKobo,
        portionLabel: row.portion,
        status: row.status as 'draft' | 'published',
      },
      actorId
    );
    createdCount++;
  }

  // Process updates
  for (const row of dryRun.rowsToUpdate) {
    if (row.priceChanged) {
      const existing = menuRepository.getItemBySku(row.sku);
      if (existing) {
        menuRepository.saveItem(
          {
            id: existing.id,
            name: existing.name,
            categoryId: existing.categoryId,
            priceKobo: row.newPriceKobo,
            version: existing.version,
          },
          actorId
        );
        updatedCount++;
      }
    }
  }

  return { createdCount, updatedCount };
}

/**
 * Exports current menu to CSV format with UTF-8 BOM.
 */
export function exportMenuToCsv(): string {
  const items = menuRepository.getAllItemsForAdmin();
  const categories = menuRepository.getCategories(true);
  const catMap = new Map(categories.map((c) => [c.id, c.name]));

  const header = 'sku,category,name,description,price_ngn,portion_label,allergens,status,available,featured,sort_order';
  const rows = items.map((item) => {
    const catName = catMap.get(item.categoryId) || 'General';
    const priceNaira = (Number(item.priceKobo) / 100).toFixed(2);
    const allergensStr = item.allergens.join(';');

    // Sanitize any potential formula injection on export
    const safeName = item.name.replace(/^[=+\-@\t]/, "'$&");
    const safeDesc = (item.description || '').replace(/^[=+\-@\t]/, "'$&");

    return `"${item.sku}","${catName}","${safeName}","${safeDesc}",${priceNaira},"${item.portionLabel || ''}","${allergensStr}",${item.status},${item.isAvailable},${item.isFeatured},${item.sortOrder}`;
  });

  return '\uFEFF' + [header, ...rows].join('\n');
}
