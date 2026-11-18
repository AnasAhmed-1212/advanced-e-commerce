import { readFile, writeFile } from "node:fs/promises";
import { createInterface } from "node:readline";
import { Writable } from "node:stream";

export function promptValue(label, { hidden = false } = {}) {
  const output = hidden ? new Writable({
    write(_chunk, _encoding, done) { done(); },
  }) : process.stdout;
  const input = createInterface({ input: process.stdin, output, terminal: process.stdin.isTTY });
  process.stdout.write(label);

  return new Promise(resolve => {
    input.once("close", () => resolve(undefined));
    input.once("line", value => {
      resolve(value);
      input.close();
    });
  }).finally(() => { if (hidden) console.log(); });
}

export async function saveLocalEnv(values) {
  const file = ".env.local";
  let contents = await readFile(file, "utf8").catch(error => {
    if (error.code === "ENOENT") return "";
    throw error;
  });
  const newline = contents.includes("\r\n") ? "\r\n" : "\n";
  for (const [name, value] of Object.entries(values)) {
    const entry = name + '="' + value.replace(/\$/g, "\\$") + '"';
    const assignment = new RegExp("^[ \\t]*(?:export[ \\t]+)?" + name + "[ \\t]*=[^\\r\\n]*", "gm");
    contents = assignment.test(contents)
      ? contents.replace(assignment, () => entry)
      : contents + (contents && !contents.endsWith("\n") ? newline : "") + entry + newline;
  }
  await writeFile(file, contents, { mode: 0o600 });
}
