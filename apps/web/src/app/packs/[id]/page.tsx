'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, FileText, Hash, ExternalLink, Calendar, Tag, Eye, EyeOff, Globe, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { getPack, deleteDocument, deletePack } from '@/lib/api'
import { formatDistanceToNow } from 'date-fns'

export default function PackDetailPage() {
  const params = useParams()
  const router = useRouter()
  const packId = params.id as string
  
  const [pack, setPack] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadPack()
  }, [packId])

  const loadPack = async () => {
    try {
      setLoading(true)
      const result = await getPack(packId)
      setPack(result)
    } catch (err: any) {
      setError(err.message || 'Failed to load pack')
    } finally {
      setLoading(false)
    }
  }

  const handleDeletePack = async () => {
    if (!confirm('Are you sure you want to delete this pack? This cannot be undone.')) {
      return
    }

    try {
      await deletePack(packId)
      router.push('/packs')
    } catch (err: any) {
      alert(err.message || 'Failed to delete pack')
    }
  }

  const handleDeleteDoc = async (docId: string) => {
    if (!confirm('Are you sure you want to delete this document?')) {
      return
    }

    try {
      await deleteDocument(packId, docId)
      // Reload pack
      await loadPack()
    } catch (err: any) {
      alert(err.message || 'Failed to delete document')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (error || !pack) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Pack not found</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <Link
            href="/packs"
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary-500 text-white rounded-xl font-medium hover:bg-primary-600 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Packs</span>
          </Link>
        </div>
      </div>
    )
  }

  const timeAgo = formatDistanceToNow(new Date(pack.pack.created_at), { addSuffix: true })

  return (
    <div className="min-h-screen px-4 sm:px-6 lg:px-8 py-12">
      <div className="max-w-6xl mx-auto">
        {/* Back Button */}
        <Link
          href="/packs"
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Packs</span>
        </Link>

        {/* Pack Header */}
        <div className="glass rounded-3xl p-8 mb-8 shadow-xl">
          <div className="flex items-start justify-between mb-6">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-16 h-16 bg-gradient-to-br from-primary-500 to-accent-purple rounded-2xl flex items-center justify-center">
                  <FileText className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">
                    {pack.pack.title}
                  </h1>
                  <p className="text-sm text-gray-500 flex items-center gap-2 mt-1">
                    <Calendar className="w-4 h-4" />
                    Created {timeAgo}
                  </p>
                </div>
              </div>

              {pack.pack.summary && (
                <p className="text-gray-600 mb-4">{pack.pack.summary}</p>
              )}

              {pack.pack.tags && pack.pack.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {pack.pack.tags.map((tag: string, i: number) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-primary-50 text-primary-700 text-sm font-medium rounded-lg"
                    >
                      <Tag className="w-3 h-3" />
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              {/* Visibility Badge */}
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white border-2 border-gray-200">
                {pack.pack.visibility === 'public' ? (
                  <>
                    <Globe className="w-5 h-5 text-green-600" />
                    <span className="font-medium text-green-700">Public</span>
                  </>
                ) : pack.pack.visibility === 'unlisted' ? (
                  <>
                    <Eye className="w-5 h-5 text-yellow-600" />
                    <span className="font-medium text-yellow-700">Unlisted</span>
                  </>
                ) : (
                  <>
                    <EyeOff className="w-5 h-5 text-gray-600" />
                    <span className="font-medium text-gray-700">Private</span>
                  </>
                )}
              </div>

              {/* Delete Pack Button */}
              <button
                onClick={handleDeletePack}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-50 text-red-700 border-2 border-red-200 hover:bg-red-100 transition-colors"
                title="Delete pack"
              >
                <Trash2 className="w-4 h-4" />
                <span className="text-sm font-medium">Delete Pack</span>
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-white/60 rounded-xl">
              <div className="text-2xl font-bold text-primary-600">
                {pack.docs.length}
              </div>
              <div className="text-sm text-gray-600">Documents</div>
            </div>
            <div className="text-center p-4 bg-white/60 rounded-xl">
              <div className="text-2xl font-bold text-accent-purple">
                {pack.docs.reduce((sum: number, d: any) => sum + d.bytes, 0) / 1024 / 1024 < 1
                  ? `${(pack.docs.reduce((sum: number, d: any) => sum + d.bytes, 0) / 1024).toFixed(0)} KB`
                  : `${(pack.docs.reduce((sum: number, d: any) => sum + d.bytes, 0) / 1024 / 1024).toFixed(1)} MB`
                }
              </div>
              <div className="text-sm text-gray-600">Total Size</div>
            </div>
            <div className="text-center p-4 bg-white/60 rounded-xl">
              <div className="text-2xl font-bold text-secondary-500">
                {pack.pack.visibility}
              </div>
              <div className="text-sm text-gray-600">Visibility</div>
            </div>
            <div className="text-center p-4 bg-white/60 rounded-xl">
              <div className="text-2xl font-bold text-blue-600">
                {pack.pack.pack_id.slice(0, 8)}...
              </div>
              <div className="text-sm text-gray-600">Pack ID</div>
            </div>
          </div>
        </div>

        {/* Documents List */}
        <div className="glass rounded-2xl p-8 shadow-xl">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Documents</h2>

          {pack.docs.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No documents in this pack</p>
          ) : (
            <div className="space-y-3">
              {pack.docs.map((doc: any) => (
                <div
                  key={doc.doc_id}
                  className="p-4 bg-white rounded-xl border border-gray-200 hover:border-primary-300 hover:shadow-md transition-all"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4 flex-1 min-w-0">
                      <FileText className="w-6 h-6 text-primary-600 flex-shrink-0 mt-1" />
                      
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-gray-900 mb-1 truncate">
                          {doc.path}
                        </h3>
                        
                        <div className="flex flex-wrap gap-3 text-sm text-gray-500">
                          <span>{doc.mime}</span>
                          <span>•</span>
                          <span>{(doc.bytes / 1024).toFixed(1)} KB</span>
                        </div>

                        {/* Shelby Blob ID */}
                        <div className="mt-2 p-2 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-2 text-xs">
                            <Hash className="w-3 h-3 text-gray-400" />
                            <code className="text-gray-600 font-mono truncate">
                              {doc.shelby_blob_id}
                            </code>
                          </div>
                        </div>

                        {/* SHA256 */}
                        <div className="mt-1 p-2 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-2 text-xs">
                            <Hash className="w-3 h-3 text-gray-400" />
                            <code className="text-gray-600 font-mono truncate">
                              SHA256: {doc.sha256}
                            </code>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <a
                        href={(() => {
                          // Parse blob_id format: account/blobname
                          const parts = doc.shelby_blob_id.split('/')
                          const account = parts[0]
                          const blobName = parts.slice(1).join('/')
                          return `https://explorer.shelby.xyz/shelbynet/account/${account}/blobs?name=${blobName}`
                        })()}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                        title="View on Shelby Explorer"
                      >
                        <ExternalLink className="w-5 h-5" />
                      </a>

                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteDoc(doc.doc_id)
                        }}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete document"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="mt-8 flex justify-center">
          <Link
            href={`/chat?pack=${packId}`}
            className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-primary-500 to-accent-purple text-white font-semibold rounded-xl shadow-lg shadow-primary-500/30 hover:shadow-xl hover:scale-105 transition-all"
          >
            <span>Ask Questions About This Pack</span>
            <ArrowLeft className="w-5 h-5 rotate-180" />
          </Link>
        </div>
      </div>
    </div>
  )
}

