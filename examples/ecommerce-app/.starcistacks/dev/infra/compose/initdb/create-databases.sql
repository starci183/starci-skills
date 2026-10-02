-- One physical database per connection: the identity, the order and the billing services never share a database.
CREATE DATABASE ecommerce_identity;
CREATE DATABASE ecommerce_order;
CREATE DATABASE ecommerce_billing;
