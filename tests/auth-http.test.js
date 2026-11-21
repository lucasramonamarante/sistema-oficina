'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const express = require('express');
const bcrypt = require('bcryptjs');
const { installSecurity } = require('../security');

test('protected API requires an authenticated HttpOnly session', async (t) => {
  process.env.SESSION_SECRET = 'unit-test-secret-at-least-thirty-two-bytes-only';
  process.env.NODE_ENV = 'development';
  const password = 'CorrectPassword123!';
  const admin = { id: 42, email: 'usuario@exemplo.com', senha: bcrypt.hashSync(password, 4) };
  const Admin = {
    findOne: async ({ where }) => where.email === admin.email ? admin : null,
    findByPk: async (id) => id === admin.id ? admin : null
  };
  const app = express();
  app.use(express.json());
  installSecurity(app, Admin);
  app.get('/private', (req, res) => res.json({ userId: req.authAdmin.id }));
  app.post('/private', (req, res) => res.json({ ok: true }));
  const server = await new Promise((resolve) => {
    const running = app.listen(0, '127.0.0.1', () => resolve(running));
  });
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = 'http://127.0.0.1:' + server.address().port;
  let res = await fetch(base + '/private');
  assert.equal(res.status, 401);
  res = await fetch(base + '/login', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: admin.email, senha: 'incorrect' })
  });
  assert.equal(res.status, 401);
  res = await fetch(base + '/login', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: admin.email, senha: password })
  });
  assert.equal(res.status, 200);
  const setCookie = res.headers.get('set-cookie');
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /SameSite=Strict/i);
  const cookie = setCookie.split(';')[0];
  res = await fetch(base + '/private', { headers: { cookie } });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { userId: 42 });
  res = await fetch(base + '/private', {
    method: 'POST',
    headers: { cookie, origin: 'https://malicious.example' }
  });
  assert.equal(res.status, 403);
  res = await fetch(base + '/logout', { method: 'POST', headers: { cookie } });
  assert.equal(res.status, 204);
  assert.match(res.headers.get('set-cookie'), /Expires=/i);
  admin.senha = bcrypt.hashSync('PasswordChanged234!', 4);
  res = await fetch(base + '/private', { headers: { cookie } });
  assert.equal(res.status, 401);
});
