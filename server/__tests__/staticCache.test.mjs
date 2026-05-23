import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { applyStaticCacheHeaders, cacheControlForStatic } from '../staticCache.mjs';

test('cacheControlForStatic hashed assets are immutable', () => {
  assert.equal(
    cacheControlForStatic('/app/public/assets/index-CQphZ3pd.js'),
    'public, max-age=31536000, immutable',
  );
  assert.equal(
    cacheControlForStatic('public/assets/index-DXIfe9FT.css'),
    'public, max-age=31536000, immutable',
  );
});

test('cacheControlForStatic index.html is no-cache', () => {
  assert.equal(cacheControlForStatic('/app/public/index.html'), 'no-cache');
  assert.equal(cacheControlForStatic('index.html'), 'no-cache');
});

test('cacheControlForStatic og-image gets one day', () => {
  assert.equal(cacheControlForStatic('/app/public/og-image.jpg'), 'public, max-age=86400');
});

test('cacheControlForStatic favicon and manifest get one day', () => {
  assert.equal(cacheControlForStatic('/app/public/favicon-32x32.png'), 'public, max-age=86400');
  assert.equal(cacheControlForStatic('public/apple-touch-icon.png'), 'public, max-age=86400');
  assert.equal(cacheControlForStatic('/app/public/site.webmanifest'), 'public, max-age=86400');
});

test('fastify static serves hashed asset with immutable cache', async (t) => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'finance-static-'));
  const assetsDir = path.join(tmp, 'assets');
  fs.mkdirSync(assetsDir, { recursive: true });
  fs.writeFileSync(path.join(assetsDir, 'app-Ab12Cd34.js'), 'console.log(1)');
  fs.writeFileSync(path.join(tmp, 'index.html'), '<!doctype html><html></html>');
  fs.writeFileSync(path.join(tmp, 'og-image.jpg'), 'fake');

  t.after(() => fs.rmSync(tmp, { recursive: true, force: true }));

  const app = Fastify({ logger: false });
  await app.register(fastifyStatic, {
    root: tmp,
    prefix: '/',
    cacheControl: false,
    setHeaders(res, filePath) {
      applyStaticCacheHeaders(res, filePath);
    },
  });

  const assetRes = await app.inject({ method: 'GET', url: '/assets/app-Ab12Cd34.js' });
  assert.equal(assetRes.statusCode, 200);
  assert.equal(assetRes.headers['cache-control'], 'public, max-age=31536000, immutable');

  const ogRes = await app.inject({ method: 'GET', url: '/og-image.jpg' });
  assert.equal(ogRes.statusCode, 200);
  assert.equal(ogRes.headers['cache-control'], 'public, max-age=86400');

  const htmlRes = await app.inject({ method: 'GET', url: '/index.html' });
  assert.equal(htmlRes.statusCode, 200);
  assert.equal(htmlRes.headers['cache-control'], 'no-cache');

  await app.close();
});
