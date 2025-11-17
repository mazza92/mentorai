import axios from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export const api = {
  // Upload video
  uploadVideo: async (file: File, userId: string) => {
    const formData = new FormData()
    formData.append('video', file)
    formData.append('userId', userId)
    
    return axios.post(`${API_URL}/api/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
  },

  // Transcribe video
  transcribe: async (projectId: string) => {
    return axios.post(`${API_URL}/api/transcribe`, { projectId })
  },

  // Edit video
  editVideo: async (projectId: string, userPrompt: string, userId: string) => {
    return axios.post(`${API_URL}/api/edit`, {
      projectId,
      userPrompt,
      userId,
    })
  },

  // Get project
  getProject: async (projectId: string) => {
    return axios.get(`${API_URL}/api/projects/project/${projectId}`)
  },

  // Get user projects
  getUserProjects: async (userId: string) => {
    return axios.get(`${API_URL}/api/projects/${userId}`)
  },

  // Get user info
  getUser: async (userId: string) => {
    return axios.get(`${API_URL}/api/user/${userId}`)
  },

  // Check export eligibility
  checkExport: async (userId: string) => {
    return axios.post(`${API_URL}/api/user/${userId}/check-export`)
  },

  // Export video
  exportVideo: async (projectId: string, userId: string) => {
    return axios.post(`${API_URL}/api/export`, {
      projectId,
      userId,
    })
  },
}

