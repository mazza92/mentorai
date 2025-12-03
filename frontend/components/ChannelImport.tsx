'use client'

import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import { Youtube, Loader2, CheckCircle, AlertCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { getApiUrl } from '@/lib/apiUrl'

interface ChannelImportProps {
  userId: string
  onImportComplete?: (channelId: string, projectId: string) => void
}

export default function ChannelImport({ userId, onImportComplete }: ChannelImportProps) {
  const { t } = useTranslation('common')
  const [channelUrl, setChannelUrl] = useState('')
  const [isImporting, setIsImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [importStatus, setImportStatus] = useState<{
    channelName?: string
    videoCount?: number
    status?: string
  } | null>(null)
  const [progress, setProgress] = useState<{
    fetched: number
    total: number
  } | null>(null)
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null)
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const retryCountRef = useRef<number>(0)

  const isValidYouTubeChannelUrl = (url: string) => {
    // Match various YouTube channel URL formats
    const patterns = [
      /youtube\.com\/@[\w-]+/,
      /youtube\.com\/channel\/UC[\w-]+/,
      /youtube\.com\/c\/[\w-]+/,
      /youtube\.com\/user\/[\w-]+/,
    ]
    return patterns.some(pattern => pattern.test(url))
  }

  // Poll for progress updates with exponential backoff on rate limit
  useEffect(() => {
    if (!currentProjectId || !isImporting) {
      retryCountRef.current = 0
      return
    }

    const pollProgress = async () => {
      try {
        const apiUrl = getApiUrl()
        const response = await axios.get(`${apiUrl}/api/channel/import-progress/${currentProjectId}`)

        // Reset retry count on successful request
        retryCountRef.current = 0

        if (response.data.success) {
          const { status, progress: progressData } = response.data.data

          setProgress(progressData)

          // If completed, stop polling and redirect
          if (status === 'ready') {
            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current)
              pollingIntervalRef.current = null
            }
            setIsImporting(false)
            setImportStatus({
              channelName: response.data.data.channelName,
              videoCount: response.data.data.videoCount,
              status: 'Complete'
            })

            // Redirect after completion
            if (onImportComplete) {
              setTimeout(() => {
                onImportComplete(currentProjectId, currentProjectId)
              }, 1500)
            }
          }
        }
      } catch (err: any) {
        // Handle 429 rate limit with exponential backoff
        if (err.response?.status === 429) {
          retryCountRef.current++
          console.log(`Rate limited (attempt ${retryCountRef.current}), backing off...`)

          // Stop current interval and restart with longer delay
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current)
            pollingIntervalRef.current = null
          }

          // Exponential backoff: 5s, 10s, 20s, max 30s
          const backoffDelay = Math.min(5000 * Math.pow(2, retryCountRef.current - 1), 30000)

          setTimeout(() => {
            if (isImporting && currentProjectId) {
              pollProgress()
              pollingIntervalRef.current = setInterval(pollProgress, backoffDelay)
            }
          }, backoffDelay)
        } else {
          console.error('Error polling progress:', err)
        }
      }
    }

    // Poll immediately and then every 3 seconds (slower to avoid rate limits)
    pollProgress()
    pollingIntervalRef.current = setInterval(pollProgress, 3000)

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
      }
      retryCountRef.current = 0
    }
  }, [currentProjectId, isImporting, onImportComplete])

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!channelUrl.trim()) {
      setError(t('channel.error_enter_url') || 'Please enter a valid YouTube channel URL')
      return
    }

    if (!isValidYouTubeChannelUrl(channelUrl)) {
      setError(t('channel.error_invalid_url') || 'Please enter a valid YouTube channel URL (e.g., youtube.com/@channelname)')
      return
    }

    setIsImporting(true)
    setError(null)
    setImportStatus(null)
    setProgress(null)
    setCurrentProjectId(null)

    try {
      const apiUrl = getApiUrl()

      const response = await axios.post(`${apiUrl}/api/channel/import`, {
        channelUrl,
        userId
      }, {
        timeout: 60 * 1000, // 60 second timeout (only waits for initial 15 videos)
      })

      if (response.data.success) {
        const data = response.data.data

        // Set project ID to start polling
        setCurrentProjectId(data.projectId)

        // Set initial progress
        setProgress({
          fetched: data.transcriptsAvailable || 0,
          total: data.videoCount
        })

        // If already complete (small channel), show success immediately
        if (data.status === 'ready') {
          setImportStatus({
            channelName: data.channelName,
            videoCount: data.videoCount,
            status: 'Complete'
          })
          setIsImporting(false)

          // Redirect to channel project
          if (onImportComplete) {
            setTimeout(() => {
              onImportComplete(data.channelId, data.projectId)
            }, 1500)
          }
        }
        // Otherwise, polling will handle the rest
      }

    } catch (err: any) {
      console.error('Channel import error:', err)

      // Handle quota exceeded error
      if (err.response?.status === 403) {
        setError(err.response.data.error || 'Channel import limit reached. Please upgrade to Pro.')
      } else if (err.response?.data?.error) {
        setError(err.response.data.error)
      } else if (err.code === 'ECONNABORTED') {
        setError('Request timeout. The channel might be too large. Please try again.')
      } else {
        setError('Failed to import channel. Please check the URL and try again.')
      }
      setIsImporting(false)
      setCurrentProjectId(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
          <Youtube className="w-8 h-8 text-red-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          {t('channel.import_title') || 'Import YouTube Channel'}
        </h2>
        <p className="text-gray-600">
          {t('channel.import_subtitle') || "Turn a creator's entire library into your personalized mentor"}
        </p>
      </div>

      {/* Input Form */}
      <form onSubmit={handleImport} className="space-y-3">
        <input
          type="text"
          value={channelUrl}
          onChange={(e) => setChannelUrl(e.target.value)}
          placeholder="https://www.youtube.com/@channelname"
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg"
          disabled={isImporting}
        />

        <button
          type="submit"
          disabled={isImporting || !channelUrl.trim()}
          className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 px-6 rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
        >
          {isImporting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              {t('channel.importing') || 'Importing Channel...'}
            </>
          ) : (
            <>
              <Youtube className="w-5 h-5" />
              {t('channel.import_button') || 'Import Channel'}
            </>
          )}
        </button>
      </form>

      {/* Progress Bar */}
      {isImporting && progress && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
              <span className="text-blue-900 font-medium">Processing channel transcripts...</span>
            </div>
            <span className="text-blue-700 text-sm font-semibold">
              {progress.fetched} / {progress.total}
            </span>
          </div>
          <div className="w-full bg-blue-100 rounded-full h-2.5 mb-3">
            <div
              className="bg-gradient-to-r from-blue-600 to-purple-600 h-2.5 rounded-full transition-all duration-300"
              style={{ width: `${(progress.fetched / progress.total) * 100}%` }}
            />
          </div>

          {/* Show "Start Now" button if we have enough initial videos */}
          {progress.fetched >= 10 && currentProjectId && (
            <div className="space-y-2">
              <p className="text-blue-700 text-sm font-medium">
                {progress.fetched} videos ready! You can start asking questions now.
              </p>
              <button
                onClick={() => {
                  // Stop polling
                  if (pollingIntervalRef.current) {
                    clearInterval(pollingIntervalRef.current)
                    pollingIntervalRef.current = null
                  }
                  setIsImporting(false)

                  // Redirect immediately
                  if (onImportComplete && currentProjectId) {
                    onImportComplete(currentProjectId, currentProjectId)
                  }
                }}
                className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white py-2.5 px-4 rounded-lg font-semibold hover:from-green-700 hover:to-emerald-700 transition-all flex items-center justify-center gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                Start using channel now
              </button>
              <p className="text-blue-600 text-xs text-center">
                More videos will continue processing in the background
              </p>
            </div>
          )}

          {!currentProjectId && (
            <p className="text-blue-600 text-xs mt-2">
              Preparing channel... This may take a moment for large channels.
            </p>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-red-800 font-medium">{t('channel.import_failed') || 'Import Failed'}</p>
            <p className="text-red-600 text-sm mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Success */}
      {importStatus && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-green-800 font-medium">{t('channel.import_success') || 'Channel Imported!'}</p>
            <p className="text-green-700 text-sm mt-1">
              {importStatus.channelName} - {importStatus.videoCount} videos
            </p>
            <p className="text-green-600 text-xs mt-2">
              {t('channel.redirecting') || 'Redirecting to your channel...'}
            </p>
          </div>
        </div>
      )}

      {/* Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2">{t('channel.how_it_works') || 'How it works:'}</h3>
        <ul className="space-y-2 text-sm text-blue-800">
          <li className="flex items-start gap-2">
            <span className="text-blue-600 font-bold">1.</span>
            <span>{t('channel.step_1') || 'We analyze the entire channel (3-5 seconds)'}</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-600 font-bold">2.</span>
            <span>{t('channel.step_2') || 'You can start asking questions immediately'}</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-600 font-bold">3.</span>
            <span>{t('channel.step_3') || 'AI synthesizes answers across all videos'}</span>
          </li>
        </ul>
      </div>

      {/* Examples */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="font-semibold text-gray-900 mb-2 text-sm">
          {t('channel.example_channels') || 'Example channels:'}
        </h3>
        <div className="space-y-1 text-sm text-gray-600">
          <p>• https://www.youtube.com/@hubermanlab</p>
          <p>• https://www.youtube.com/@lexfridman</p>
          <p>• https://www.youtube.com/@fireship</p>
        </div>
      </div>
    </div>
  )
}
