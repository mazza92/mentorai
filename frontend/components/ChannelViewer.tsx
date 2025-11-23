'use client'

import { useState, useEffect } from 'react'
import axios from 'axios'
import { Youtube, Clock, CheckCircle, Loader2, XCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { getApiUrl } from '@/lib/apiUrl'

interface ChannelViewerProps {
  channelId: string
  onVideoSelect?: (videoId: string) => void
}

interface Video {
  id: string
  videoId: string
  title: string
  description: string
  duration: number
  thumbnailUrl: string
  publishedAt: Date | any
  status: 'ready' | 'processing' | 'no_captions' | 'error'
  viewCount?: number
}

interface ChannelInfo {
  channelName: string
  channelDescription: string
  thumbnailUrl: string
  videoCount: number
  processedVideoCount: number
  status: string
}

export default function ChannelViewer({ channelId, onVideoSelect }: ChannelViewerProps) {
  const { t } = useTranslation('common')
  const [videos, setVideos] = useState<Video[]>([])
  const [loading, setLoading] = useState(true)
  const [channelInfo, setChannelInfo] = useState<ChannelInfo | null>(null)

  useEffect(() => {
    fetchChannelData()
  }, [channelId])

  const fetchChannelData = async () => {
    try {
      const apiUrl = getApiUrl()

      // Fetch channel info
      const channelResponse = await axios.get(`${apiUrl}/api/channel/${channelId}`)
      if (channelResponse.data.success) {
        setChannelInfo(channelResponse.data.data)
      }

      // Fetch videos
      const videosResponse = await axios.get(`${apiUrl}/api/channel/${channelId}/videos`)
      if (videosResponse.data.success) {
        setVideos(videosResponse.data.data)
      }

    } catch (error) {
      console.error('Error fetching channel data:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    if (hours > 0) {
      return `${hours}h ${minutes}m`
    }
    return `${minutes}m`
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ready':
        return (
          <div className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
            <CheckCircle className="w-3 h-3" />
            Ready
          </div>
        )
      case 'processing':
        return (
          <div className="absolute top-2 right-2 bg-blue-500 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
            <Loader2 className="w-3 h-3 animate-spin" />
            Processing
          </div>
        )
      case 'no_captions':
        return (
          <div className="absolute top-2 right-2 bg-yellow-500 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
            <XCircle className="w-3 h-3" />
            No Captions
          </div>
        )
      case 'error':
        return (
          <div className="absolute top-2 right-2 bg-red-500 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
            <XCircle className="w-3 h-3" />
            Error
          </div>
        )
      default:
        return null
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Video Count */}
      <div className="text-sm text-gray-600">
        Showing {videos.length} video{videos.length !== 1 ? 's' : ''}
      </div>

      {/* Video Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {videos.map((video) => (
          <div
            key={video.id || video.videoId}
            onClick={() => onVideoSelect && video.status === 'ready' && onVideoSelect(video.videoId)}
            className={`bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow ${
              video.status === 'ready' ? 'cursor-pointer' : 'cursor-default opacity-75'
            }`}
          >
            {/* Thumbnail */}
            <div className="relative aspect-video bg-gray-100">
              {video.thumbnailUrl ? (
                <img
                  src={video.thumbnailUrl}
                  alt={video.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Youtube className="w-12 h-12 text-gray-400" />
                </div>
              )}

              {/* Duration badge */}
              <div className="absolute bottom-2 right-2 bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded">
                {formatDuration(video.duration)}
              </div>

              {/* Status badge */}
              {getStatusBadge(video.status)}
            </div>

            {/* Info */}
            <div className="p-4">
              <h3 className="font-semibold text-gray-900 line-clamp-2 mb-2">
                {video.title}
              </h3>
              <div className="flex items-center justify-between text-sm text-gray-500">
                <span>
                  {video.publishedAt
                    ? (() => {
                        try {
                          // Handle both Firestore timestamp and ISO string
                          const date = video.publishedAt.toDate ? video.publishedAt.toDate() : new Date(video.publishedAt);
                          return date.toLocaleDateString();
                        } catch {
                          return 'Unknown date';
                        }
                      })()
                    : 'Unknown date'}
                </span>
                {video.viewCount && (
                  <span>{video.viewCount.toLocaleString()} views</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {videos.length === 0 && (
        <div className="text-center py-12">
          <Youtube className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">No videos found in this channel</p>
        </div>
      )}
    </div>
  )
}
