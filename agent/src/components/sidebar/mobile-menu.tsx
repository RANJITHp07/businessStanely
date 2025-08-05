'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { X, LayoutDashboard, CheckSquare, Settings, LogOut } from 'lucide-react'

interface MobileMenuProps {
  isOpen: boolean
  onClose: () => void
  onLogout: () => void
}

export default function MobileMenu({ isOpen, onClose, onLogout }: MobileMenuProps) {
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
    <div
      className={`fixed inset-0 z-40 lg:hidden transition-transform duration-300 ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      }`}
    >
      <div className="absolute inset-0 bg-black bg-opacity-40" onClick={onClose}></div>
      <div className="relative w-64 h-full bg-white border-r border-gray-200 z-50 flex flex-col">
        <div className="p-4 flex justify-between items-center border-b">
          <h1 className="text-lg font-bold">BusinessStanley</h1>
          <button onClick={onClose}>
            <X className="w-5 h-5 text-gray-700" />
          </button>
        </div>
        <nav className="flex-1 mt-4 pr-4 space-y-2">
          {links.map(({ href, label, icon }) => (
            <Link
              key={href}
              href={href}
              onClick={onClose}
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
        <div className="p-4 border-t">
          <button
            onClick={() => {
              onLogout()
              onClose()
            }}
            className="flex items-center gap-3 text-red-600 px-6 py-2 font-medium hover:bg-red-100 w-full rounded"
          >
            <LogOut className="h-5 w-5" />
            Logout
          </button>
        </div>
      </div>
    </div>
  )
}
