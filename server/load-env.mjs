/**
 * Load `server/.env` regardless of process cwd (e.g. `node server/index.mjs` from repo root).
 * Must be imported first from `index.mjs`.
 */
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const serverDir = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(serverDir, '.env') });
