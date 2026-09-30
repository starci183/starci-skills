-- One physical database per connection: the identity and the order services never share a database.
CREATE DATABASE ecommerce_identity;
CREATE DATABASE ecommerce_order;
