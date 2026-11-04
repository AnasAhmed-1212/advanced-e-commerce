import fs from "node:fs";
import { createHash } from "node:crypto";
import nextEnv from "@next/env";
import pg from "pg";
nextEnv.loadEnvConfig(process.cwd(),true);
if(!process.env.DATABASE_URL){console.error("Set DATABASE_URL in .env.local before running migrations.");process.exit(1);}
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL,max:1,connectionTimeoutMillis:10000,ssl:process.env.DATABASE_SSL==="true"?{rejectUnauthorized:false}:undefined});
let client;
try{
  client=await pool.connect();await client.query("BEGIN");
  await client.query("SET LOCAL lock_timeout='10s'");await client.query("SET LOCAL statement_timeout='30s'");await client.query("SET LOCAL search_path=public,extensions");
  await client.query("SELECT pg_advisory_xact_lock(hashtext('commerce-schema-migrations'))");
  await client.query("CREATE TABLE IF NOT EXISTS app_schema_migrations(name TEXT PRIMARY KEY,checksum TEXT NOT NULL,applied_at TIMESTAMPTZ NOT NULL DEFAULT now())");
  await client.query("ALTER TABLE app_schema_migrations ENABLE ROW LEVEL SECURITY");
  const files=fs.readdirSync("database").filter(name=>/^\d+_.*\.sql$/.test(name)).sort();
  for(const name of files){
    const sql=fs.readFileSync(`database/${name}`,"utf8"),checksum=createHash("sha256").update(sql.replace(/\r\n/g,"\n")).digest("hex");
    const applied=await client.query("SELECT checksum FROM app_schema_migrations WHERE name=$1",[name]);
    if(applied.rows[0]){if(applied.rows[0].checksum!==checksum)throw new Error(`Applied migration changed: ${name}. Add a new migration instead.`);console.log(`Already applied: ${name}`);continue;}
    let adopt=false;
    if(name==="001_commerce_foundation.sql"){
      const tables=["products","product_variants","warehouses","inventory_stock","orders","order_items","idempotency_keys","outbox_events"];
      const existing=await client.query("SELECT count(*)::int AS count FROM unnest($1::text[]) name WHERE to_regclass('public.'||name) IS NOT NULL",[tables]);
      if(existing.rows[0].count!==0&&existing.rows[0].count!==tables.length)throw new Error("The foundation schema is partially initialized; review it before migrating.");
      adopt=existing.rows[0].count===tables.length;
    }
    if(!adopt)await client.query(sql);
    if(name==="001_commerce_foundation.sql"||name==="002_customer_accounts.sql"){
      const tables=name.startsWith("001")?["products","product_variants","warehouses","inventory_stock","orders","order_items","idempotency_keys","outbox_events"]:["users"];
      for(const table of tables)await client.query(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`);
    }
    await client.query("INSERT INTO app_schema_migrations(name,checksum) VALUES($1,$2)",[name,checksum]);
    console.log(`${adopt?"Adopted existing schema":"Applied"}: ${name}`);
  }
  await client.query("COMMIT");console.log("Database migrations complete.");
}catch(error){if(client)await client.query("ROLLBACK").catch(()=>{});console.error("Migration failed; changes rolled back.",error.code||error.message);process.exitCode=1;}
finally{if(client)client.release();await pool.end();}
