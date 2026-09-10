-- ============================================================
-- Migration 003: product SKU field, packer quota + pack log,
-- CSV import/export support.
-- Apply to an already-provisioned database (run once):
--   mysql -u root inventory_system < migrations/003_sku_and_packing_quota.sql
-- Fresh installs get this folded into schema.sql already - do not
-- run this file against a database created from the current schema.sql.
--
-- Note: the OSPR order-item removal gap described in
-- system-workflows.md (removing a line didn't reverse the ONLINE
-- balance it had decremented) is an application-code fix, not a
-- schema change - nothing to migrate for it here.
-- ============================================================

USE inventory_system;

-- ------------------------------------------------------------
-- Products: add a required, unique SKU. Existing rows are
-- backfilled with a placeholder AE-#### code (matching schema.sql's
-- seed scheme) before the NOT NULL + UNIQUE constraints are applied,
-- since a straight ADD COLUMN ... NOT NULL would fail against rows
-- that already exist. Re-code real SKUs afterward via the Product
-- Catalog page or a CSV re-import.
-- ------------------------------------------------------------
ALTER TABLE products ADD COLUMN sku VARCHAR(64) NULL AFTER name;

UPDATE products SET sku = CONCAT('AE-', LPAD(id, 4, '0')) WHERE sku IS NULL;

ALTER TABLE products MODIFY COLUMN sku VARCHAR(64) NOT NULL;
ALTER TABLE products ADD UNIQUE KEY uq_sku (sku);

-- ------------------------------------------------------------
-- Packers: per-packer shift quota, defaults to the standard 85.
-- ------------------------------------------------------------
ALTER TABLE packers ADD COLUMN daily_quota INT NOT NULL DEFAULT 85 AFTER name;

-- ------------------------------------------------------------
-- Pack logs - per-shift packing quota tracking. Independent of
-- OSPR/channel_inventory - see schema.sql's comment on this table.
-- ------------------------------------------------------------
CREATE TABLE pack_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  packer_id INT NOT NULL,
  work_date DATE NOT NULL,
  shift ENUM('AM','PM') NOT NULL,
  product_id INT NOT NULL,
  unit_id INT NOT NULL,
  quantity DECIMAL(10,2) NOT NULL DEFAULT 1,
  notes VARCHAR(255) NULL,
  logged_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (packer_id) REFERENCES packers(id),
  FOREIGN KEY (product_id) REFERENCES products(id),
  FOREIGN KEY (unit_id) REFERENCES units(id)
);

CREATE INDEX idx_pack_logs_packer_shift ON pack_logs (packer_id, work_date, shift);
