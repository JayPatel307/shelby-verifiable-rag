'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Package } from 'lucide-react'
import { Uploader } from '@/components/Uploader'
import { PackCard } from '@/components/PackCard'
import { listMyPacks, updateVisibility, type Pack } from '@/lib/api'

export default function PacksPage() {
  const [packs, setPacks] = useState<Pack[]>([])
  const [loading, setLoading] = useState(true)
  const [showUploader, setShowUploader] = useState(false)
  const router = useRouter()

  useEffect(() => {
    loadPacks()
  }, [])

  const loadPacks = async () => {
    try {
      setLoading(true)
      const result = await listMyPacks()
      setPacks(result.items)
    } catch (error: any) {
      console.error('Failed to load packs:', error)
      // If unauthorized, redirect to login
      if (error.message.includes('unauthorized') || error.message.includes('401')) {
        router.push('/login')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleVisibilityChange = async (packId: string, visibility: 'private' | 'public' | 'unlisted') => {
    try {
      await updateVisibility(packId, visibility)
      // Reload packs
      await loadPacks()
    } catch (error: any) {
      console.error('Failed to update visibility:', error)
      alert(error.message)
    }
  }

  const handleUploadSuccess = (packId: string) => {
    setShowUploader(false)
    loadPacks()
    router.push(`/packs/${packId}`)
  }

  return (
    <div className="min-h-screen px-4 sm:px-6 lg:px-8 py-12">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-12">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">My Packs</h1>
            <p className="text-lg text-gray-600">
              Create and manage your document collections
            </p>
          </div>

          <button
            onClick={() => setShowUploader(!showUploader)}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-primary-500 to-accent-purple text-white font-semibold rounded-xl shadow-lg shadow-primary-500/30 hover:shadow-xl hover:shadow-primary-500/40 hover:scale-105 transition-all"
          >
            <Plus className="w-5 h-5" />
            <span>New Pack</span>
          </button>
        </div>

        {/* Uploader Modal */}
        {showUploader && (
          <div className="mb-12 animate-slide-down">
            <div className="glass rounded-2xl p-8 shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Create New Pack</h2>
                <button
                  onClick={() => setShowUploader(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <Uploader onSuccess={handleUploadSuccess} />
            </div>
          </div>
        )}

        {/* Packs List */}
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
            <div className="glass rounded-3xl p-12 max-w-md mx-auto">
              <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-2xl font-semibold text-gray-900 mb-2">
                No packs yet
              </h3>
              <p className="text-gray-600 mb-6">
                Create your first pack to get started with verifiable RAG!
              </p>
              <button
                onClick={() => setShowUploader(true)}
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-primary-500 to-accent-purple text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all"
              >
                <Plus className="w-5 h-5" />
                <span>Create Your First Pack</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {packs.map((pack) => (
              <PackCard
                key={pack.pack_id}
                pack={pack}
                showActions={true}
                onVisibilityChange={handleVisibilityChange}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

