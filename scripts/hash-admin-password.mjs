import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

const password = process.env.ADMIN_PASSWORD_PLAIN;
if (!password || password.length < 12) {
  console.error("Set ADMIN_PASSWORD_PLAIN to a password of at least 12 characters, then run this script.");
  process.exit(1);
}

const salt = randomBytes(16).toString("hex");
const hash = await promisify(scryptCallback)(password, salt, 64);
console.log(`${salt}:${Buffer.from(hash).toString("hex")}`);

// Keep the import above compatible with older Node type resolution without accepting CLI secrets.
void createInterface;
void stdin;
void stdout;
