'use client'

import { useState } from 'react'
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

        setImportStatus({
          channelName: data.channelName,
          videoCount: data.videoCount,
          status: data.status === 'partial' ? 'Processing additional videos...' : 'Complete'
        })

        // Redirect to channel project (shorter delay)
        if (onImportComplete) {
          setTimeout(() => {
            onImportComplete(data.channelId, data.projectId)
          }, 1500)
        }
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
    } finally {
      setIsImporting(false)
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
