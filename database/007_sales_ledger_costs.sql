ALTER TABLE product_variants ADD COLUMN unit_cost_minor BIGINT
  CHECK (unit_cost_minor BETWEEN 0 AND 10000000000);

ALTER TABLE order_items ADD COLUMN unit_cost_minor BIGINT
  CHECK (unit_cost_minor BETWEEN 0 AND 10000000000);

CREATE INDEX orders_sales_date_idx ON orders (created_at DESC, id DESC);
CREATE INDEX order_items_order_idx ON order_items (order_id);
