import nextEnv from "@next/env";
import pg from "pg";
import { promptValue, saveLocalEnv } from "./local-env-setup.mjs";

const catalogTables = [
  "categories",
  "inventory_stock",
  "media_assets",
  "product_images",
  "product_variants",
  "products",
];

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

function isPostgresUri(value) {
  return /^postgres(?:ql)?:\/\//i.test(value) && URL.canParse(value);
}

async function configureDatabase() {
  const uri = (await promptValue("Paste the full Supabase PostgreSQL URI and press Enter (input is hidden): ", { hidden: true }))?.trim();
  if (!uri) {
    fail("No URI entered. The environment file was left unchanged.");
    return;
  }
  if (!isPostgresUri(uri) || /[\s"'\\]/.test(uri)) {
    fail("INVALID_DATABASE_URL: Paste the complete PostgreSQL URI and URL-encode special characters in the password.");
    return;
  }
  if (/(?:\[|%5b)YOUR[-_]DATABASE[-_]PASSWORD(?:\]|%5d)/i.test(new URL(uri).password)) {
    fail("Replace the password placeholder in the Supabase URI with your database password.");
    return;
  }

  try {
    await saveLocalEnv({ DATABASE_URL: uri });
    console.log("DATABASE_URL saved in .env.local.");
    return uri;
  } catch {
    fail("Could not update .env.local. Check that the file is writable.");
  }
}

async function checkDatabase(expectedUri) {
  nextEnv.loadEnvConfig(process.cwd(), true, {
    info() {},
    error() { console.error("An environment file could not be loaded."); },
  });

  const connectionString = process.env.DATABASE_URL?.trim();
  if (expectedUri && expectedUri !== connectionString) {
    fail("DATABASE_URL_OVERRIDE: The saved URI is not the effective value. Check for DATABASE_URL in the terminal environment or .env.development.local.");
    return;
  }
  if (!connectionString) {
    fail("DATABASE_NOT_CONFIGURED: Save the PostgreSQL connection string as DATABASE_URL in .env.local.");
    return;
  }

  if (!isPostgresUri(connectionString)) {
    fail("INVALID_DATABASE_URL: Use the PostgreSQL URI from Supabase Connect → Session pooler.");
    return;
  }

  const pool = new pg.Pool({
    connectionString,
    connectionTimeoutMillis: 10000,
    query_timeout: 10000,
    ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
  });

  try {
    const { rows } = await pool.query(
      "SELECT name FROM unnest($1::text[]) AS required(name) WHERE to_regclass(name) IS NULL",
      [catalogTables],
    );
    if (rows.length) {
      fail(`PostgreSQL connected. Missing catalog tables: ${rows.map(({ name }) => name).join(", ")}. Run npm.cmd run db:migrate in PowerShell to initialize the schema.`);
      return;
    }

    console.log("PostgreSQL connected and the catalog tables are present.");
  } catch (error) {
    // Driver error messages can contain the connection string.
    const code = typeof error?.code === "string" && /^[A-Z0-9_]{2,48}$/.test(error.code)
      ? error.code
      : "CONNECTION_OR_QUERY_FAILED";
    fail(`PostgreSQL check failed (${code}).`);
  } finally {
    await pool.end();
  }
}

if (process.argv.includes("--configure")) {
  const uri = await configureDatabase();
  if (uri) await checkDatabase(uri);
} else {
  await checkDatabase();
}
