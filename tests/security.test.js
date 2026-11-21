// Run with: SESSION_SECRET=test-secret-of-at-least-32-random-bytes npm test
'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const { createSession, parseSession, passwordVersion } = require('../security');

const secret = 'test-secret-example-should-not-be-used-in-production';
const admin = { id: 1, senha: '$2b$10$sample-hash-for-unit-testing' };
const t = 1763740800000;

test('accepts signed, unexpired session', () => {
  const token = createSession(admin, secret, t);
  const result = parseSession(token, secret, t + 1000);
  assert.equal(result.userId, 1);
  assert.equal(result.passwordVersion, passwordVersion(admin.senha));
});
test('rejects manipulated signature', () => {
  const token = createSession(admin, secret, t);
  const [body] = token.split('.');
  assert.equal(parseSession(body + '.Zm9v', secret, t + 1000), null);
});
test('rejects expired session', () => {
  const token = createSession(admin, secret, t);
  assert.equal(parseSession(token, secret, t + 8 * 60 * 60 * 1000), null);
});
test('rejects malformed cookie', () => {
  assert.equal(parseSession('x', secret), null);
  assert.equal(parseSession(null, secret), null);
});
