'use client'

import { useEffect, useState } from 'react'
import { Loader2, CheckCircle, Clock, Sparkles } from 'lucide-react'

interface ProcessingStage {
  id: string
  name: string
  description: string
  completed: boolean
  inProgress: boolean
  estimatedSeconds?: number
}

interface ProcessingProgressProps {
  project: any
  topics: any[]
  loadingTopics: boolean
  videoDuration?: number
}

export default function ProcessingProgress({
  project,
  topics,
  loadingTopics,
  videoDuration = 0
}: ProcessingProgressProps) {
  const [elapsedTime, setElapsedTime] = useState(0)

  // Calculate estimated times based on video duration
  const durationMinutes = videoDuration / 60
  const estimatedTranscriptionTime = Math.ceil(durationMinutes * 0.05) // ~5% of video length for AssemblyAI
  const estimatedTOCTime = 20 // Fixed ~20 seconds for TOC generation

  // Define processing stages with dynamic estimates
  const stages: ProcessingStage[] = [
    {
      id: 'download',
      name: 'Downloading Video',
      description: 'Fetching video from YouTube...',
      completed: !!project.localAudioPath || !!project.transcript,
      inProgress: !project.localAudioPath && !project.transcript,
      estimatedSeconds: 60
    },
    {
      id: 'audio',
      name: 'Extracting Audio',
      description: 'Converting video to audio format...',
      completed: !!project.localAudioPath || !!project.transcript,
      inProgress: !!project.localAudioPath && !project.transcript,
      estimatedSeconds: 50
    },
    {
      id: 'transcription',
      name: 'Transcribing Audio',
      description: `Ultra-fast AI transcription (${estimatedTranscriptionTime}s for ${Math.round(durationMinutes)}min video)`,
      completed: !!project.transcript,
      inProgress: !!project.localAudioPath && !project.transcript,
      estimatedSeconds: estimatedTranscriptionTime
    },
    {
      id: 'analysis',
      name: 'Video Analysis',
      description: 'Analyzing video content...',
      completed: !!project.videoAnalysis || project.analysisStatus === 'completed',
      inProgress: !!project.transcript && !project.videoAnalysis && (!project.duration || project.duration <= 1800),
      estimatedSeconds: 15
    },
    {
      id: 'toc',
      name: 'Table of Contents',
      description: 'Generating chapter markers...',
      completed: !loadingTopics && topics.length > 0,
      inProgress: loadingTopics,
      estimatedSeconds: estimatedTOCTime
    }
  ]

  // Filter stages based on video duration (skip analysis for long videos)
  const activeStages = stages.filter(stage => {
    if (stage.id === 'analysis' && project.duration && project.duration > 1800) {
      return false
    }
    return true
  })

  // Calculate overall progress
  const completedStages = activeStages.filter(s => s.completed).length
  const totalStages = activeStages.length
  const progressPercent = Math.round((completedStages / totalStages) * 100)

  // Find current stage
  const currentStage = activeStages.find(s => s.inProgress) || activeStages[activeStages.length - 1]

  // Calculate estimated time remaining
  const remainingStages = activeStages.filter(s => !s.completed)
  const estimatedTimeRemaining = remainingStages.reduce((sum, s) => sum + (s.estimatedSeconds || 0), 0)

  // Track elapsed time
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedTime(prev => prev + 1)
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  // Format time in MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="absolute inset-0 z-50 bg-white/95 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-xl w-full border border-slate-200/80">
        <div className="space-y-6">
          {/* Header with animated icon */}
          <div className="flex flex-col items-center">
            <div className="relative mb-4">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 animate-pulse"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <Sparkles className="w-10 h-10 text-white animate-pulse" />
              </div>
            </div>
            <h3 className="text-2xl font-bold text-slate-900 mb-2">
              Processing Your Video
            </h3>
            <p className="text-sm text-slate-600 text-center">
              {currentStage.description}
            </p>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600 font-medium">Progress</span>
              <span className="text-slate-900 font-bold">{progressPercent}%</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden shadow-inner">
              <div
                className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-full transition-all duration-500 ease-out shadow-lg"
                style={{ width: `${progressPercent}%` }}
              >
                <div className="h-full w-full bg-white/30 animate-pulse"></div>
              </div>
            </div>
          </div>

          {/* Stage List */}
          <div className="space-y-3">
            {activeStages.map((stage, index) => (
              <div
                key={stage.id}
                className={`flex items-start gap-3 p-3 rounded-lg transition-all duration-300 ${
                  stage.inProgress
                    ? 'bg-blue-50 border border-blue-200'
                    : stage.completed
                    ? 'bg-green-50 border border-green-200'
                    : 'bg-slate-50 border border-slate-200'
                }`}
              >
                <div className="flex-shrink-0 mt-0.5">
                  {stage.completed ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : stage.inProgress ? (
                    <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-slate-300"></div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold ${
                    stage.inProgress
                      ? 'text-blue-900'
                      : stage.completed
                      ? 'text-green-900'
                      : 'text-slate-500'
                  }`}>
                    {stage.name}
                  </p>
                  {stage.inProgress && (
                    <p className="text-xs text-blue-600 mt-0.5">
                      {stage.description}
                    </p>
                  )}
                </div>
                {stage.inProgress && stage.estimatedSeconds && (
                  <div className="flex-shrink-0 text-xs text-blue-600 font-medium">
                    ~{stage.estimatedSeconds}s
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Time Information */}
          <div className="flex items-center justify-between px-4 py-3 bg-slate-100 rounded-lg">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-600" />
              <span className="text-xs text-slate-600">Elapsed Time</span>
            </div>
            <span className="text-sm font-semibold text-slate-900">
              {formatTime(elapsedTime)}
            </span>
          </div>

          {estimatedTimeRemaining > 0 && (
            <div className="flex items-center justify-between px-4 py-3 bg-blue-50 rounded-lg">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-600" />
                <span className="text-xs text-blue-600">Estimated Remaining</span>
              </div>
              <span className="text-sm font-semibold text-blue-900">
                ~{formatTime(estimatedTimeRemaining)}
              </span>
            </div>
          )}

          {/* Helpful Tip */}
          <div className="pt-4 border-t border-slate-200">
            <p className="text-xs text-slate-500 text-center leading-relaxed">
              💡 <span className="font-medium">Pro tip:</span> You can safely close this page. We'll process your video in the background and save it for you.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
