-- ROCK UC FOODS: Phase 1G - Invoice Sharing Links & 30-Day Tokens
-- Playbook v2 Section 29 / Migration 0017

CREATE TABLE IF NOT EXISTS invoice_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE RESTRICT,
  token_hash text NOT NULL UNIQUE,
  created_by uuid NOT NULL REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz
);

-- Indexes for constant-time lookup and invoice joins
CREATE INDEX IF NOT EXISTS idx_invoice_links_token_hash ON invoice_links(token_hash);
CREATE INDEX IF NOT EXISTS idx_invoice_links_invoice_id ON invoice_links(invoice_id);

-- Row Level Security
ALTER TABLE invoice_links ENABLE ROW LEVEL SECURITY;

-- Anonymous and customer roles: NO ACCESS
-- Staff and developer: SELECT only
CREATE POLICY staff_developer_select_invoice_links ON invoice_links
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('owner', 'staff', 'developer')
    )
  );

-- Owner: INSERT and UPDATE of revoked_at only
CREATE POLICY owner_insert_invoice_links ON invoice_links
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner'
    )
  );

CREATE POLICY owner_update_revoked_at ON invoice_links
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner'
    )
  );

-- Immutability trigger: nobody can update token_hash, invoice_id, or expires_at, and nobody can delete
CREATE OR REPLACE FUNCTION protect_invoice_links()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Deleting from invoice_links is prohibited';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF OLD.token_hash <> NEW.token_hash OR OLD.invoice_id <> NEW.invoice_id OR OLD.expires_at <> NEW.expires_at OR OLD.created_at <> NEW.created_at OR OLD.created_by <> NEW.created_by THEN
      RAISE EXCEPTION 'Cannot modify immutable columns on invoice_links (only revoked_at may be updated)';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_invoice_links ON invoice_links;
CREATE TRIGGER trg_protect_invoice_links
  BEFORE UPDATE OR DELETE ON invoice_links
  FOR EACH ROW EXECUTE FUNCTION protect_invoice_links();
