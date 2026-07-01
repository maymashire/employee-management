import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'

export default function Layout() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />

      {/* Offset for fixed sidebar */}
      <div className="ml-64 flex flex-col min-h-screen">
        <Header />

        {/* Offset for fixed header */}
        <main className="mt-16 flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
