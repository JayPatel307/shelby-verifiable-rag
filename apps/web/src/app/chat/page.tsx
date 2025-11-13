'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Send, Loader2, Shield, CheckCircle, XCircle, ExternalLink } from 'lucide-react'
import { queryPrivate, queryPublic, verifyBlob, listMyPacks, type Citation, type Pack } from '@/lib/api'

export default function ChatPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const preselectedPack = searchParams.get('pack')
  
  const [packs, setPacks] = useState<Pack[]>([])
  const [selectedPack, setSelectedPack] = useState<string>(preselectedPack || 'all')
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [citations, setCitations] = useState<Citation[]>([])
  const [loading, setLoading] = useState(false)
  const [verifying, setVerifying] = useState<Record<string, boolean>>({})
  const [verified, setVerified] = useState<Record<string, { ok: boolean; hash: string }>>({})

  useEffect(() => {
    loadPacks()
  }, [])

  const loadPacks = async () => {
    try {
      const result = await listMyPacks()
      setPacks(result.items)
    } catch (error: any) {
      if (error.message.includes('unauthorized')) {
        router.push('/login')
      }
    }
  }

  const handleQuery = async () => {
    if (!question.trim()) return

    setAnswer('')
    setCitations([])
    setVerified({})
    setLoading(true)

    try {
      const result = selectedPack === 'all'
        ? await queryPrivate(question)
        : await queryPrivate(question, selectedPack)

      setAnswer(result.answer)
      setCitations(result.citations)
    } catch (err: any) {
      setAnswer(`Error: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleVerify = async (blobId: string, expectedHash: string) => {
    setVerifying((prev) => ({ ...prev, [blobId]: true }))

    try {
      const result = await verifyBlob(blobId, expectedHash)
      setVerified((prev) => ({
        ...prev,
        [blobId]: { ok: result.ok, hash: result.computed_sha256 },
      }))
    } catch (err: any) {
      setVerified((prev) => ({
        ...prev,
        [blobId]: { ok: false, hash: '' },
      }))
    } finally {
      setVerifying((prev) => ({ ...prev, [blobId]: false }))
    }
  }

  return (
    <div className="min-h-screen px-4 sm:px-6 lg:px-8 py-12">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Ask Questions
          </h1>
          <p className="text-lg text-gray-600">
            Get answers with <span className="gradient-text font-semibold">verifiable citations</span> from your documents
          </p>
        </div>

        {/* Pack Selector */}
        <div className="glass rounded-2xl p-6 mb-6 shadow-xl">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Search Context
          </label>
          <select
            value={selectedPack}
            onChange={(e) => setSelectedPack(e.target.value)}
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary-500 focus:ring-4 focus:ring-primary-100 outline-none transition-all text-lg"
          >
            <option value="all">All My Packs</option>
            {packs.map((pack) => (
              <option key={pack.pack_id} value={pack.pack_id}>
                {pack.title}
              </option>
            ))}
          </select>
        </div>

        {/* Question Input */}
        <div className="glass rounded-2xl p-6 mb-8 shadow-xl">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Your Question
          </label>
          <div className="relative">
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleQuery()
                }
              }}
              placeholder="What is Shelby hot storage? How does erasure coding work?"
              rows={3}
              className="w-full px-4 py-3 pr-16 border-2 border-gray-200 rounded-xl focus:border-primary-500 focus:ring-4 focus:ring-primary-100 outline-none transition-all resize-none"
              disabled={loading}
            />
            <button
              onClick={handleQuery}
              disabled={loading || !question.trim()}
              className="absolute right-3 bottom-3 p-3 bg-gradient-to-r from-primary-500 to-accent-purple text-white rounded-lg hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Press Enter to ask, Shift+Enter for new line
          </p>
        </div>

        {/* Answer Section */}
        {answer && (
          <div className="space-y-6 animate-slide-up">
            {/* Answer */}
            <div className="glass rounded-2xl p-8 shadow-xl">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-accent-purple rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">A</span>
                </div>
                <h2 className="text-xl font-bold text-gray-900">Answer</h2>
              </div>
              <div className="prose prose-sm max-w-none">
                <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                  {answer}
                </p>
              </div>
            </div>

            {/* Citations */}
            {citations.length > 0 && (
              <div className="glass rounded-2xl p-8 shadow-xl">
                <div className="flex items-center gap-2 mb-6">
                  <Shield className="w-6 h-6 text-primary-600" />
                  <h2 className="text-xl font-bold text-gray-900">
                    Verifiable Citations
                  </h2>
                  <span className="px-2 py-1 bg-primary-100 text-primary-700 text-xs font-medium rounded-full">
                    {citations.length}
                  </span>
                </div>

                <div className="space-y-4">
                  {citations.map((citation, i) => {
                    const isVerifying = verifying[citation.shelby_blob_id]
                    const verification = verified[citation.shelby_blob_id]

                    return (
                      <div
                        key={i}
                        className="p-5 bg-white rounded-xl border-2 border-gray-200 hover:border-primary-300 transition-all"
                      >
                        {/* Citation Header */}
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <span className="flex items-center justify-center w-6 h-6 bg-primary-100 text-primary-700 rounded-full text-sm font-bold">
                              {i + 1}
                            </span>
                            {citation.doc_path && (
                              <span className="text-sm font-medium text-gray-700">
                                {citation.doc_path}
                              </span>
                            )}
                            {citation.score && (
                              <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                                {(citation.score * 100).toFixed(0)}% match
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Snippet */}
                        {citation.snippet && (
                          <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg mb-3 italic">
                            "{citation.snippet}"
                          </p>
                        )}

                        {/* Shelby Info */}
                        <div className="space-y-2 mb-3">
                          <div className="flex items-start gap-2 text-xs">
                            <span className="text-gray-500 font-medium whitespace-nowrap">Blob ID:</span>
                            <code className="text-gray-700 font-mono bg-gray-50 px-2 py-1 rounded break-all">
                              {citation.shelby_blob_id}
                            </code>
                          </div>
                          <div className="flex items-start gap-2 text-xs">
                            <span className="text-gray-500 font-medium whitespace-nowrap">SHA256:</span>
                            <code className="text-gray-700 font-mono bg-gray-50 px-2 py-1 rounded break-all">
                              {citation.sha256}
                            </code>
                          </div>
                        </div>

                        {/* Verification Status */}
                        {verification && (
                          <div className={`flex items-center gap-2 p-3 rounded-lg mb-3 ${
                            verification.ok 
                              ? 'bg-green-50 border border-green-200' 
                              : 'bg-red-50 border border-red-200'
                          }`}>
                            {verification.ok ? (
                              <>
                                <CheckCircle className="w-5 h-5 text-green-600" />
                                <span className="text-sm text-green-700 font-medium">
                                  ✓ Verified on Shelby
                                </span>
                              </>
                            ) : (
                              <>
                                <XCircle className="w-5 h-5 text-red-600" />
                                <span className="text-sm text-red-700 font-medium">
                                  Hash mismatch
                                </span>
                              </>
                            )}
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleVerify(citation.shelby_blob_id, citation.sha256)}
                            disabled={isVerifying}
                            className="flex items-center gap-2 px-4 py-2 bg-primary-50 text-primary-700 font-medium text-sm rounded-lg hover:bg-primary-100 disabled:opacity-50 transition-colors"
                          >
                            {isVerifying ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>Verifying...</span>
                              </>
                            ) : (
                              <>
                                <Shield className="w-4 h-4" />
                                <span>Verify on Shelby</span>
                              </>
                            )}
                          </button>

                          <a
                            href={`https://explorer.shelby.xyz/shelbynet/blob/${citation.shelby_blob_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 font-medium text-sm rounded-lg hover:bg-gray-200 transition-colors"
                          >
                            <ExternalLink className="w-4 h-4" />
                            <span>View on Shelby</span>
                          </a>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Empty State */}
        {!answer && !loading && (
          <div className="glass rounded-2xl p-12 text-center shadow-xl">
            <div className="w-16 h-16 bg-gradient-to-br from-primary-500 to-accent-purple rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Send className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Ask a question to get started
            </h3>
            <p className="text-gray-600">
              Your answer will include verifiable citations from your documents
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

