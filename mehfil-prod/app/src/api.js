// HTTP client for the Mehfil server: tokens, automatic refresh, guest sessions.
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

const extra = Constants.expoConfig?.extra ?? {};
export const API_URL = String(extra.apiUrl || 'http://10.0.2.2:8080').replace(/\/$/, '');
export const WS_URL = API_URL.replace(/^http/, 'ws') + '/ws';
export const CHANNEL = extra.channel === 'play' ? 'play' : 'apk'; // apk → Razorpay, play → Google Play Billing

export class ApiError extends Error {
  constructor(status, code, message, extra) { super(message); this.status = status; this.code = code; this.extra = extra || {}; }
}

const mem = {};
const store = {
  async get(k) { try { return await SecureStore.getItemAsync(k); } catch { return mem[k] ?? null; } },
  async set(k, v) { try { await SecureStore.setItemAsync(k, v); } catch { mem[k] = v; } },
  async del(k) { try { await SecureStore.deleteItemAsync(k); } catch { delete mem[k]; } },
};

const state = { access: null, refresh: null, guest: true, user: null };
const listeners = new Set();
export const session = {
  get access() { return state.access; },
  get guest() { return state.guest; },
  get user() { return state.user; },
  onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
};
const changed = () => listeners.forEach((f) => f({ ...state }));

async function raw(method, path, body, token) {
  let res;
  try {
    res = await fetch(API_URL + path, {
      method,
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'offline', 'No internet connection — please try again');
  }
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const { error, message, ...rest } = (data && typeof data === 'object') ? data : {};
    throw new ApiError(res.status, error || 'error', message || 'Something went wrong', rest);
  }
  return data;
}

let refreshing = null;
async function doRefresh() {
  if (!state.refresh) return false;
  if (!refreshing) {
    refreshing = raw('POST', '/auth/refresh', { refresh: state.refresh })
      .then(async (t) => { state.access = t.access; state.refresh = t.refresh; await store.set('refresh', t.refresh); return true; })
      .catch(async (e) => { if (e.status === 401) await clearSession(); return false; })
      .finally(() => { refreshing = null; });
  }
  return refreshing;
}

export async function api(method, path, body) {
  try {
    return await raw(method, path, body, state.access);
  } catch (e) {
    if (e.status === 401 && state.refresh && (await doRefresh())) return raw(method, path, body, state.access);
    throw e;
  }
}

export async function guestLogin() {
  const g = await raw('POST', '/auth/guest', {});
  state.access = g.access; state.guest = true; state.user = null; state.refresh = null;
  changed();
}

/** Restore a saved sign-in, or fall back to a guest session. */
export async function restoreSession() {
  state.refresh = await store.get('refresh');
  if (state.refresh && (await doRefresh())) {
    state.guest = false;
    try { const me = await raw('GET', '/me', undefined, state.access); state.user = me.user; } catch { /* offline */ }
    changed();
    return true;
  }
  await guestLogin();
  return false;
}

export async function requestOtp(phone) { return raw('POST', '/auth/otp/request', { phone }); }

export async function verifyOtp(payload) {
  const r = await raw('POST', '/auth/otp/verify', payload);
  state.access = r.access; state.refresh = r.refresh; state.guest = false; state.user = r.user;
  await store.set('refresh', r.refresh);
  changed();
  return r.user;
}

export async function clearSession() {
  state.access = null; state.refresh = null; state.user = null; state.guest = true;
  await store.del('refresh');
  changed();
}

export async function logout() {
  if (state.refresh) await raw('POST', '/auth/logout', { refresh: state.refresh }).catch(() => {});
  await clearSession();
  await guestLogin();
}

export const idemKey = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

function expOf(token) {
  try {
    const p = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = typeof atob === 'function' ? atob(p) : Buffer.from(p, 'base64').toString();
    return JSON.parse(json).exp * 1000;
  } catch { return 0; }
}

/** An access token valid for at least another minute (refreshing or re-issuing a guest token if needed). */
export async function freshAccess() {
  if (state.access && expOf(state.access) - Date.now() > 60000) return state.access;
  if (state.refresh && (await doRefresh())) return state.access;
  await guestLogin();
  return state.access;
}
