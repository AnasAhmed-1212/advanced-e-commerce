CREATE TABLE storefront_visitors (
  id UUID PRIMARY KEY,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE storefront_activity (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  visitor_id UUID NOT NULL REFERENCES storefront_visitors(id),
  kind TEXT NOT NULL CHECK (kind IN (
    'page_view', 'add_to_cart', 'checkout_started', 'order_placed',
    'account_registered', 'signed_in', 'signed_out'
  )),
  path TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX storefront_visitors_first_seen_idx ON storefront_visitors(first_seen_at);
CREATE INDEX storefront_visitors_last_seen_idx ON storefront_visitors(last_seen_at);
CREATE INDEX storefront_activity_recent_idx ON storefront_activity(occurred_at DESC, id DESC);
CREATE INDEX storefront_activity_visitor_idx ON storefront_activity(visitor_id, occurred_at DESC, id DESC);

ALTER TABLE storefront_visitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE storefront_activity ENABLE ROW LEVEL SECURITY;
