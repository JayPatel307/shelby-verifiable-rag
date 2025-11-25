'use client'

import { useState, useEffect } from 'react'
import { Search, Shield, Zap, Package, ArrowRight, Rocket } from 'lucide-react'
import { discoverPacks, type Pack } from '@/lib/api'
import { PackCard } from '@/components/PackCard'
import Link from 'next/link'

export default function HomePage() {
  const [packs, setPacks] = useState<Pack[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadPacks()
  }, [])

  const loadPacks = async () => {
    try {
      setLoading(true)
      const result = await discoverPacks()
      setPacks(result.items)
    } catch (error) {
      console.error('Failed to load packs:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = async () => {
    try {
      setLoading(true)
      const result = await discoverPacks(searchQuery)
      setPacks(result.items)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative">
      {/* Hero Section */}
      <section className="relative pt-20 pb-32 px-4 sm:px-6 lg:px-8 overflow-hidden">
        {/* Animated gradient orbs */}
        <div className="absolute top-20 right-10 w-72 h-72 bg-primary-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse" />
        <div className="absolute bottom-20 left-10 w-72 h-72 bg-accent-purple rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse delay-1000" />
        
        <div className="relative max-w-7xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/40 backdrop-blur-sm border border-pink-300/50 text-primary-700 text-sm font-medium mb-8 animate-slide-down shadow-lg shadow-pink-500/20">
            <Rocket className="w-4 h-4" />
            <span>AI-Powered • Blockchain-Verified • Built on Shelby & Aptos</span>
          </div>

          {/* Main Heading */}
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold mb-6 animate-slide-up">
            <span className="text-4xl sm:text-5xl lg:text-6xl block mb-2 text-gray-800">DataDock</span>
            <span className="gradient-text">AI-Powered Knowledge</span>
            <br />
            <span className="text-gray-900">Verified on Shelby</span>
          </h1>

          {/* Description */}
          <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-12 animate-fade-in">
            Your documents meet{' '}
            <span className="font-semibold text-primary-600">AI intelligence</span>.{' '}
            Get{' '}
            <span className="font-semibold text-primary-600">instant answers</span> with{' '}
            <span className="font-semibold text-primary-600">blockchain-verified</span> sources.{' '}
            Built on Shelby for unmatched speed and trust.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16 animate-fade-in">
            <Link
              href="/packs"
              className="group inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-gradient-to-r from-primary-500 to-accent-purple text-white font-semibold shadow-lg shadow-primary-500/30 hover:shadow-xl hover:shadow-primary-500/40 hover:scale-105 transition-all"
            >
              <Package className="w-5 h-5" />
              <span>Create Your Pack</span>
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            
            <Link
              href="/chat"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-white/60 backdrop-blur-sm text-gray-900 font-semibold border-2 border-pink-200 hover:border-primary-300 hover:bg-white/80 transition-all shadow-lg shadow-pink-500/10"
            >
              <Zap className="w-5 h-5" />
              <span>Try Demo</span>
            </Link>
          </div>

          {/* Features */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {[
              {
                icon: Rocket,
                title: '⚡ Lightning Fast',
                description: "Powered by Aptos and Shelby's unparalleled speed",
              },
              {
                icon: Shield,
                title: 'Verifiable',
                description: 'Every citation includes Shelby blob ID + SHA256 hash',
              },
              {
                icon: Package,
                title: 'Source Packs',
                description: 'Organize documents into shareable collections',
              },
              {
                icon: Zap,
                title: 'Semantic Search',
                description: 'Vector embeddings find exactly what you need',
              },
            ].map((feature, i) => (
              <div
                key={i}
                className="glass rounded-2xl p-6 hover:shadow-lg transition-all animate-scale-in"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                <feature.icon className="w-8 h-8 text-primary-600 mb-4" />
                <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
                <p className="text-gray-600 text-sm">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Discover Section */}
      <section className="relative px-4 sm:px-6 lg:px-8 pb-20">
        <div className="max-w-7xl mx-auto">
          {/* Section Header */}
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Discover Public Packs
            </h2>
            <p className="text-lg text-gray-600">
              Explore knowledge shared by the community
            </p>
          </div>

          {/* Search Bar */}
          <div className="max-w-2xl mx-auto mb-12">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Search packs by title or tags..."
                className="w-full px-6 py-4 pr-32 rounded-xl border-2 border-pink-200 bg-white/60 backdrop-blur-sm focus:border-primary-500 focus:ring-4 focus:ring-primary-100 focus:bg-white/80 outline-none transition-all text-lg"
              />
              <button
                onClick={handleSearch}
                className="absolute right-2 top-1/2 -translate-y-1/2 px-6 py-2 bg-gradient-to-r from-primary-500 to-accent-purple text-white rounded-lg font-medium hover:shadow-lg transition-all flex items-center gap-2"
              >
                <Search className="w-4 h-4" />
                <span>Search</span>
              </button>
            </div>
          </div>

          {/* Packs Grid */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="glass rounded-2xl p-6 animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-4" />
                  <div className="h-3 bg-gray-200 rounded w-1/2 mb-2" />
                  <div className="h-3 bg-gray-200 rounded w-2/3" />
                </div>
              ))}
            </div>
          ) : packs.length === 0 ? (
            <div className="text-center py-20">
              <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-600 mb-2">
                No public packs yet
              </h3>
              <p className="text-gray-500 mb-6">
                Be the first to share your knowledge!
              </p>
              <Link
                href="/packs"
                className="inline-flex items-center gap-2 px-6 py-3 bg-primary-500 text-white rounded-lg font-medium hover:bg-primary-600 transition-colors"
              >
                <Package className="w-4 h-4" />
                <span>Create Pack</span>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {packs.map((pack) => (
                <PackCard key={pack.pack_id} pack={pack} />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

