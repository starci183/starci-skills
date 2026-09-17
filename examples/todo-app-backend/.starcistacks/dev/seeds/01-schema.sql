CREATE TABLE IF NOT EXISTS tasks (
  id text PRIMARY KEY,
  owner text NOT NULL,
  title text NOT NULL,
  complete boolean NOT NULL DEFAULT false
);

