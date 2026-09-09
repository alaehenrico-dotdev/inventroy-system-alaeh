-- ============================================================
-- Ala Eh! Inventory & Monitoring System
-- Schema v3.0 - aligned to field records
-- Import via phpMyAdmin, or: mysql -u root < schema.sql
-- ============================================================

CREATE DATABASE IF NOT EXISTS inventory_system CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE inventory_system;

-- ------------------------------------------------------------
-- Lookup: units
-- ------------------------------------------------------------
CREATE TABLE units (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code ENUM('GAL','LIT','750ML','350ML','KG') NOT NULL UNIQUE,
  label VARCHAR(20) NOT NULL
);

INSERT INTO units (code, label) VALUES
 ('GAL','Gallon'), ('LIT','Liter'), ('750ML','750ml'), ('350ML','350ml'), ('KG','1kg Retail');

-- ------------------------------------------------------------
-- Users (login + role scopes)
-- ------------------------------------------------------------
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  username VARCHAR(60) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('PRODUCTION','PACKER','LOGISTICS','ADMIN') NOT NULL,
  packer_no INT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------
-- Packers (numbered identity - "BY 1 / BY 2 / BY 4 / BY 6")
-- ------------------------------------------------------------
CREATE TABLE packers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  packer_no INT NOT NULL UNIQUE,
  name VARCHAR(80) NULL,
  active TINYINT(1) NOT NULL DEFAULT 1
);

INSERT INTO packers (packer_no, name) VALUES (1,NULL),(2,NULL),(4,NULL),(6,NULL);

-- ------------------------------------------------------------
-- Product catalog (~29 items, Section 10)
-- ------------------------------------------------------------
CREATE TABLE products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  category ENUM('CONDIMENT','RETAIL_DRY_GOODS') NOT NULL DEFAULT 'CONDIMENT',
  barcode VARCHAR(64) NULL,
  active TINYINT(1) NOT NULL DEFAULT 1
);

CREATE TABLE product_units (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  unit_id INT NOT NULL,
  UNIQUE KEY uq_product_unit (product_id, unit_id),
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE CASCADE
);

-- ------------------------------------------------------------
-- Channel inventory - balance per product/unit/channel
-- ------------------------------------------------------------
CREATE TABLE channel_inventory (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  unit_id INT NOT NULL,
  channel ENUM('ONLINE','OFFLINE') NOT NULL,
  quantity DECIMAL(10,2) NOT NULL DEFAULT 0,
  low_stock_threshold DECIMAL(10,2) NOT NULL DEFAULT 0,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_channel_stock (product_id, unit_id, channel),
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE CASCADE
);

-- ------------------------------------------------------------
-- Withdrawals - 1st-hour Production -> Packing pulls
-- (digital replacement for the raw tally page)
-- ------------------------------------------------------------
CREATE TABLE withdrawals (
  id INT AUTO_INCREMENT PRIMARY KEY,
  shift ENUM('AM','PM') NOT NULL,
  packer_id INT NOT NULL,
  product_id INT NOT NULL,
  unit_id INT NOT NULL,
  quantity DECIMAL(10,2) NOT NULL,
  withdrawn_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (packer_id) REFERENCES packers(id),
  FOREIGN KEY (product_id) REFERENCES products(id),
  FOREIGN KEY (unit_id) REFERENCES units(id)
);

-- ------------------------------------------------------------
-- Inter-channel transfer ledger (immutable)
-- ------------------------------------------------------------
CREATE TABLE inter_channel_transfers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  unit_id INT NOT NULL,
  source_channel ENUM('ONLINE','OFFLINE') NOT NULL,
  destination_channel ENUM('ONLINE','OFFLINE') NOT NULL,
  quantity DECIMAL(10,2) NOT NULL,
  reason_code ENUM('LOW_STOCK','UPSELL_REDIRECT','CORRECTION') NOT NULL,
  status ENUM('PENDING_APPROVAL','CLEARED') NOT NULL DEFAULT 'CLEARED',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id),
  FOREIGN KEY (unit_id) REFERENCES units(id)
);

