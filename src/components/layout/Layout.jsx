import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="min-h-screen" style={{ background: '#f0f4f8' }}>
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Desktop: offset for fixed 256px sidebar; mobile: full-width */}
      <div className="lg:ml-64 flex flex-col min-h-screen">
        <Header onMenuToggle={() => setSidebarOpen(o => !o)} />

        {/* Offset for fixed header; smaller padding on mobile */}
        <main className="mt-16 flex-1 p-3 sm:p-5 lg:p-7">
          <div className="max-w-[1400px] mx-auto w-full">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
