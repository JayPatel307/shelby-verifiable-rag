'use client'

import { Package, Calendar, Tag, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import type { Pack } from '@/lib/api'

interface PackCardProps {
  pack: Pack
  showActions?: boolean
  onVisibilityChange?: (packId: string, visibility: 'private' | 'public' | 'unlisted') => void
}

export function PackCard({ pack, showActions = false, onVisibilityChange }: PackCardProps) {
  const timeAgo = formatDistanceToNow(new Date(pack.created_at), { addSuffix: true })

  return (
    <Link
      href={`/packs/${pack.pack_id}`}
      className="group glass rounded-2xl p-6 hover:shadow-xl hover:scale-[1.02] transition-all duration-300"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-accent-purple rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
            <Package className="w-6 h-6 text-white" />
          </div>
          
          <div>
            <h3 className="font-semibold text-lg text-gray-900 group-hover:text-primary-600 transition-colors line-clamp-1">
              {pack.title}
            </h3>
            
            {pack.visibility && (
              <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full mt-1 ${
                pack.visibility === 'public' 
                  ? 'bg-green-100 text-green-700'
                  : pack.visibility === 'unlisted'
                  ? 'bg-yellow-100 text-yellow-700'
                  : 'bg-gray-100 text-gray-700'
              }`}>
                {pack.visibility}
              </span>
            )}
          </div>
        </div>
        
        <ExternalLink className="w-5 h-5 text-gray-400 group-hover:text-primary-500 transition-colors" />
      </div>

      {/* Summary */}
      {pack.summary && (
        <p className="text-gray-600 text-sm mb-4 line-clamp-2">
          {pack.summary}
        </p>
      )}

      {/* Tags */}
      {pack.tags && pack.tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {pack.tags.slice(0, 3).map((tag, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 px-2 py-1 bg-primary-50 text-primary-700 text-xs font-medium rounded-lg"
            >
              <Tag className="w-3 h-3" />
              {tag}
            </span>
          ))}
          {pack.tags.length > 3 && (
            <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded-lg">
              +{pack.tags.length - 3} more
            </span>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-100">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Calendar className="w-4 h-4" />
          <span>{timeAgo}</span>
        </div>

        {showActions && onVisibilityChange && (
          <div className="flex gap-2">
            {pack.visibility !== 'public' && (
              <button
                onClick={(e) => {
                  e.preventDefault()
                  onVisibilityChange(pack.pack_id, 'public')
                }}
                className="px-3 py-1 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-lg transition-colors"
              >
                Make Public
              </button>
            )}
            {pack.visibility !== 'private' && (
              <button
                onClick={(e) => {
                  e.preventDefault()
                  onVisibilityChange(pack.pack_id, 'private')
                }}
                className="px-3 py-1 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Make Private
              </button>
            )}
          </div>
        )}
      </div>
    </Link>
  )
}

