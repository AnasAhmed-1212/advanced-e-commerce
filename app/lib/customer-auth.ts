import "server-only";
import { createHmac,randomBytes,scrypt as scryptCallback,timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";

const scrypt=promisify(scryptCallback);export const CUSTOMER_COOKIE="northstar_customer_session";export const CUSTOMER_MAX_AGE=60*60*24*30;
type Payload={userId:string;email:string;exp:number};
function secret(){return process.env.CUSTOMER_SESSION_SECRET||process.env.ADMIN_SESSION_SECRET||""}
export function customerAuthConfigured(){return secret().length>=32}
export async function hashCustomerPassword(password:string){const salt=randomBytes(16).toString("hex");const hash=await scrypt(password,salt,64) as Buffer;return`${salt}:${hash.toString("hex")}`}
export async function verifyCustomerPassword(password:string,stored:string){const[salt,hex]=stored.split(":");if(!salt||!/^[a-f0-9]{128}$/i.test(hex||""))return false;const actual=await scrypt(password,salt,64) as Buffer,expected=Buffer.from(hex,"hex");return actual.length===expected.length&&timingSafeEqual(actual,expected)}
function sign(value:string){return createHmac("sha256",secret()).update(value).digest("base64url")}
export function createCustomerSession(userId:string,email:string){const body=Buffer.from(JSON.stringify({userId,email,exp:Math.floor(Date.now()/1000)+CUSTOMER_MAX_AGE} satisfies Payload)).toString("base64url");return`${body}.${sign(body)}`}
export function verifyCustomerSession(token?:string):Payload|null{if(!token||!customerAuthConfigured())return null;const[body,supplied]=token.split(".");if(!body||!supplied)return null;const a=Buffer.from(sign(body)),b=Buffer.from(supplied);if(a.length!==b.length||!timingSafeEqual(a,b))return null;try{const payload=JSON.parse(Buffer.from(body,"base64url").toString()) as Payload;return payload.userId&&payload.email&&payload.exp>Math.floor(Date.now()/1000)?payload:null}catch{return null}}
export async function getCustomerSession(){return verifyCustomerSession((await cookies()).get(CUSTOMER_COOKIE)?.value)}
