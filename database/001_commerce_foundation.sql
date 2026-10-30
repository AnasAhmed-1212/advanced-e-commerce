CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','scheduled','published','archived')),
  version INTEGER NOT NULL DEFAULT 1, published_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE, sku TEXT NOT NULL UNIQUE,
  price_minor BIGINT NOT NULL CHECK (price_minor >= 0), currency VARCHAR(3) NOT NULL, active BOOLEAN NOT NULL DEFAULT true, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE warehouses (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE inventory_stock (
  variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE, warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  on_hand INTEGER NOT NULL DEFAULT 0 CHECK (on_hand >= 0), reserved INTEGER NOT NULL DEFAULT 0 CHECK (reserved >= 0),
  PRIMARY KEY (variant_id, warehouse_id), CHECK (reserved <= on_hand)
);
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), order_number TEXT NOT NULL UNIQUE, user_id UUID,
  email_normalized TEXT NOT NULL, order_status TEXT NOT NULL DEFAULT 'pending', payment_status TEXT NOT NULL DEFAULT 'unpaid',
  fulfillment_status TEXT NOT NULL DEFAULT 'unfulfilled', currency VARCHAR(3) NOT NULL, subtotal_minor BIGINT NOT NULL,
  shipping_minor BIGINT NOT NULL, tax_minor BIGINT NOT NULL, total_minor BIGINT NOT NULL, shipping_snapshot JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), order_id UUID NOT NULL REFERENCES orders(id), variant_id UUID REFERENCES product_variants(id),
  sku_snapshot TEXT NOT NULL, title_snapshot TEXT NOT NULL, quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price_minor BIGINT NOT NULL CHECK (unit_price_minor >= 0), line_total_minor BIGINT NOT NULL CHECK (line_total_minor >= 0)
);
CREATE TABLE idempotency_keys (
  scope TEXT NOT NULL, actor_key TEXT NOT NULL, key TEXT NOT NULL, request_hash TEXT NOT NULL,
  response_ref TEXT, expires_at TIMESTAMPTZ NOT NULL, PRIMARY KEY (scope, actor_key, key)
);
CREATE TABLE outbox_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), type TEXT NOT NULL, aggregate_id UUID NOT NULL,
  aggregate_version INTEGER NOT NULL, payload JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), processed_at TIMESTAMPTZ
);
CREATE INDEX products_live_idx ON products(published_at) WHERE status = 'published';
CREATE INDEX variants_product_idx ON product_variants(product_id);
CREATE INDEX orders_customer_idx ON orders(email_normalized, created_at DESC);
CREATE INDEX outbox_pending_idx ON outbox_events(created_at) WHERE processed_at IS NULL;
