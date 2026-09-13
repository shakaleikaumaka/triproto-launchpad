/**
 * env.mjs — tiny .env loader (no dependency).
 *
 * Law: .env is gitignored + chmod 600. This loader never prints values.
 * Explicit process.env always wins over .env file values.
 */
import fs from "node:fs";
import path from "node:path";

export function loadEnv(dir = process.cwd()) {
  const envPath = path.join(dir, ".env");
  if (!fs.existsSync(envPath)) return false;
  try {
    // Warn loudly if .env is group/world-readable (CROPS file-hygiene gate)
    const mode = fs.statSync(envPath).mode & 0o777;
    if (mode & 0o077) {
      console.error(
        `⚠️  CROPS: .env permissions are ${mode.toString(8)} — run: chmod 600 .env`
      );
    }
    for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("=");
      if (eq === -1) continue;
      const key = t.slice(0, eq).trim();
      let val = t.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
    return true;
  } catch {
    return false;
  }
}

/** Mask a secret for logs: never more than a prefix, never the middle. */
export function mask(value, show = 6) {
  if (!value) return "(unset)";
  if (value.length <= show) return "*".repeat(value.length);
  return `${value.slice(0, show)}…[masked len ${value.length}]`;
}
