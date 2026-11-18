import "server-only";
import { Pool, type PoolClient, type QueryResultRow } from "pg";
import { isConnectionError } from "./api-errors";

declare global { var northstarPool: Pool | undefined; }
export function databaseConfigured(){return Boolean(process.env.DATABASE_URL?.trim());}
function pool(){
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) throw new Error("DATABASE_NOT_CONFIGURED");
  if(!globalThis.northstarPool){
    const url = URL.canParse(connectionString) ? new URL(connectionString) : undefined;
    const supabaseTransactionPooler = url?.port === "6543"
      && (url.hostname.endsWith(".pooler.supabase.com") || url.hostname.endsWith(".supabase.co"));
    globalThis.northstarPool = new Pool({
      connectionString,
      max: supabaseTransactionPooler ? 1 : 5,
      idleTimeoutMillis: 60000,
      connectionTimeoutMillis: 10000,
      // Transaction poolers do not retain session-level settings.
      statement_timeout: supabaseTransactionPooler ? undefined : 60000,
      query_timeout: 65000,
      ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
    });
    globalThis.northstarPool.on("error",()=>console.error("An idle PostgreSQL connection closed; the pool will replace it."));
  }
  return globalThis.northstarPool;
}
async function acquire(){
  try{return await pool().connect();}
  catch(error){
    if(!isConnectionError(error))throw error;
    // No SQL has been sent, so retrying connection acquisition cannot repeat a write.
    await new Promise(resolve=>setTimeout(resolve,250));
    return pool().connect();
  }
}
export async function query<T extends QueryResultRow>(text:string,values:unknown[]=[]){
  const readOnly=/^\s*SELECT\b/i.test(text);
  for(let attempt=0;attempt<2;attempt++){
    const client=await acquire();let damaged=false;
    try{return await client.query<T>(text,values);}
    catch(error){damaged=isConnectionError(error);if(!readOnly||!damaged||attempt>0)throw error;}
    finally{client.release(damaged);}
  }
  throw new Error("DATABASE_QUERY_FAILED");
}
export async function withTransaction<T>(work:(client:PoolClient)=>Promise<T>){
  const client=await acquire();let damaged=false;
  try{await client.query("BEGIN");const result=await work(client);await client.query("COMMIT");return result;}
  catch(error){try{await client.query("ROLLBACK");}catch{damaged=true;}throw error;}
  finally{client.release(damaged);}
}
