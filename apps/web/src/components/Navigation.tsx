'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Package, MessageCircle, LogIn, LogOut, User, Sparkles } from 'lucide-react'
import { useSession, signOut } from 'next-auth/react'

export function Navigation() {
  const pathname = usePathname()
  const { data: session, status } = useSession()

  const links = [
    { href: '/', label: 'Discover', icon: Home },
    { href: '/packs', label: 'My Packs', icon: Package },
    { href: '/chat', label: 'Chat', icon: MessageCircle },
  ]

  return (
    <nav className="relative border-b border-white/20 bg-white/70 backdrop-blur-xl sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-primary-500 to-accent-purple rounded-xl blur-lg opacity-50 group-hover:opacity-75 transition-opacity" />
              <div className="relative w-10 h-10 bg-gradient-to-br from-primary-500 to-accent-purple rounded-xl flex items-center justify-center transform group-hover:scale-105 transition-transform">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-bold gradient-text">
                Shelby RAG
              </span>
              <span className="text-xs text-gray-500">Verifiable Citations</span>
            </div>
          </Link>

          {/* Navigation Links */}
          <div className="flex items-center gap-2">
            {links.map((link) => {
              const Icon = link.icon
              const isActive = pathname === link.href
              
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`
                    flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all
                    ${isActive 
                      ? 'bg-gradient-to-r from-primary-500 to-accent-purple text-white shadow-lg shadow-primary-500/30' 
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    }
                  `}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{link.label}</span>
                </Link>
              )
            })}
            
            {/* Auth Button */}
            {session ? (
              <div className="flex items-center gap-3 ml-2">
                {/* User Info */}
                <div className="hidden md:flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-lg">
                  <User className="w-4 h-4 text-gray-600" />
                  <span className="text-sm text-gray-700 max-w-[150px] truncate">
                    {session.user?.email}
                  </span>
                </div>
                
                {/* Logout Button */}
                <button
                  onClick={() => signOut({ callbackUrl: '/' })}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm text-gray-600 hover:text-red-600 hover:bg-red-50 transition-all"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline">Logout</span>
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-all ml-2"
              >
                <LogIn className="w-4 h-4" />
                <span className="hidden sm:inline">Login</span>
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}

