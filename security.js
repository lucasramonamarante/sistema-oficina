// P0: sessions are signed, HttpOnly and validated on every protected request.
// This module deliberately has no default/weak SESSION_SECRET fallback.
'use strict';
const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');

const COOKIE_NAME = 'workshop_session';
const SESSION_DURATION_MS = 8 * 60 * 60 * 1000;
const FAILURE_WINDOW_MS = 15 * 60 * 1000;
const MAX_LOGIN_FAILURES = 5;

function passwordVersion(passwordHash) {
  return crypto.createHash('sha256').update(String(passwordHash)).digest('hex');
}

function createSession(admin, secret, now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({
    userId: admin.id,
    expiresAt: now + SESSION_DURATION_MS,
    passwordVersion: passwordVersion(admin.senha)
  })).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return payload + '.' + signature;
}

function parseSession(raw, secret, now = Date.now()) {
  if (typeof raw !== 'string' || raw.length > 2048) return null;
  const parts = raw.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  const expected = crypto.createHmac('sha256', secret).update(parts[0]).digest();
  let provided;
  try { provided = Buffer.from(parts[1], 'base64url'); } catch (_) { return null; }
  if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) return null;
  try {
    const data = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    if (!Number.isSafeInteger(data.userId) || data.userId <= 0) return null;
    if (!Number.isFinite(data.expiresAt) || data.expiresAt <= now ||
        data.expiresAt > now + SESSION_DURATION_MS) return null;
    if (!/^[0-9a-f]{64}$/.test(data.passwordVersion)) return null;
    return data;
  } catch (_) {
    return null;
  }
}

function readCookie(req) {
  const raw = req.headers.cookie || '';
  const match = raw.split(';').map(part => part.trim()).find(part => part.startsWith(COOKIE_NAME + '='));
  if (!match) return null;
  try { return decodeURIComponent(match.slice(COOKIE_NAME.length + 1)); }
  catch (_) { return null; }
}

function installSecurity(app, Admin) {
  const secret = process.env.SESSION_SECRET;
  if (typeof secret !== 'string' || Buffer.byteLength(secret) < 32) {
    throw new Error('SESSION_SECRET must be a random secret of at least 32 bytes before starting this release.');
  }

  const secureCookie = process.env.NODE_ENV !== 'development';
  const cookieOptions = {
    httpOnly: true, secure: secureCookie, sameSite: 'strict',
    path: '/', maxAge: SESSION_DURATION_MS
  };
  const failures = new Map();
  const dummyHash = bcrypt.hashSync('not-a-real-user-password', 10);

  app.use((req, res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    if (req.get('sec-fetch-site') === 'cross-site') {
      return res.status(403).json({ erro: 'Origem não permitida.' });
    }
    const origin = req.get('origin');
    if (origin) {
      try {
        const parsed = new URL(origin);
        if (parsed.host !== req.get('host') ||
            !['http:', 'https:'].includes(parsed.protocol) ||
            (secureCookie && parsed.protocol !== 'https:')) {
          return res.status(403).json({ erro: 'Origem não permitida.' });
        }
      } catch (_) {
        return res.status(403).json({ erro: 'Origem não permitida.' });
      }
    }
    next();
  });

  async function authenticate(req, res, next) {
    const session = parseSession(readCookie(req), secret);
    if (!session) return res.status(401).json({ erro: 'Sessão expirada ou inválida.' });
    try {
      const admin = await Admin.findByPk(session.userId);
      if (!admin || passwordVersion(admin.senha) !== session.passwordVersion) {
        return res.status(401).json({ erro: 'Sessão expirada ou inválida.' });
      }
      req.authAdmin = admin;
      next();
    } catch (error) {
      console.error('Falha na verificação da sessão:', error.message);
      res.status(503).json({ erro: 'Autenticação temporariamente indisponível.' });
    }
  }

  app.post('/login', async (req, res) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const senha = typeof req.body?.senha === 'string' ? req.body.senha : '';
    if (email.length < 3 || email.length > 254 || senha.length < 1 || senha.length > 512) {
      return res.status(400).json({ erro: 'Credenciais inválidas.' });
    }
    const key = String(req.ip) + ':' + email;
    const now = Date.now();
    const previous = failures.get(key);
    if (previous && previous.expiresAt > now && previous.count >= MAX_LOGIN_FAILURES) {
      return res.status(429).json({ erro: 'Muitas tentativas. Tente novamente mais tarde.' });
    }
    try {
      const admin = await Admin.findOne({ where: { email } });
      const valid = await bcrypt.compare(senha, admin?.senha || dummyHash);
      if (!admin || !valid) {
        const count = previous && previous.expiresAt > now ? previous.count + 1 : 1;
        if (failures.size > 10000) failures.clear();
        failures.set(key, { count, expiresAt: now + FAILURE_WINDOW_MS });
        return res.status(401).json({ erro: 'E-mail ou senha inválidos.' });
      }
      failures.delete(key);
      res.cookie(COOKIE_NAME, createSession(admin, secret), cookieOptions);
      // Legacy frontend expects a flag. This value is NOT an auth credential.
      return res.json({ mensagem: 'Login aprovado!', token: 'sessao-validada' });
    } catch (error) {
      console.error('Erro no login:', error.message);
      return res.status(503).json({ erro: 'Login temporariamente indisponível.' });
    }
  });

  app.post('/logout', (req, res) => {
    res.clearCookie(COOKIE_NAME, { path: '/', secure: secureCookie, sameSite: 'strict', httpOnly: true });
    return res.status(204).end();
  });

  app.get('/auth/me', authenticate, (req, res) => {
    res.json({ autenticado: true, email: req.authAdmin.email });
  });

  // All business API routes defined after this point require a verified session.
  app.use(authenticate);
}

module.exports = { installSecurity, createSession, parseSession, passwordVersion };