-- ------------------------------------------------------------
-- OSPR - Online Shop Packing Report
-- ------------------------------------------------------------
CREATE TABLE ospr_batches (
  id INT AUTO_INCREMENT PRIMARY KEY,
  batch_date DATE NOT NULL,
  prepared_by VARCHAR(60) NULL,
  packed_by INT NULL,
  courier ENUM('JNT','JTE','LEX','SPX') NULL,
  time_started TIME NULL,
  time_ended TIME NULL,
  status ENUM('OPEN','CLOSED') NOT NULL DEFAULT 'OPEN',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (packed_by) REFERENCES packers(id)
);

CREATE TABLE ospr_order_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  batch_id INT NOT NULL,
  seq_no INT NOT NULL,
  code_name VARCHAR(60) NOT NULL,
  product_id INT NOT NULL,
  unit_id INT NOT NULL,
  quantity DECIMAL(10,2) NOT NULL DEFAULT 1,
  customer_name VARCHAR(60) NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (batch_id) REFERENCES ospr_batches(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id),
  FOREIGN KEY (unit_id) REFERENCES units(id)
);

CREATE TABLE ospr_accomplishment (
  id INT AUTO_INCREMENT PRIMARY KEY,
  batch_id INT NOT NULL UNIQUE,
  total_pcs_parcel INT NOT NULL DEFAULT 0,
  total_parcel_packed INT NOT NULL DEFAULT 0,
  qty_gal DECIMAL(10,2) NOT NULL DEFAULT 0,
  qty_lit DECIMAL(10,2) NOT NULL DEFAULT 0,
  qty_750 DECIMAL(10,2) NOT NULL DEFAULT 0,
  qty_350 DECIMAL(10,2) NOT NULL DEFAULT 0,
  qty_1kg_salt DECIMAL(10,2) NOT NULL DEFAULT 0,
  computed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (batch_id) REFERENCES ospr_batches(id) ON DELETE CASCADE
);

CREATE TABLE ospr_boxes_used (
  id INT AUTO_INCREMENT PRIMARY KEY,
  batch_id INT NOT NULL,
  packer_id INT NOT NULL,
  box_count INT NOT NULL DEFAULT 0,
  UNIQUE KEY uq_batch_packer (batch_id, packer_id),
  FOREIGN KEY (batch_id) REFERENCES ospr_batches(id) ON DELETE CASCADE,
  FOREIGN KEY (packer_id) REFERENCES packers(id)
);

-- ------------------------------------------------------------
-- RTS triage (returns) - single tally today, category is an
-- optional upgrade (defaults to UNSORTED)
-- ------------------------------------------------------------
CREATE TABLE rts_triage (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  unit_id INT NOT NULL,
  quantity DECIMAL(10,2) NOT NULL,
  category ENUM('UNSORTED','GOOD','LEAK','BAD_ORDER') NOT NULL DEFAULT 'UNSORTED',
  logged_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  notes VARCHAR(255) NULL,
  FOREIGN KEY (product_id) REFERENCES products(id),
  FOREIGN KEY (unit_id) REFERENCES units(id)
);

-- ------------------------------------------------------------
-- Daily fulfillment summary (Fulfillment-Out vs RTS, per product/unit)
-- ------------------------------------------------------------
CREATE TABLE fulfillment_daily (
  id INT AUTO_INCREMENT PRIMARY KEY,
  summary_date DATE NOT NULL UNIQUE,
  total_parcel INT NOT NULL DEFAULT 0,
  total_packers INT NOT NULL DEFAULT 0,
  generated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE fulfillment_daily_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  fulfillment_daily_id INT NOT NULL,
  product_id INT NOT NULL,
  unit_id INT NOT NULL,
  qty_out DECIMAL(10,2) NOT NULL DEFAULT 0,
  qty_rts DECIMAL(10,2) NOT NULL DEFAULT 0,
  UNIQUE KEY uq_daily_product_unit (fulfillment_daily_id, product_id, unit_id),
  FOREIGN KEY (fulfillment_daily_id) REFERENCES fulfillment_daily(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id),
  FOREIGN KEY (unit_id) REFERENCES units(id)
);

