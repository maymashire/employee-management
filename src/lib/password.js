/**
 * Password helpers for the Firestore-backed login.
 * Passwords are never stored — only a salted PBKDF2-SHA256 hash.
 */
const ITERATIONS = 120000
const enc     = new TextEncoder()
const toHex   = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('')
const fromHex = hex => new Uint8Array((hex.match(/../g) ?? []).map(h => parseInt(h, 16)))

export const MIN_PASSWORD = 8

export async function hashPassword(password, saltHex) {
  const salt = saltHex ? fromHex(saltHex) : crypto.getRandomValues(new Uint8Array(16))
  const key  = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' }, key, 256)
  return { hash: toHex(bits), salt: toHex(salt) }
}

export async function verifyPassword(password, saltHex, hashHex) {
  if (!saltHex || !hashHex) return false
  const { hash } = await hashPassword(password, saltHex)
  let diff = hash.length ^ hashHex.length
  for (let i = 0; i < Math.min(hash.length, hashHex.length); i++) diff |= hash.charCodeAt(i) ^ hashHex.charCodeAt(i)
  return diff === 0
}

const CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*?'

export function generatePassword(length = 12) {
  const pick = set => set[crypto.getRandomValues(new Uint32Array(1))[0] % set.length]
  // Guarantee one of each class, then fill and shuffle
  const chars = [pick('ABCDEFGHJKLMNPQRSTUVWXYZ'), pick('abcdefghijkmnpqrstuvwxyz'), pick('23456789'), pick('!@#$%&*?')]
  while (chars.length < length) chars.push(pick(CHARSET))
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]]
  }
  return chars.join('')
}

export function passwordChecks(pw = '') {
  return [
    { label: `At least ${MIN_PASSWORD} characters`, ok: pw.length >= MIN_PASSWORD },
    { label: 'Upper & lower case letters',          ok: /[a-z]/.test(pw) && /[A-Z]/.test(pw) },
    { label: 'A number',                            ok: /\d/.test(pw) },
    { label: 'A symbol',                            ok: /[^A-Za-z0-9]/.test(pw) },
  ]
}

const LEVELS = [
  { label: 'Too weak', bar: 'bg-rose-500',    text: 'text-rose-600' },
  { label: 'Weak',     bar: 'bg-orange-500',  text: 'text-orange-600' },
  { label: 'Fair',     bar: 'bg-amber-500',   text: 'text-amber-600' },
  { label: 'Good',     bar: 'bg-sky-500',     text: 'text-sky-600' },
  { label: 'Strong',   bar: 'bg-emerald-500', text: 'text-emerald-600' },
]

export function passwordStrength(pw = '') {
  if (!pw) return { score: 0, ...LEVELS[0], label: '' }
  let score = passwordChecks(pw).filter(c => c.ok).length
  if (pw.length < MIN_PASSWORD) score = Math.min(score, 1)
  if (pw.length >= 14 && score >= 3) score = 4
  return { score, ...LEVELS[score] }
}

/** Returns an error message, or '' when the new password is acceptable. */
export function validateNewPassword(pw, confirm) {
  if (!pw) return 'Enter a password.'
  if (pw.length < MIN_PASSWORD) return `Password must be at least ${MIN_PASSWORD} characters.`
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return 'Password must contain letters and at least one number.'
  if (confirm !== undefined && pw !== confirm) return 'Passwords do not match.'
  return ''
}
