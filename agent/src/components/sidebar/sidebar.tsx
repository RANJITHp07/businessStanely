'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, CheckSquare, Settings, LogOut } from 'lucide-react'

interface SidebarProps {
  onLogout: () => void
}

export default function Sidebar({ onLogout }: SidebarProps) {
  const pathname = usePathname()

  const links = [
    {
      href: '/dashboard',
      label: 'Dashboard',
      icon: <LayoutDashboard className="h-[22px] w-[22px]" />,
    },
    {
      href: '/task',
      label: 'My Tasks',
      icon: <CheckSquare className="h-[22px] w-[22px]" />,
    },
    {
      href: '/settings',
      label: 'Settings',
      icon: <Settings className="h-[22px] w-[22px]" />,
    },
  ]

  return (
    <aside className="h-screen w-64 bg-white border-r border-gray-200 text-black flex-col hidden lg:flex">
      <div className="p-6">
        <h1 className="text-xl font-bold">BusinessStanley</h1>
      </div>
      <nav className="flex-1 mt-4 pr-4 space-y-2">
        {links.map(({ href, label, icon }) => (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-3 px-6 py-2 text-[17px] font-medium transition-all duration-200 rounded-r-lg ${
              pathname === href
                ? 'bg-blue-600 text-white border-r-4 border-blue-600'
                : 'hover:bg-blue-600 hover:text-white'
            }`}
          >
            {icon}
            {label}
          </Link>
        ))}
      </nav>
      <div className="p-4  mt-auto">
        <button
          onClick={onLogout}
          className="flex items-center gap-3 text-red-600 px-6 py-2 font-medium hover:bg-red-100 w-full rounded"
        >
          <LogOut className="h-5 w-5" />
          Logout
        </button>
      </div>
    </aside>
  )
}
