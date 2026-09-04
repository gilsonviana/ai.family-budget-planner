import { cpSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const target = join(here, "..", "dist", "drizzle");
rmSync(target, { recursive: true, force: true });
mkdirSync(dirname(target), { recursive: true });
cpSync(
  join(here, "..", "..", "..", "packages", "infrastructure", "drizzle"),
  target,
  { recursive: true },
);
