import fs from 'node:fs/promises';
import path from 'node:path';

const dir = process.env.SNAPSHOT_DIR || path.join(process.cwd(), 'data');
const filePath = (id) => path.join(dir, `${id}.json`);

export async function ensureSnapshotDir() {
  await fs.mkdir(dir, { recursive: true });
}

export async function writeSnapshot(id, data) {
  await ensureSnapshotDir();
  const payload = {
    savedAt: new Date().toISOString(),
    data,
  };
  await fs.writeFile(filePath(id), JSON.stringify(payload, null, 2), 'utf8');
}

export async function readSnapshot(id) {
  const raw = await fs.readFile(filePath(id), 'utf8');
  return JSON.parse(raw);
}

