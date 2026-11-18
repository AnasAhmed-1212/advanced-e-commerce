ALTER TABLE product_variants ADD COLUMN previous_price_minor BIGINT
  CHECK (previous_price_minor > price_minor AND previous_price_minor <= 10000000000);
