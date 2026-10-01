-- DEMO-ONLY shopper for the identity database (connection `identity`): demo@ecommerce.dev, whose credential lives in the
-- realm (`infra/compose/realm-ecommerce.json` imports the user with this subject id and the password ecommerce-demo). The
-- person row is keyed by that subject. Apply once after `npm run migrate`:
--   psql postgres://postgres@localhost:5501/ecommerce_identity -f .starcistacks/dev/seeds/identity-demo.sql
-- Idempotent: an existing person is left as it is.
INSERT INTO persons (id, email) VALUES ('4f1c2b7e-8a3d-4e5f-9b6a-0c1d2e3f4a5b', 'demo@ecommerce.dev')
ON CONFLICT (id) DO NOTHING;
