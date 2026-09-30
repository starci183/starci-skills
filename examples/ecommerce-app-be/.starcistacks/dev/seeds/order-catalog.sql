-- DEMO-ONLY catalog for the order database (connection `order`). Apply once after `npm run migrate`:
--   psql postgres://postgres@localhost:5501/ecommerce_order -f .starcistacks/dev/seeds/order-catalog.sql
-- Idempotent: an existing SKU is left as it is.
INSERT INTO products (id, name, price_minor_units, stock) VALUES
    ('sku-mug', 'Enamel mug', 1299, 40),
    ('sku-notebook', 'Dot-grid notebook', 899, 25),
    ('sku-thermos', 'Steel thermos', 2499, 2)
ON CONFLICT (id) DO NOTHING;
