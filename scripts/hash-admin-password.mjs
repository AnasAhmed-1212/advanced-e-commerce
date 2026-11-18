import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";
import { promptValue, saveLocalEnv } from "./local-env-setup.mjs";

const scrypt = promisify(scryptCallback);

async function passwordHash(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = await scrypt(password, salt, 64);
  return salt + ":" + Buffer.from(hash).toString("hex");
}

async function configureAdmin() {
  const email = (await promptValue("Admin email: "))?.trim().toLowerCase();
  if (!email || email.length > 254 || !/^[^\s@"\\]+@[^\s@"\\]+\.[^\s@"\\]+$/.test(email)) {
    console.error("Enter a valid admin email address.");
    return false;
  }

  const password = await promptValue("Admin password (hidden): ", { hidden: true });
  if (!password || password.length < 12 || password.length > 256) {
    console.error("Use an admin password of 12 to 256 characters.");
    return false;
  }

  const confirmation = await promptValue("Confirm admin password (hidden): ", { hidden: true });
  if (password !== confirmation) {
    console.error("The passwords did not match.");
    return false;
  }

  try {
    await saveLocalEnv({
      ADMIN_EMAIL: email,
      ADMIN_PASSWORD_HASH: await passwordHash(password),
      ADMIN_SESSION_SECRET: randomBytes(32).toString("hex"),
    });
    console.log("Admin settings saved in .env.local. Restart Next.js and sign in at /admin.");
    return true;
  } catch {
    console.error("Could not save the admin settings. Check that .env.local is writable.");
    return false;
  }
}

if (process.argv.includes("--configure")) {
  if (!(await configureAdmin())) process.exitCode = 1;
} else {
  const password = process.env.ADMIN_PASSWORD_PLAIN;
  if (!password || password.length < 12) {
    console.error("Set ADMIN_PASSWORD_PLAIN to a password of at least 12 characters, then run this script.");
    process.exitCode = 1;
  } else {
    console.log(await passwordHash(password));
  }
}
