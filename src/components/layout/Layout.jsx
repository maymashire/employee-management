import { useCallback, useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'
import CommandPalette from '../CommandPalette'

const COLLAPSE_KEY = 'wf_sidebar_collapsed'
const DESKTOP_MQ   = '(min-width: 1024px)'

function useIsDesktop() {
  const get = () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(DESKTOP_MQ).matches : true)
  const [desktop, setDesktop] = useState(get)
  useEffect(() => {
    if (!window.matchMedia) return
    const mq = window.matchMedia(DESKTOP_MQ)
    const onChange = e => setDesktop(e.matches)
    mq.addEventListener?.('change', onChange)
    return () => mq.removeEventListener?.('change', onChange)
  }, [])
  return desktop
}

const isTyping = el => el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)

export default function Layout() {
  const isDesktop = useIsDesktop()
  const { pathname } = useLocation()
  const [mobileOpen,  setMobileOpen]  = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [collapsed,   setCollapsed]   = useState(() => {
    try { return localStorage.getItem(COLLAPSE_KEY) === '1' } catch { return false }
  })

  useEffect(() => { try { localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0') } catch {} }, [collapsed])
  useEffect(() => { setMobileOpen(false) }, [pathname])
  useEffect(() => { if (isDesktop) setMobileOpen(false) }, [isDesktop])

  // Lock page scroll while the mobile drawer is open
  useEffect(() => {
    if (!mobileOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [mobileOpen])

  const toggleSidebar = useCallback(() => {
    if (isDesktop) setCollapsed(c => !c)
    else setMobileOpen(o => !o)
  }, [isDesktop])

  // Shortcuts: Ctrl/⌘+K command palette · Ctrl/⌘+B sidebar · Esc closes drawer
  useEffect(() => {
    const onKey = e => {
      const mod = e.ctrlKey || e.metaKey
      if (mod && e.key.toLowerCase() === 'k') { e.preventDefault(); setPaletteOpen(o => !o) }
      else if (mod && e.key.toLowerCase() === 'b' && !isTyping(document.activeElement)) { e.preventDefault(); toggleSidebar() }
      else if (e.key === 'Escape') setMobileOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggleSidebar])

  const mini = isDesktop && collapsed

  return (
    <div className="min-h-screen" style={{ background: '#f0f4f8' }}>
      <Sidebar
        open={mobileOpen}
        mini={mini}
        isDesktop={isDesktop}
        onClose={() => setMobileOpen(false)}
        onToggle={toggleSidebar}
        onSearch={() => setPaletteOpen(true)}
      />

      {/* Desktop: offset for the fixed sidebar (256px, or 76px when collapsed) */}
      <div className={`flex flex-col min-h-screen transition-[margin] duration-300 ease-out ${collapsed ? 'lg:ml-[76px]' : 'lg:ml-64'}`}>
        <Header
          onMenuToggle={toggleSidebar}
          collapsed={collapsed}
          mobileOpen={mobileOpen}
          isDesktop={isDesktop}
          onOpenPalette={() => setPaletteOpen(true)}
        />

        <main className="mt-16 flex-1 p-3 sm:p-5 lg:p-7">
          <div className="max-w-[1400px] mx-auto w-full">
            <Outlet />
          </div>
        </main>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  )
}
