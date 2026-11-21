'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

test('server does not publicly expose source/config and requires auth for business APIs', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'index.js'), 'utf8');
  assert.doesNotMatch(source, /express\.static\(\s*__dirname\s*\)/);
  assert.match(source, /new Set\(\[/);
  assert.match(source, /installSecurity\(app, Admin\)/);
  assert.match(source, /sequelize\.authenticate\(\)/);
  assert.doesNotMatch(source, /sequelize\.sync\(/);
  assert.doesNotMatch(source, /IMGBB_API_KEY\s*=\s*['"]/);
  assert.match(source, /IMGBB_API_KEY\s*=\s*process\.env\.IMGBB_API_KEY/);
  assert.doesNotMatch(source, /rejectUnauthorized:\s*false/);
  assert.match(source, /rejectUnauthorized:\s*true/);
});
