/** Hashed Vite build artifacts: long immutable cache (e.g. index-CQphZ3pd.js). */
const HASHED_ASSET =
  /\/assets\/[^/]+-[a-zA-Z0-9_-]{8,}\.(js|css|mjs|map|woff2?|ttf|eot|svg|png|jpe?g|webp|gif|ico)$/i;

const ROOT_STATIC = /(?:^|[/\\])(og-image\.jpe?g|favicon\.svg|robots\.txt)$/i;

/**
 * @param {string} filePath — absolute or relative path from @fastify/static
 * @returns {string | null} Cache-Control value, or null to skip
 */
export function cacheControlForStatic(filePath) {
  const normalized = String(filePath).replace(/\\/g, '/');
  if (normalized.endsWith('/index.html') || normalized === 'index.html') {
    return 'no-cache';
  }
  if (HASHED_ASSET.test(normalized)) {
    return 'public, max-age=31536000, immutable';
  }
  if (ROOT_STATIC.test(normalized)) {
    return 'public, max-age=86400';
  }
  return null;
}

/**
 * @param {import('node:http').ServerResponse} res
 * @param {string} filePath
 */
export function applyStaticCacheHeaders(res, filePath) {
  const cc = cacheControlForStatic(filePath);
  if (cc) res.setHeader('Cache-Control', cc);
}
