import "server-only";
import { Pool, type PoolClient, type QueryResultRow } from "pg";

declare global { var northstarPool: Pool | undefined; }
export function databaseConfigured(){return Boolean(process.env.DATABASE_URL)}
function pool(){if(!process.env.DATABASE_URL)throw new Error("DATABASE_NOT_CONFIGURED");if(!globalThis.northstarPool)globalThis.northstarPool=new Pool({connectionString:process.env.DATABASE_URL,max:10,idleTimeoutMillis:30000,connectionTimeoutMillis:5000,ssl:process.env.DATABASE_SSL==="true"?{rejectUnauthorized:false}:undefined});return globalThis.northstarPool}
export async function query<T extends QueryResultRow>(text:string,values:unknown[]=[]){return pool().query<T>(text,values)}
export async function withTransaction<T>(work:(client:PoolClient)=>Promise<T>){const client=await pool().connect();try{await client.query("BEGIN");const result=await work(client);await client.query("COMMIT");return result}catch(error){await client.query("ROLLBACK");throw error}finally{client.release()}}
