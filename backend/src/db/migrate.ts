import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "./pool.js";

const here = dirname(fileURLToPath(import.meta.url));
const migration = await readFile(join(here, "schema.sql"), "utf8");

await pool.query(migration);
await pool.end();
console.log("Database migration complete.");
