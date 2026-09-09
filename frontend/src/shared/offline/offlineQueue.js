import { get, set } from 'idb-keyval';
import client from '../api/client.js';

// Offline queue for the logistics write endpoints only (scope: OFFLINE
// channel improvements). Not wired into Withdrawals/OSPR/RTS/Transfers.
//
// A request that fails with a genuine network error (no HTTP response at
// all - the request never reached the server) is queued in IndexedDB instead
// of failing outright, and replayed once connectivity returns. A request
// that fails with a real HTTP error (validation, 409 duplicate, etc.) is
// never queued - it's surfaced to the caller immediately, same as today.

const QUEUE_KEY = 'logistics_offline_queue';
const FAILED_KEY = 'logistics_offline_failed';

let listeners = [];

function notify(state) {
  listeners.forEach((fn) => fn(state));
}

async function getState() {
  const [queue, failed] = await Promise.all([get(QUEUE_KEY), get(FAILED_KEY)]);
  return { pending: queue || [], failed: failed || [] };
}

async function saveQueue(queue) {
  await set(QUEUE_KEY, queue);
}

async function saveFailed(failed) {
  await set(FAILED_KEY, failed);
}

async function publish() {
  notify(await getState());
}

// Subscribe to {pending, failed} arrays. Returns an unsubscribe function.
export function subscribe(fn) {
  listeners.push(fn);
  getState().then(fn);
  return () => { listeners = listeners.filter((f) => f !== fn); };
}

function isNetworkError(err) {
  return !err?.response; // axios: no response means the request never reached the server
}

function describe(method, url) {
  return `${method.toUpperCase()} ${url}`;
}

// Drop-in replacement for client.get/post/put/delete for the logistics
// write calls. Resolves to { queued: false, data } when it actually went
// through, or { queued: true } when it's been saved for later.
export async function queuedRequest(method, url, data) {
  try {
    const res = await client.request({ method, url, data });
    return { queued: false, data: res.data };
  } catch (err) {
    if (!isNetworkError(err)) throw err;
    const { pending } = await getState();
    pending.push({ method, url, data, queuedAt: new Date().toISOString() });
    await saveQueue(pending);
    await publish();
    return { queued: true };
  }
}

// Replays queued requests in order. Stops at the first one that still can't
// reach the server (keeps remaining items queued, in order). A request that
// reaches the server but is now rejected (a real HTTP error - e.g. the
// receipt got closed by someone else while offline) is moved to the failed
// list instead of being retried forever.
export async function flushQueue() {
  const { pending } = await getState();
  if (pending.length === 0) return;

  const stillPending = [];
  const newlyFailed = [];

  for (let i = 0; i < pending.length; i++) {
    const item = pending[i];
    try {
      await client.request({ method: item.method, url: item.url, data: item.data });
    } catch (err) {
      if (isNetworkError(err)) {
        stillPending.push(item, ...pending.slice(i + 1));
        break;
      }
      newlyFailed.push({ ...item, error: err.message, label: describe(item.method, item.url) });
    }
  }

  await saveQueue(stillPending);
  if (newlyFailed.length > 0) {
    const { failed } = await getState();
    await saveFailed([...failed, ...newlyFailed]);
  }
  await publish();
}

export async function clearFailed() {
  await saveFailed([]);
  await publish();
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { flushQueue(); });
  flushQueue();
}
