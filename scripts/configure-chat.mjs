import nextEnv from "@next/env";
import { promptValue, saveLocalEnv } from "./local-env-setup.mjs";

async function configureChat() {
  const key = (await promptValue("Gemini API key (hidden): ", { hidden: true }))?.trim();
  if (!key || /[\s"'\\]/.test(key)) {
    console.error("Paste the Gemini API key by itself.");
    return false;
  }

  try {
    await saveLocalEnv({ GEMINI_API_KEY: key });
  } catch {
    console.error("Could not save GEMINI_API_KEY. Check that .env.local is writable.");
    return false;
  }

  nextEnv.loadEnvConfig(process.cwd(), true, {
    info() {},
    error() { console.error("An environment file could not be loaded."); },
  });
  if (process.env.GEMINI_API_KEY !== key) {
    console.error("Key saved, but Next.js reads a different value. Check GEMINI_API_KEY in your terminal environment or .env.development.local.");
    return false;
  }

  console.log("GEMINI_API_KEY saved and loaded from the local configuration. Restart Next.js to use it.");
  return true;
}

if (!(await configureChat())) process.exitCode = 1;
