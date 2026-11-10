-- ROCK UC FOODS: Phase 8 - Production Readiness, RLS Security Audit & Launch Gate
-- Playbook v2 Section 13 / Migration 0018

-- Enable Row Level Security across all public tables
ALTER TABLE IF EXISTS profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS delivery_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS menu_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS catering_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS catering_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS quote_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS payment_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS kitchen_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS dispatch_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS user_mfa_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS notification_outbox ENABLE ROW LEVEL SECURITY;

-- 1. Profiles: Users can view their own profile; Owner can view and update all profiles
DROP POLICY IF EXISTS profiles_select_self ON profiles;
CREATE POLICY profiles_select_self ON profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner'));

DROP POLICY IF EXISTS profiles_update_owner ON profiles;
CREATE POLICY profiles_update_owner ON profiles
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner'));

-- 2. Audit Logs: Append-only for all, readable by owner and staff only
DROP POLICY IF EXISTS audit_logs_select_staff_owner ON audit_logs;
CREATE POLICY audit_logs_select_staff_owner ON audit_logs
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('owner', 'staff', 'developer')));

DROP POLICY IF EXISTS audit_logs_insert_all ON audit_logs;
CREATE POLICY audit_logs_insert_all ON audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- 3. Menu Categories & Items: Public read, owner-only write
DROP POLICY IF EXISTS menu_categories_public_read ON menu_categories;
CREATE POLICY menu_categories_public_read ON menu_categories
  FOR SELECT TO public
  USING (true);

DROP POLICY IF EXISTS menu_categories_owner_write ON menu_categories;
CREATE POLICY menu_categories_owner_write ON menu_categories
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner'));

DROP POLICY IF EXISTS menu_items_public_read ON menu_items;
CREATE POLICY menu_items_public_read ON menu_items
  FOR SELECT TO public
  USING (true);

DROP POLICY IF EXISTS menu_items_owner_write ON menu_items;
CREATE POLICY menu_items_owner_write ON menu_items
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner'));

-- 4. Orders & Order Items: Staff/Owner read & manage; public access mediated strictly by tracking token
DROP POLICY IF EXISTS orders_staff_owner_all ON orders;
CREATE POLICY orders_staff_owner_all ON orders
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('owner', 'staff', 'developer')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('owner', 'staff', 'developer')));

DROP POLICY IF EXISTS order_items_staff_owner_all ON order_items;
CREATE POLICY order_items_staff_owner_all ON order_items
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('owner', 'staff', 'developer')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('owner', 'staff', 'developer')));

-- 5. Invoices & Receipts: Owner & Staff read; Owner write
DROP POLICY IF EXISTS invoices_staff_owner_select ON invoices;
CREATE POLICY invoices_staff_owner_select ON invoices
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('owner', 'staff', 'developer')));

DROP POLICY IF EXISTS invoices_owner_write ON invoices;
CREATE POLICY invoices_owner_write ON invoices
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner'));

DROP POLICY IF EXISTS receipts_staff_owner_select ON receipts;
CREATE POLICY receipts_staff_owner_select ON receipts
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('owner', 'staff', 'developer')));

DROP POLICY IF EXISTS receipts_owner_write ON receipts;
CREATE POLICY receipts_owner_write ON receipts
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner'));
