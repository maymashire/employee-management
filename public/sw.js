/*
 * Teamora service worker.
 * Makes the app installable and shows a friendly page when a navigation fails
 * offline. It deliberately caches nothing, so every deploy is picked up
 * immediately and no one is ever stuck on an old version.
 */
const OFFLINE_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Teamora · Offline</title>
<style>
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
    font-family:system-ui,-apple-system,'Segoe UI',sans-serif;background:#0f172a;color:#e2e8f0;text-align:center;padding:24px}
  h1{font-size:22px;margin:20px 0 8px;color:#fff} p{margin:0 0 20px;color:#94a3b8;font-size:14px}
  button{font:inherit;font-weight:600;padding:10px 18px;border-radius:12px;border:0;background:#1e3a8a;color:#fff;cursor:pointer}
</style></head><body><main>
<svg width="64" height="64" viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="16" fill="#1e3a8a"/>
<circle cx="32" cy="17" r="4.2" fill="#fbbf24"/><circle cx="42.6" cy="21.4" r="4.2" fill="#fff"/><circle cx="47" cy="32" r="4.2" fill="#fff"/>
<circle cx="42.6" cy="42.6" r="4.2" fill="#fff"/><circle cx="32" cy="47" r="4.2" fill="#fff"/><circle cx="21.4" cy="42.6" r="4.2" fill="#fff"/>
<circle cx="17" cy="32" r="4.2" fill="#fff"/><circle cx="21.4" cy="21.4" r="4.2" fill="#fff"/></svg>
<h1>You're offline</h1><p>Teamora needs an internet connection. Check your connection and try again.</p>
<button onclick="location.reload()">Try again</button></main></body></html>`

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()))

self.addEventListener('fetch', event => {
  if (event.request.mode !== 'navigate') return   // assets, API calls: straight to the network
  event.respondWith(
    fetch(event.request).catch(() =>
      new Response(OFFLINE_HTML, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })),
  )
})
