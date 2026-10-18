/**
 * "Install app" support (PWA).
 * The browser fires `beforeinstallprompt` once, early on page load, so this
 * module is imported by main.jsx at start-up to catch it; Settings → Install app
 * then shows the install button via usePwaInstall().
 */
import { useEffect, useState } from 'react'

let deferredPrompt = null
let installedNow   = false
const listeners    = new Set()
const emit = () => listeners.forEach(fn => fn())

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault()          // keep the event for our own button
    deferredPrompt = e
    emit()
  })
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    installedNow   = true
    emit()
  })
}

/** Register the service worker (production builds only). */
export function registerServiceWorker() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
  const register = () => navigator.serviceWorker.register('/sw.js').catch(() => {})
  if (document.readyState === 'complete') register()
  else window.addEventListener('load', register, { once: true })
}

function detect() {
  const ua = navigator.userAgent || ''
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true
  const iOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const firefox = /firefox|fxios/i.test(ua)
  const safari = /^((?!chrome|chromium|crios|android|edg).)*safari/i.test(ua)
  const edge = /edg\//i.test(ua)
  return { standalone, iOS, firefox, safari: safari && !iOS, edge, android: /android/i.test(ua) }
}

export function usePwaInstall() {
  const [, rerender] = useState(0)
  useEffect(() => {
    const fn = () => rerender(n => n + 1)
    listeners.add(fn)
    return () => listeners.delete(fn)
  }, [])

  const env = detect()
  return {
    ...env,
    installed:  installedNow || env.standalone,
    canInstall: !!deferredPrompt,
    /** Shows the browser's install dialog. Resolves to 'accepted' | 'dismissed' | 'unavailable'. */
    async promptInstall() {
      const e = deferredPrompt
      if (!e) return 'unavailable'
      deferredPrompt = null
      emit()
      await e.prompt()
      const choice = await e.userChoice.catch(() => ({ outcome: 'dismissed' }))
      if (choice?.outcome === 'accepted') { installedNow = true; emit() }
      return choice?.outcome ?? 'dismissed'
    },
  }
}
