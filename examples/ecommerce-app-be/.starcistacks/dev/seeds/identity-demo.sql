-- DEMO-ONLY person for the identity database (connection `identity`): demo@ecommerce.dev / ecommerce-demo, the scrypt
-- hex computed with the fixed demo salt of domain/account (`DEMO_SCRYPT_SALT`). Apply once after `npm run migrate`:
--   psql postgres://postgres@localhost:5501/ecommerce_identity -f .starcistacks/dev/seeds/identity-demo.sql
-- Idempotent: an existing email is left as it is.
INSERT INTO persons (email, password_hash) VALUES (
    'demo@ecommerce.dev',
    '2c2c5a95489cece045d979a708a5541a77446d9563e6fb2749d5d2c744a091e70d1e39c55cd3609b1886a9ba96e6cdee60b5a0e4373f492e09c2860dbd8f895a'
)
ON CONFLICT (email) DO NOTHING;
