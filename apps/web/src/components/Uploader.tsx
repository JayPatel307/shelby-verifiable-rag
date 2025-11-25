'use client'

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, FileText, X, CheckCircle, Loader2, AlertCircle } from 'lucide-react'
import { createPack } from '@/lib/api'

interface UploaderProps {
  onSuccess?: (packId: string) => void
}

export function Uploader({ onSuccess }: UploaderProps) {
  const [files, setFiles] = useState<File[]>([])
  const [title, setTitle] = useState('')
  const [summary, setSummary] = useState('')
  const [tags, setTags] = useState('')
  const [ocr, setOcr] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState('')

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setFiles((prev) => [...prev, ...acceptedFiles])
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: true,
    accept: {
      'application/pdf': ['.pdf'],
      'text/plain': ['.txt'],
      'text/markdown': ['.md'],
      'text/html': ['.html'],
      'application/json': ['.json'],
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/webp': ['.webp'],
    },
  })

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const handleUpload = async () => {
    if (!title.trim()) {
      setError('Please enter a pack title')
      return
    }

    if (files.length === 0) {
      setError('Please add at least one file')
      return
    }

    // Check total file size (max 25MB per file)
    const maxFileSize = 25 * 1024 * 1024 // 25MB
    const oversizedFiles = files.filter(f => f.size > maxFileSize)
    if (oversizedFiles.length > 0) {
      setError(`File too large: ${oversizedFiles[0].name} (${(oversizedFiles[0].size / 1024 / 1024).toFixed(1)}MB). Max 25MB per file.`)
      return
    }

    setError('')
    setUploading(true)
    setProgress('Preparing files...')

    try {
      const formData = new FormData()
      formData.append('title', title)
      if (summary) formData.append('summary', summary)
      if (tags) formData.append('tags', tags)
      formData.append('ocr', String(ocr))

      files.forEach((file) => {
        formData.append('files', file)
      })

      // Show processing message (no fake progress simulation)
      setProgress('Processing... This may take a few minutes for large documents to create data chunks and vector embeddings.')
      
      const result = await createPack(formData)

      setProgress('Pack created successfully!')
      
      // Wait a moment to show success
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Reset form
      setFiles([])
      setTitle('')
      setSummary('')
      setTags('')
      
      // Callback
      if (onSuccess) {
        onSuccess(result.pack_id)
      }
    } catch (err: any) {
      console.error('Upload error:', err)
      const errorMessage = err.message || 'Upload failed'
      
      // Provide helpful error messages
      if (errorMessage.includes('fetch') || errorMessage.includes('timeout')) {
        setError('Processing timed out. Large PDFs with many pages may take too long. Try a smaller document or split it into parts.')
      } else if (errorMessage.includes('too large')) {
        setError(errorMessage)
      } else {
        setError(`Upload failed: ${errorMessage}`)
      }
    } finally {
      setUploading(false)
      setProgress('')
    }
  }

  return (
    <div className="space-y-6">
      {/* Title Input */}
      <div>
        <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
          Pack Title <span className="text-red-500">*</span>
        </label>
        <input
          id="title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="My Research Papers"
          className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary-500 focus:ring-4 focus:ring-primary-100 outline-none transition-all"
          disabled={uploading}
        />
      </div>

      {/* Summary */}
      <div>
        <label htmlFor="summary" className="block text-sm font-medium text-gray-700 mb-2">
          Summary (optional)
        </label>
        <textarea
          id="summary"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="A collection of papers about..."
          rows={3}
          className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary-500 focus:ring-4 focus:ring-primary-100 outline-none transition-all resize-none"
          disabled={uploading}
        />
      </div>

      {/* Tags */}
      <div>
        <label htmlFor="tags" className="block text-sm font-medium text-gray-700 mb-2">
          Tags (comma-separated)
        </label>
        <input
          id="tags"
          type="text"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="research, ai, machine-learning"
          className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary-500 focus:ring-4 focus:ring-primary-100 outline-none transition-all"
          disabled={uploading}
        />
      </div>

      {/* OCR Toggle */}
      <div className="flex items-center gap-3">
        <input
          id="ocr"
          type="checkbox"
          checked={ocr}
          onChange={(e) => setOcr(e.target.checked)}
          className="w-5 h-5 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
          disabled={uploading}
        />
        <label htmlFor="ocr" className="text-sm text-gray-700">
          Enable OCR for images (slower but extracts text from images)
        </label>
      </div>

      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={`
          relative border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all
          ${isDragActive 
            ? 'border-primary-500 bg-primary-50' 
            : 'border-gray-300 hover:border-primary-400 hover:bg-gray-50'
          }
          ${uploading ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <input {...getInputProps()} disabled={uploading} />
        
        <Upload className={`w-12 h-12 mx-auto mb-4 ${isDragActive ? 'text-primary-600' : 'text-gray-400'}`} />
        
        <p className="text-lg font-semibold text-gray-900 mb-2">
          {isDragActive ? 'Drop files here' : 'Drag & drop files here'}
        </p>
        <p className="text-sm text-gray-500 mb-4">
          or click to browse your computer
        </p>
        <p className="text-xs text-gray-400">
          Supports: PDF, TXT, MD, HTML, JSON, PNG, JPG, WEBP
        </p>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="glass rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-700">
              {files.length} file{files.length !== 1 ? 's' : ''} selected
            </span>
            <button
              onClick={() => setFiles([])}
              className="text-xs text-gray-500 hover:text-red-600 transition-colors"
              disabled={uploading}
            >
              Clear all
            </button>
          </div>

          <div className="space-y-2 max-h-48 overflow-y-auto">
            {files.map((file, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <FileText className="w-5 h-5 text-primary-600 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {file.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>
                
                {!uploading && (
                  <button
                    onClick={() => removeFile(i)}
                    className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Progress */}
      {uploading && (
        <div className="flex items-center gap-3 p-4 bg-primary-50 border border-primary-200 rounded-xl">
          <Loader2 className="w-5 h-5 text-primary-600 animate-spin flex-shrink-0" />
          <p className="text-sm text-primary-700">{progress}</p>
        </div>
      )}

      {/* Upload Button */}
      <button
        onClick={handleUpload}
        disabled={uploading || files.length === 0 || !title.trim()}
        className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-primary-500 to-accent-purple text-white font-semibold rounded-xl shadow-lg shadow-primary-500/30 hover:shadow-xl hover:shadow-primary-500/40 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
      >
        {uploading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Uploading...</span>
          </>
        ) : (
          <>
            <CheckCircle className="w-5 h-5" />
            <span>Create Pack</span>
          </>
        )}
      </button>
    </div>
  )
}

