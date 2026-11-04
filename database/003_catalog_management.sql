CREATE TABLE IF NOT EXISTS media_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), data BYTEA NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'image/webp' CHECK (content_type = 'image/webp'),
  width INTEGER NOT NULL CHECK (width > 0), height INTEGER NOT NULL CHECK (height > 0),
  size_bytes INTEGER NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 2097152),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '', image_id UUID REFERENCES media_assets(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE products ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES categories(id) ON DELETE RESTRICT;
CREATE TABLE IF NOT EXISTS product_images (
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  image_id UUID NOT NULL REFERENCES media_assets(id), position INTEGER NOT NULL CHECK (position >= 0 AND position < 10),
  PRIMARY KEY (product_id, image_id), UNIQUE (product_id, position)
);
CREATE INDEX IF NOT EXISTS products_category_idx ON products(category_id);
CREATE INDEX IF NOT EXISTS product_images_asset_idx ON product_images(image_id);
CREATE INDEX IF NOT EXISTS categories_active_idx ON categories(name) WHERE is_active = true;
ALTER TABLE media_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT 'cod';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_reference TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_snapshot JSONB;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS inventory_released_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS inventory_status TEXT NOT NULL DEFAULT 'reserved' CHECK (inventory_status IN ('reserved','fulfilled','released'));
CREATE TABLE IF NOT EXISTS order_stock (
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  variant_id UUID NOT NULL, warehouse_id UUID NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  PRIMARY KEY(order_id,variant_id,warehouse_id),
  FOREIGN KEY(variant_id,warehouse_id) REFERENCES inventory_stock(variant_id,warehouse_id)
);
ALTER TABLE order_stock ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS store_settings (
  key TEXT PRIMARY KEY, value JSONB NOT NULL DEFAULT '{}'::jsonb, updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE store_settings ENABLE ROW LEVEL SECURITY;
