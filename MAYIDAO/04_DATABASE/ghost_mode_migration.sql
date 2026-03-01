
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS island_member BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS donation_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS unlocked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_donation_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS donation_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  amount_usdt NUMERIC(10,2) NOT NULL,
  txid TEXT UNIQUE NOT NULL,
  purpose TEXT DEFAULT 'cultural_project_donation',
  geo_location TEXT,
  compliance_version TEXT DEFAULT 'v2.0',
  tax_jurisdiction TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  audited_at TIMESTAMPTZ,
  audit_status TEXT DEFAULT 'pending',
  risk_level TEXT DEFAULT 'low'
);

ALTER TABLE donation_records
  ADD COLUMN IF NOT EXISTS risk_level TEXT DEFAULT 'low';

CREATE TABLE IF NOT EXISTS island_members (
  user_id UUID PRIMARY KEY REFERENCES users(id),
  ref_code TEXT UNIQUE NOT NULL,
  total_donated NUMERIC(10,2) DEFAULT 0,
  total_earned_gas INTEGER DEFAULT 0,
  total_referred INTEGER DEFAULT 0,
  unlocked_at TIMESTAMPTZ NOT NULL,
  last_active_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'active'
);

CREATE INDEX IF NOT EXISTS idx_users_island_member ON users(island_member);
CREATE INDEX IF NOT EXISTS idx_donation_records_txid ON donation_records(txid);
CREATE INDEX IF NOT EXISTS idx_donation_records_created_at ON donation_records(created_at);
CREATE INDEX IF NOT EXISTS idx_donation_records_risk_level ON donation_records(risk_level);

CREATE OR REPLACE FUNCTION infer_tax_jurisdiction(geo_location TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN CASE
    WHEN geo_location IN ('CN', 'TW', 'HK') THEN 'CHINA_REGION'
    WHEN geo_location IN ('US', 'CA') THEN 'NORTH_AMERICA'
    WHEN geo_location IN ('SG', 'MY', 'TH') THEN 'SOUTHEAST_ASIA'
    WHEN geo_location IN ('DE', 'FR', 'UK') THEN 'EUROPE'
    ELSE 'GLOBAL_DEFAULT'
  END;
END;
$$;

CREATE OR REPLACE FUNCTION trg_set_donation_tax_jurisdiction()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.tax_jurisdiction := infer_tax_jurisdiction(NEW.geo_location);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS donation_records_set_tax ON donation_records;
CREATE TRIGGER donation_records_set_tax
BEFORE INSERT OR UPDATE OF geo_location ON donation_records
FOR EACH ROW
EXECUTE FUNCTION trg_set_donation_tax_jurisdiction();

CREATE OR REPLACE VIEW v_compliance_audit AS
SELECT
  DATE_TRUNC('week', dr.created_at) AS audit_week,
  COUNT(*) AS total_donations,
  SUM(dr.amount_usdt) AS total_usdt,
  COUNT(CASE WHEN dr.compliance_version = 'v2.0' THEN 1 END) AS compliant_count,
  COUNT(CASE WHEN dr.geo_location IS NOT NULL THEN 1 END) AS geo_tagged,
  ROUND(100.0 * COUNT(CASE WHEN dr.compliance_version = 'v2.0' THEN 1 END) / NULLIF(COUNT(*), 0), 2) AS compliance_rate
FROM donation_records dr
GROUP BY DATE_TRUNC('week', dr.created_at)
ORDER BY audit_week DESC;
