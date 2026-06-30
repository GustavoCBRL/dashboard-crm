require("dotenv").config({ quiet: true });

const { Pool } = require("pg");

function getDatabaseUrl() {
  const url = process.env.DATABASE_URL;

  if (!url) {
    throw new Error(
      "DATABASE_URL não configurada. Configure a URL do PostgreSQL antes de usar o banco.",
    );
  }

  return url;
}

const pool = new Pool({
  connectionString: getDatabaseUrl(),
  ssl:
    process.env.PGSSLMODE === "disable" || process.env.NODE_ENV !== "production"
      ? false
      : { rejectUnauthorized: false },
});

module.exports = pool;
