-- ============================================================
-- Migration 002: offline-channel improvements
-- Apply to an already-provisioned database (run once):
--   mysql -u root inventory_system < migrations/002_offline_logistics_improvements.sql
-- Fresh installs get this folded into schema.sql already - do not
-- run this file against a database created from the current schema.sql.
-- ============================================================

USE inventory_system;

-- Barcode lookups need to be unique when set. MySQL unique indexes allow
-- multiple NULLs, so this is safe against the existing all-NULL catalog.
ALTER TABLE products ADD UNIQUE KEY uq_barcode (barcode);

-- Delivery Receipt manifest header - scan multiple SKUs onto one waybill
-- before closing, instead of one flat row per SKU.
CREATE TABLE logistics_receipts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  reference VARCHAR(80) NOT NULL,
  supplier VARCHAR(80) NULL,
  received_by VARCHAR(80) NULL,
  status ENUM('OPEN','CLOSED') NOT NULL DEFAULT 'OPEN',
  opened_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  closed_at DATETIME NULL
);

-- Existing quick-log rows keep receipt_id = NULL; manifest line items set it.
ALTER TABLE logistics_transactions ADD COLUMN receipt_id INT NULL AFTER type;
ALTER TABLE logistics_transactions
  ADD CONSTRAINT fk_logistics_transactions_receipt
  FOREIGN KEY (receipt_id) REFERENCES logistics_receipts(id) ON DELETE CASCADE;
