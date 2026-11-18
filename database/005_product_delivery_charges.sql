ALTER TABLE product_variants ADD COLUMN delivery_charge_minor BIGINT NOT NULL DEFAULT 65000
  CHECK (delivery_charge_minor BETWEEN 0 AND 10000000000);
