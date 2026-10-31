/**
 * ROCK UC FOODS - Database Test Helper
 * Provides real PostgreSQL via PGlite with schema migrations.
 */

import { PGlite } from '@electric-sql/pglite';
import * as fs from 'fs';
import * as path from 'path';

export async function createTestDb(): Promise<PGlite> {
  const db = new PGlite();

  // Initialize Supabase auth schema and mock jwt/uid functions
  await db.exec(`
    create schema if not exists auth;
    create or replace function auth.jwt() returns jsonb as $$
      select '{}'::jsonb;
    $$ language sql;
    create or replace function auth.uid() returns uuid as $$
      select null::uuid;
    $$ language sql;
  `);

  const migrationFiles = [
    '0001_foundation.sql',
    '0002_menu_core.sql',
    '0003_orders_core.sql',
    '0004_events_and_invoices.sql',
    '0005_invoices_and_receipts.sql',
    '0006_payments_and_reconciliation.sql',
    '0007_invoices.sql',
  ];

  for (const file of migrationFiles) {
    const fullPath = path.resolve(process.cwd(), 'supabase/migrations', file);
    if (fs.existsSync(fullPath)) {
      const sql = fs.readFileSync(fullPath, 'utf-8');
      await db.exec(sql);
    }
  }

  return db;
}
