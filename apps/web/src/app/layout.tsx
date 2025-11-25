import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Navigation } from '@/components/Navigation'
import { Providers } from '@/components/Providers'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'DataDock - AI-Powered Knowledge, Verified on Shelby',
  description: 'Transform your documents into AI-searchable knowledge with blockchain-verified sources. Lightning fast, cryptographically secure. Built on Shelby & Aptos.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>
          <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/30">
            {/* Animated background gradient */}
            <div className="fixed inset-0 bg-gradient-mesh opacity-30 pointer-events-none" />
            
            {/* Navigation */}
            <Navigation />
            
            {/* Main content */}
            <main className="relative">
              {children}
            </main>
          
          {/* Footer */}
          <footer className="relative border-t border-gray-200 bg-white/50 backdrop-blur-sm mt-20">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-accent-purple rounded-lg flex items-center justify-center">
                    <span className="text-white font-bold text-sm">D</span>
                  </div>
                  <span className="text-sm text-gray-600">
                    <span className="font-semibold text-gray-900">DataDock</span> - AI meets Blockchain on <span className="font-semibold text-primary-600">Shelby & Aptos</span>
                  </span>
                </div>
                
                <div className="flex gap-6 text-sm text-gray-600">
                  <a href="https://docs.shelby.xyz" target="_blank" rel="noopener noreferrer" 
                     className="hover:text-primary-600 transition-colors">
                    Documentation
                  </a>
                  <a href="https://github.com/shelby" target="_blank" rel="noopener noreferrer"
                     className="hover:text-primary-600 transition-colors">
                    GitHub
                  </a>
                  <a href="https://shelby.xyz" target="_blank" rel="noopener noreferrer"
                     className="hover:text-primary-600 transition-colors">
                    Shelby.xyz
                  </a>
                </div>
              </div>
            </div>
          </footer>
        </div>
        </Providers>
      </body>
    </html>
  )
}

