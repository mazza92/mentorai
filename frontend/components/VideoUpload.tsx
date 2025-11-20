'use client'

import { useState } from 'react'
import axios from 'axios'
import { Youtube, Video, Loader2, CheckCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import UpgradeModal from './UpgradeModal'
import SignupWall from './SignupWall'
import { getApiUrl } from '@/lib/apiUrl'

interface VideoUploadProps {
  userId: string
  onUploadComplete: (projectId: string) => void
}

export default function VideoUpload({ userId, onUploadComplete }: VideoUploadProps) {
  const { t } = useTranslation('common')
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const [processingStage, setProcessingStage] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [uploaded, setUploaded] = useState(false)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [showSignupWall, setShowSignupWall] = useState(false)
  const [quotaUsage, setQuotaUsage] = useState<{used: number, limit: number} | undefined>(undefined)

  const isValidYouTubeUrl = (url: string) => {
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/
    return youtubeRegex.test(url)
  }

  const handleYouTubeSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!youtubeUrl.trim()) {
      setError(t('upload.error_enter_url'))
      return
    }

    if (!isValidYouTubeUrl(youtubeUrl)) {
      setError(t('upload.error_invalid_url'))
      return
    }

    setError(null)
    setUploading(true)
    setProcessingStage(t('upload.downloading'))
    
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
        setProcessingStage(t('upload.video_ready'))
        
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
      if (err.response?.status === 403) {
        const errorData = err.response.data
        
        // Check if signup is required (anonymous user hit limit)
        if (errorData.requiresSignup) {
          setQuotaUsage({
            used: errorData.videosThisMonth || 1,
            limit: errorData.limit || 1
          })
          // Don't pass backend message - let SignupWall use proper translations
          setShowSignupWall(true)
          setError(errorData.message || 'Upload limit reached')
        } 
        // Check if upgrade is required (free user hit limit)
        else if (errorData.upgradeRequired) {
          setQuotaUsage({
            used: errorData.videosThisMonth,
            limit: errorData.limit
          })
          setShowUpgradeModal(true)
          setError(errorData.message || 'Video limit reached')
        } else {
          setError(errorData.message || errorData.error || 'Upload failed')
        }
      } else if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
        // Timeout error - the download might still be processing
        setError(t('upload.error_timeout'))
      } else {
        setError(err.response?.data?.error || err.response?.data?.details || t('upload.error_download_failed'))
      }

      setUploading(false)
      setProcessingStage('')
    }
  }

  const startTranscription = async (projectId: string) => {
    try {
      setProcessingStage(t('upload.transcribing'))
      const apiUrl = getApiUrl()
      await axios.post(`${apiUrl}/api/transcribe`, {
        projectId,
      })
      setProcessingStage(t('upload.analyzing'))
    } catch (err) {
      console.error('Transcription error:', err)
      // Don't block the flow if transcription fails
      setProcessingStage(t('upload.transcription_background'))
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
                {t('upload.success')}
              </p>
              <p className="text-sm text-slate-600">
                {processingStage || t('upload.ready')}
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleYouTubeSubmit} className="space-y-6">
            <div className="border border-slate-200/80 rounded-2xl p-8 hover:border-slate-300/80 transition-all bg-white/50 backdrop-blur-sm">
              {uploading ? (
                <div className="space-y-5 py-4">
                  <div className="flex justify-center">
                    <div className="relative">
                      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 animate-pulse"></div>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Loader2 className="w-8 h-8 text-white animate-spin" />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <p className="text-base font-semibold text-slate-900">
                      {processingStage}
                    </p>

                    {/* Progress indicator */}
                    <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-full animate-pulse" style={{ width: '60%' }}></div>
                    </div>

                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-1.5">
                      <p className="text-xs text-blue-900 font-medium">
                        📥 {t('upload.whats_happening')}
                      </p>
                      <p className="text-xs text-blue-700 leading-relaxed">
                        {t('upload.download_description')}
                      </p>
                    </div>

                    <p className="text-xs text-slate-500">
                      💡 {t('upload.after_download_tip')}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="text-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-50 to-purple-50 mb-4">
                      <Youtube className="w-8 h-8 text-red-500" />
                    </div>
                    <p className="text-xl font-semibold text-slate-900 mb-2">
                      {t('upload.enter_youtube_url')}
                    </p>
                    <p className="text-sm text-slate-500">
                      {t('upload.video_length_limit')}
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
                        {t('upload.processing')}
                      </span>
                    ) : (
                      t('upload.process')
                    )}
                  </button>

                  <div className="text-xs text-slate-400 text-center pt-2">
                    {t('upload.example')}
                  </div>
                </div>
              )}
            </div>
          </form>
        )}
      </div>

      {/* Signup Wall (for anonymous users) */}
      <SignupWall
        isOpen={showSignupWall}
        onClose={() => setShowSignupWall(false)}
        reason="video"
        currentUsage={quotaUsage}
      />

      {/* Upgrade Modal (for authenticated free users) */}
      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        reason="video"
        currentUsage={quotaUsage}
      />
    </div>
  )
}

