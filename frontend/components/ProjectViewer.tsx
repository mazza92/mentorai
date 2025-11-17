'use client'

import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import { Play, Download, Loader2, AlertCircle, CheckCircle } from 'lucide-react'

interface ProjectViewerProps {
  projectId: string
  userId: string
}

export default function ProjectViewer({ projectId, userId }: ProjectViewerProps) {
  const [project, setProject] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const projectRef = useRef(project)
  const pollingTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Update ref when project changes
  useEffect(() => {
    projectRef.current = project
  }, [project])

  useEffect(() => {
    fetchProject()

    // Exponential backoff polling to reduce server load
    let pollInterval = 5000 // Start at 5 seconds
    const maxInterval = 30000 // Max 30 seconds
    const minInterval = 5000 // Min 5 seconds
    let pollCount = 0
    let isPolling = true

    const poll = async () => {
      if (!isPolling) return

      // Fetch latest project data
      await fetchProject()

      // Check current project state (use ref to avoid stale closure)
      const currentProject = projectRef.current
      const isProcessing = currentProject?.status === 'processing'

      if (isProcessing && isPolling) {
        pollCount++

        // Exponential backoff: 5s -> 7.5s -> 11.25s -> 16.875s -> 25.3s -> 30s (max)
        pollInterval = Math.min(Math.floor(minInterval * Math.pow(1.5, pollCount)), maxInterval)

        pollingTimeoutRef.current = setTimeout(poll, pollInterval)
      } else {
        // Processing complete, stop polling
        isPolling = false
        pollCount = 0
      }
    }

    // Start polling after initial fetch
    pollingTimeoutRef.current = setTimeout(poll, pollInterval)

    return () => {
      isPolling = false
      if (pollingTimeoutRef.current) {
        clearTimeout(pollingTimeoutRef.current)
      }
    }
  }, [projectId]) // Only depend on projectId

  const fetchProject = async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
      const response = await axios.get(`${apiUrl}/api/projects/project/${projectId}`)
      setProject(response.data.project)
      setLoading(false)
    } catch (err: any) {
      console.error('Error fetching project:', err)
      if (err.response?.data?.debug) {
        console.error('Debug info:', err.response.data.debug)
        setError(`Failed to load project. Available IDs: ${err.response.data.debug.availableIds?.join(', ') || 'none'}`)
      } else {
        setError('Failed to load project')
      }
      setLoading(false)
    }
  }

  const handleExport = async () => {
    if (!project?.processedUrl) return

    setExporting(true)
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
      
      // Use the export endpoint which handles watermarking and tier limits
      const exportResponse = await axios.post(`${apiUrl}/api/export`, {
        projectId,
        userId,
      })

      if (exportResponse.data.success) {
        // Download the exported video
        const link = document.createElement('a')
        link.href = exportResponse.data.exportUrl
        link.download = `${project.originalFileName || 'edited-video'}.mp4`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
      }
    } catch (err: any) {
      console.error('Export error:', err)
      if (err.response?.status === 403) {
        alert(
          `You've reached your export limit for this month (${err.response.data.exportsThisMonth}/${err.response.data.limit}). Upgrade to Creator Tier for unlimited exports!`
        )
      } else {
        alert('Failed to export video. Please try again.')
      }
    } finally {
      setExporting(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-12 text-center">
        <Loader2 className="w-12 h-12 text-primary-600 animate-spin mx-auto mb-4" />
        <p className="text-gray-600">Loading project...</p>
      </div>
    )
  }

  if (error || !project) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-12 text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <p className="text-gray-600">{error || 'Project not found'}</p>
      </div>
    )
  }

  // Ensure video URL uses the backend API URL if it's a relative path
  const getVideoUrl = (url: string | undefined) => {
    if (!url) return undefined
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url
    }
    // If relative URL, prepend API URL
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
    return `${apiUrl}${url.startsWith('/') ? url : `/${url}`}`
  }
  
  const videoUrl = getVideoUrl(project.processedUrl || project.publicUrl)
  const status = project.status

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{project.originalFileName}</h2>
            <p className="text-sm text-gray-500 mt-1">
              {status === 'completed' ? (
                <span className="flex items-center space-x-1 text-green-600">
                  <CheckCircle className="w-4 h-4" />
                  <span>Ready</span>
                </span>
              ) : status === 'processing' ? (
                <span className="flex items-center space-x-1 text-blue-600">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Processing...</span>
                </span>
              ) : (
                <span>Uploaded</span>
              )}
            </p>
          </div>
          {project.processedUrl && (
            <button
              onClick={handleExport}
              disabled={exporting || status !== 'completed'}
              className="flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {exporting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Download className="w-5 h-5" />
              )}
              <span>Export</span>
            </button>
          )}
        </div>
      </div>

      <div className="p-6">
        {videoUrl ? (
          <div className="aspect-video bg-black rounded-lg overflow-hidden">
            <video
              src={videoUrl}
              controls
              className="w-full h-full"
              style={{ maxHeight: '600px' }}
            >
              Your browser does not support the video tag.
            </video>
          </div>
        ) : (
          <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center">
            <p className="text-gray-500">No video available</p>
          </div>
        )}

        {project.transcript && (
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Transcript</h3>
            <p className="text-sm text-gray-600">{project.transcript.text}</p>
          </div>
        )}

        {project.instructions && project.instructions.length > 0 && (
          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <h3 className="text-sm font-semibold text-blue-900 mb-2">Applied Edits</h3>
            <ul className="space-y-1">
              {project.instructions.map((inst: any, index: number) => (
                <li key={index} className="text-sm text-blue-800">
                  • {inst.action}: {JSON.stringify(inst.parameters)}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}

