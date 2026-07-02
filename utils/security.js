const crypto = require('crypto');

const PASSWORD_ITERATIONS = 120000;
const KEY_LENGTH = 64;
const DIGEST = 'sha512';

const base64Url = (input) =>
  Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

const fromBase64Url = (input) => {
  const base64 = String(input || '')
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const padded = `${base64}${'='.repeat((4 - (base64.length % 4)) % 4)}`;

  return Buffer.from(padded, 'base64').toString('utf8');
};

const hashPassword = (password) => {
  const salt = crypto.randomBytes(16).toString('hex');

  const hash = crypto
    .pbkdf2Sync(String(password), salt, PASSWORD_ITERATIONS, KEY_LENGTH, DIGEST)
    .toString('hex');

  return `${PASSWORD_ITERATIONS}:${salt}:${hash}`;
};

const verifyPassword = (password, storedHash) => {
  if (!password || !storedHash) return false;

  const parts = String(storedHash).split(':');

  if (parts.length !== 3) return false;

  const [iterations, salt, originalHash] = parts;

  const hash = crypto
    .pbkdf2Sync(String(password), salt, Number(iterations), KEY_LENGTH, DIGEST)
    .toString('hex');

  return crypto.timingSafeEqual(
    Buffer.from(hash, 'hex'),
    Buffer.from(originalHash, 'hex')
  );
};

const generateSixDigitCode = () => {
  return crypto.randomInt(100000, 1000000).toString();
};

const hashCode = (code) => {
  return crypto
    .createHash('sha256')
    .update(String(code))
    .digest('hex');
};

const verifyCode = (code, hashedCode) => {
  if (!code || !hashedCode) return false;

  const codeHash = hashCode(code);

  return crypto.timingSafeEqual(
    Buffer.from(codeHash, 'hex'),
    Buffer.from(hashedCode, 'hex')
  );
};

const signToken = (payload) => {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error('JWT_SECRET is required');
  }

  const header = base64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));

  const expiresInSeconds = Number(process.env.JWT_EXPIRES_IN_SECONDS || 86400);

  const body = base64Url(
    JSON.stringify({
      ...payload,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
    })
  );

  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${header}.${body}`)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${header}.${body}.${signature}`;
};

const verifyToken = (token) => {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error('JWT_SECRET is required');
  }

  const parts = String(token || '').split('.');

  if (parts.length !== 3) {
    return null;
  }

  const [header, body, signature] = parts;
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(`${header}.${body}`)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return null;
  }

  const payload = JSON.parse(fromBase64Url(body));

  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
    return null;
  }

  return payload;
};

module.exports = {
  generateSixDigitCode,
  hashCode,
  hashPassword,
  signToken,
  verifyCode,
  verifyToken,
  verifyPassword,
};
