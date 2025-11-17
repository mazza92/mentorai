'use client'

import { useState, useEffect } from 'react'
import axios from 'axios'
import { Upload, Video, User } from 'lucide-react'

interface HeaderProps {
  userId: string
  onNewProject: () => void
}

export default function Header({ userId, onNewProject }: HeaderProps) {
  const [userInfo, setUserInfo] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchUserInfo()
  }, [userId])

  const fetchUserInfo = async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
      const response = await axios.get(`${apiUrl}/api/user/${userId}`)
      setUserInfo(response.data.user)
    } catch (error) {
      console.error('Error fetching user info:', error)
    } finally {
      setLoading(false)
    }
  }

  const tier = userInfo?.tier || 'free'
  const exportsThisMonth = userInfo?.exportsThisMonth || 0
  const questionsThisMonth = userInfo?.questionsThisMonth || 0
  const exportLimit = tier === 'free' ? 3 : Infinity
  const questionLimit = tier === 'free' ? 50 : Infinity

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="container mx-auto px-4 py-4 max-w-7xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Video className="w-6 h-6 text-primary-600" />
              <span className="text-xl font-bold text-gray-900">WanderCut</span>
            </div>
            <button
              onClick={onNewProject}
              className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-gray-700 hover:text-primary-600 transition-colors"
            >
              <Upload className="w-4 h-4" />
              <span>New Project</span>
            </button>
          </div>

          <div className="flex items-center space-x-6">
            <div className="text-sm text-gray-600">
              {tier === 'free' ? (
                <div className="flex items-center space-x-4">
                  <span>
                    Exports: {exportsThisMonth}/{exportLimit}
                  </span>
                  <span className="text-gray-400">|</span>
                  <span>
                    Questions: {questionsThisMonth}/{questionLimit}
                  </span>
                </div>
              ) : (
                <span className="text-primary-600 font-medium">Creator Tier (Unlimited)</span>
              )}
            </div>
            <div className="flex items-center space-x-2">
              <User className="w-5 h-5 text-gray-400" />
              <span className="text-sm text-gray-600">{userId.slice(0, 8)}...</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}

