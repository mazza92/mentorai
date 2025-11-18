'use client'

import { useState } from 'react'
import axios from 'axios'
import { Youtube, Video, Loader2, CheckCircle, Link2 } from 'lucide-react'
import UpgradeModal from './UpgradeModal'
import { getApiUrl } from '@/lib/apiUrl'

interface VideoUploadProps {
  userId: string
  onUploadComplete: (projectId: string) => void
}

export default function VideoUpload({ userId, onUploadComplete }: VideoUploadProps) {
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const [processingStage, setProcessingStage] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [uploaded, setUploaded] = useState(false)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [quotaUsage, setQuotaUsage] = useState<{used: number, limit: number} | undefined>(undefined)

  const isValidYouTubeUrl = (url: string) => {
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/
    return youtubeRegex.test(url)
  }

  const handleYouTubeSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!youtubeUrl.trim()) {
      setError('Please enter a YouTube URL')
      return
    }

    if (!isValidYouTubeUrl(youtubeUrl)) {
      setError('Please enter a valid YouTube URL (e.g., https://www.youtube.com/watch?v=...)')
      return
    }

    setError(null)
    setUploading(true)
    setProcessingStage('Downloading video from YouTube...')

    try {
      const apiUrl = getApiUrl()

      // Start YouTube download
      const response = await axios.post(`${apiUrl}/api/upload-youtube`, {
        youtubeUrl,
        userId,
      })

      if (response.data.success) {
        const projectId = response.data.projectId

        setUploaded(true)
        setProcessingStage('Video ready! Processing in background...')

        // Navigate to Q&A interface immediately (transcription auto-started by backend)
        setTimeout(() => {
          onUploadComplete(projectId)
        }, 800)
      }
    } catch (err: any) {
      console.error('YouTube upload error:', err)

      // Handle quota exceeded error
      if (err.response?.status === 403 && err.response?.data?.upgradeRequired) {
        setQuotaUsage({
          used: err.response.data.videosThisMonth,
          limit: err.response.data.limit
        })
        setShowUpgradeModal(true)
        setError(err.response.data.message || 'Video limit reached')
      } else {
        setError(err.response?.data?.error || err.response?.data?.details || 'Failed to download YouTube video. Please check the URL and try again.')
      }

      setUploading(false)
      setProcessingStage('')
    }
  }

  const startTranscription = async (projectId: string) => {
    try {
      setProcessingStage('Transcribing video (this may take several minutes)...')
      const apiUrl = getApiUrl()
      await axios.post(`${apiUrl}/api/transcribe`, {
        projectId,
      })
      setProcessingStage('Analyzing video frames...')
    } catch (err) {
      console.error('Transcription error:', err)
      // Don't block the flow if transcription fails
      setProcessingStage('Transcription in progress (continuing in background)...')
    }
  }

  return (
    <div className="bg-transparent p-8 max-w-2xl mx-auto">
      <div className="text-center">
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center shadow-lg">
            <Youtube className="w-10 h-10 text-white" />
          </div>
        </div>

        <h2 className="text-2xl font-bold text-slate-900 mb-2">
          Upload YouTube Video
        </h2>
        <p className="text-slate-600 mb-8">
          Paste a YouTube URL and ask questions about the video content
        </p>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {uploaded ? (
          <div className="space-y-4">
            <div className="flex justify-center">
              <CheckCircle className="w-16 h-16 text-green-500" />
            </div>
            <p className="text-lg font-medium text-slate-900">
              Video processed successfully!
            </p>
            <p className="text-sm text-slate-600">
              {processingStage || 'Ready to answer your questions...'}
            </p>
          </div>
        ) : (
          <form onSubmit={handleYouTubeSubmit} className="space-y-4">
            <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 hover:border-blue-400 transition-colors bg-slate-50/50">
              {uploading ? (
                <div className="space-y-4">
                  <div className="flex justify-center">
                    <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-slate-700">
                      {processingStage}
                    </p>
                    <p className="text-xs text-slate-500">
                      This may take several minutes for long videos...
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="text-center mb-4">
                    <Link2 className="w-12 h-12 text-slate-400 mx-auto mb-2" />
                    <p className="text-lg font-medium text-slate-900 mb-1">
                      Enter YouTube URL
                    </p>
                    <p className="text-sm text-slate-600">
                      Works with videos up to 3 hours long
                    </p>
                  </div>

                  <div className="relative">
                    <input
                      type="text"
                      value={youtubeUrl}
                      onChange={(e) => setYoutubeUrl(e.target.value)}
                      placeholder="https://www.youtube.com/watch?v=..."
                      className="w-full px-4 py-3 bg-white border border-slate-300 text-slate-900 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none placeholder-slate-400"
                      disabled={uploading}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={uploading || !youtubeUrl.trim()}
                    className="w-full bg-white border-2 border-blue-500 text-blue-600 py-3 px-6 rounded-lg font-semibold hover:bg-blue-50 hover:border-blue-600 hover:text-blue-700 disabled:bg-slate-100 disabled:border-slate-300 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors shadow-sm hover:shadow-md"
                  >
                    Process Video
                  </button>

                  <div className="text-xs text-slate-500 text-center">
                    Example: Paste a link to an educational video, tutorial, or any YouTube content
                  </div>
                </div>
              )}
            </div>
          </form>
        )}
      </div>

      {/* Upgrade Modal */}
      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        reason="video"
        currentUsage={quotaUsage}
      />
    </div>
  )
}

