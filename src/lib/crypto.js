// End-to-end chat encryption (AES-256-GCM). Key = PBKDF2(roomCode [+ optional passphrase]).
// Chat is broadcast-only (never stored), and the payload on the wire is ciphertext.
const enc = new TextEncoder(), dec = new TextDecoder();
const b64 = u => { let s = ''; u.forEach(c => { s += String.fromCharCode(c); }); return btoa(s); };
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
export const cryptoOk = () => Boolean(globalThis.crypto?.subtle);
export async function deriveKey(secret, salt) {
  const base = await crypto.subtle.importKey('raw', enc.encode(secret), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: enc.encode(`laddus-world:${salt}`), iterations: 120000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
export async function seal(key, text) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(text)));
  return `${b64(iv)}.${b64(ct)}`;
}
export async function open(key, blob) {
  const [i, c] = String(blob).split('.');
  return dec.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(i) }, key, unb64(c)));
}
