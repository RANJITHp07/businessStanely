'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { Menu } from 'lucide-react'
import Sidebar from '../../components/sidebar/sidebar'
import MobileMenu from '../../components/sidebar/mobile-menu'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)

  const getPageName = (path: string) => {
    switch (path) {
      case '/dashboard':
        return 'Dashboard'
      case '/task':
        return 'My Tasks'
      case '/settings':
        return 'Settings'
      default:
        return 'Dashboard'
    }
  }

  const getCurrentDate = () => {
    const date = new Date()
    const day = date.getDate()
    const weekday = date.toLocaleDateString('en-US', { weekday: 'long' })
    const month = date.toLocaleDateString('en-US', { month: 'long' })
    const year = date.getFullYear()
    return `${day} ${weekday} ${month} ${year}`
  }

  const handleLogout = () => {
    console.log('Logout clicked')
  }

  return (
    <div className="flex min-h-screen bg-gray-100">
      {/* Sidebar for large screens */}
      <div className="hidden lg:block h-screen sticky top-0">
        <Sidebar onLogout={handleLogout} />
      </div>

      {/* Mobile Menu */}
      <MobileMenu
        isOpen={menuOpen}
        onClose={() => setMenuOpen(false)}
        onLogout={handleLogout}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col w-0">
        {/* Topbar for mobile */}
        <header className="lg:hidden bg-white border-b border-gray-200 px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-gray-900">BusinessStanley</h1>
          <button className="text-gray-700" onClick={() => setMenuOpen(true)}>
            <Menu className="h-6 w-6" />
          </button>
        </header>

        {/* Page Title & Date */}
        <div className="lg:px-6 px-4 py-4 lg:pt-6 bg-white">
          <h2 className="text-[20px] font-semibold text-gray-800">
            {getPageName(pathname)}
          </h2>
          <p className="text-[16px] mt-[2px] text-gray-500">{getCurrentDate()}</p>
        </div>

        {/* Page Content */}
        <main className="px-4 lg:px-6 py-4 bg-[#f5f7ff]">
          {children}
        </main>
      </div>
    </div>
  )
}