-- ------------------------------------------------------------
-- Offline logistics transactions
-- ------------------------------------------------------------
CREATE TABLE logistics_transactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  type ENUM('DELIVERY_RECEIPT','BACKLOAD','UPSELL','BAD_ORDER') NOT NULL,
  product_id INT NOT NULL,
  unit_id INT NOT NULL,
  quantity DECIMAL(10,2) NOT NULL,
  reference VARCHAR(80) NULL,
  logged_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id),
  FOREIGN KEY (unit_id) REFERENCES units(id)
);

-- ------------------------------------------------------------
-- Audit log (append-only, for reconciling counts)
-- ------------------------------------------------------------
CREATE TABLE audit_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  action VARCHAR(60) NOT NULL,
  entity VARCHAR(60) NOT NULL,
  entity_id INT NULL,
  details TEXT NULL,
  performed_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- Seed: Product catalog (Section 10, as observed)
-- ============================================================
INSERT INTO products (name, category) VALUES
 ('Sweet','CONDIMENT'),
 ('Chami Sweet','CONDIMENT'),
 ('Special','CONDIMENT'),
 ('More Sweet','CONDIMENT'),
 ('Dark','CONDIMENT'),
 ('Fish Sauce (Class A)','CONDIMENT'),
 ('Vinegar White (Class A)','CONDIMENT'),
 ('Vinegar Red (Class A)','CONDIMENT'),
 ('Oyster Sauce','CONDIMENT'),
 ('Oyster Sauce Dark','CONDIMENT'),
 ('Catsup Banana','CONDIMENT'),
 ('Catsup Burger','CONDIMENT'),
 ('Toyomansi','CONDIMENT'),
 ('Distilled Cane Vinegar White','CONDIMENT'),
 ('Premium Soy Sauce Special','CONDIMENT'),
 ('Premium Soy Sauce Sweet','CONDIMENT'),
 ('Premium Fish Sauce','CONDIMENT'),
 ('Premium Vinegar White','CONDIMENT'),
 ('Premium Vinegar Red','CONDIMENT'),
 ('Liquid Seasoning','CONDIMENT'),
 ('Sukang Maligalig 750ml','CONDIMENT'),
 ('Patis Puro','CONDIMENT'),
 ('Premium Black for Guisado','CONDIMENT'),
 ('Retail Iodized Salt','RETAIL_DRY_GOODS'),
 ('Retail Cassava','RETAIL_DRY_GOODS'),
 ('Jampong Hot Sauce','CONDIMENT'),
 ('Retail Ground Pepper','RETAIL_DRY_GOODS'),
 ('Retail Onion Powder','RETAIL_DRY_GOODS'),
 ('Retail Chili Powder','RETAIL_DRY_GOODS');

-- unit ids: 1=GAL 2=LIT 3=750ML 4=350ML 5=KG
-- Items 24, 27, 28, 29 were marked under GAL on the paper form but are
-- retail dry goods sold by weight - reclassified to KG per the appendix
-- footnote. Confirm with operations before go-live.
INSERT INTO product_units (product_id, unit_id) VALUES
 (1,1),
 (2,1),
 (3,1),(3,2),
 (4,1),
 (5,1),
 (6,1),(6,2),
 (7,1),(7,2),
 (8,1),(8,2),
 (9,1),(9,2),
 (10,1),(10,2),
 (11,1),(11,2),
 (12,1),(12,2),
 (13,1),(13,2),
 (14,2),
 (15,3),
 (16,3),
 (17,3),
 (18,3),
 (19,3),
 (20,1),(20,2),
 (21,3),
 (22,2),
 (23,3),
 (24,5),
 (25,5),
 (26,1),(26,2),
 (27,5),
 (28,5),
 (29,5);

-- Seed channel_inventory rows (0 balance) for every product/unit combo, both channels
INSERT INTO channel_inventory (product_id, unit_id, channel, quantity, low_stock_threshold)
SELECT pu.product_id, pu.unit_id, 'ONLINE', 0, 10 FROM product_units pu;

INSERT INTO channel_inventory (product_id, unit_id, channel, quantity, low_stock_threshold)
SELECT pu.product_id, pu.unit_id, 'OFFLINE', 0, 10 FROM product_units pu;
