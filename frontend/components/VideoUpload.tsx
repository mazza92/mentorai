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
    
    // Mark that we're uploading to prevent restoring old project
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('isUploadingVideo', 'true')
    }

    try {
      const apiUrl = getApiUrl()

      // Start YouTube download with extended timeout (20 minutes for long videos)
      const response = await axios.post(`${apiUrl}/api/upload-youtube`, {
        youtubeUrl,
        userId,
      }, {
        timeout: 20 * 60 * 1000, // 20 minutes timeout
      })

      if (response.data.success) {
        const projectId = response.data.projectId

        setUploaded(true)
        setProcessingStage('Video ready! Processing in background...')
        
        // Clear upload flag
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('isUploadingVideo')
        }

        // Navigate to Q&A interface immediately (transcription auto-started by backend)
        setTimeout(() => {
          onUploadComplete(projectId)
        }, 800)
      }
    } catch (err: any) {
      console.error('YouTube upload error:', err)
      
      // Clear upload flag on error
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('isUploadingVideo')
      }

      // Handle quota exceeded error
      if (err.response?.status === 403 && err.response?.data?.upgradeRequired) {
        setQuotaUsage({
          used: err.response.data.videosThisMonth,
          limit: err.response.data.limit
        })
        setShowUpgradeModal(true)
        setError(err.response.data.message || 'Video limit reached')
      } else if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
        // Timeout error - the download might still be processing
        setError('Download is taking longer than expected. The video may still be processing. Please wait a few minutes and check your conversations.')
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
    <div className="bg-transparent max-w-2xl mx-auto">
      <div className="text-center">
        {error && (
          <div className="mb-6 p-4 bg-red-50/80 border border-red-200/60 rounded-xl text-red-700 text-sm backdrop-blur-sm">
            {error}
          </div>
        )}

        {uploaded ? (
          <div className="space-y-6 py-8">
            <div className="flex justify-center">
              <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle className="w-12 h-12 text-green-600" />
              </div>
            </div>
            <div>
              <p className="text-xl font-semibold text-slate-900 mb-2">
                Video processed successfully!
              </p>
              <p className="text-sm text-slate-600">
                {processingStage || 'Ready to answer your questions...'}
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleYouTubeSubmit} className="space-y-6">
            <div className="border border-slate-200/80 rounded-2xl p-8 hover:border-slate-300/80 transition-all bg-white/50 backdrop-blur-sm">
              {uploading ? (
                <div className="space-y-5 py-4">
                  <div className="flex justify-center">
                    <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
                  </div>
                  <div className="space-y-2">
                    <p className="text-base font-medium text-slate-800">
                      {processingStage}
                    </p>
                    <p className="text-xs text-slate-500">
                      This may take several minutes for long videos...
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="text-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-50 to-purple-50 mb-4">
                      <Link2 className="w-8 h-8 text-blue-500" />
                    </div>
                    <p className="text-xl font-semibold text-slate-900 mb-2">
                      Enter YouTube URL
                    </p>
                    <p className="text-sm text-slate-500">
                      Works with videos up to 3 hours long
                    </p>
                  </div>

                  <div className="relative">
                    <input
                      type="text"
                      value={youtubeUrl}
                      onChange={(e) => setYoutubeUrl(e.target.value)}
                      placeholder="https://www.youtube.com/watch?v=..."
                      className="w-full px-5 py-4 bg-white/80 border border-slate-200 text-slate-900 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-400 outline-none placeholder-slate-400 transition-all shadow-sm hover:shadow-md"
                      disabled={uploading}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={uploading || !youtubeUrl.trim()}
                    className="w-full bg-gradient-to-r from-blue-500 to-purple-500 text-white py-4 px-6 rounded-xl font-semibold hover:from-blue-600 hover:to-purple-600 disabled:from-slate-300 disabled:to-slate-300 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl disabled:shadow-none transform hover:scale-[1.02] active:scale-[0.98]"
                  >
                    {uploading ? (
                      <span className="flex items-center justify-center">
                        <Loader2 className="w-5 h-5 animate-spin mr-2" />
                        Processing...
                      </span>
                    ) : (
                      'Process Video'
                    )}
                  </button>

                  <div className="text-xs text-slate-400 text-center pt-2">
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

