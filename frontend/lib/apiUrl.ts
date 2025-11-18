/**
 * Get the API URL with proper protocol
 * Ensures the URL always has http:// or https://
 */
export function getApiUrl(): string {
  let apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
  
  // Remove trailing slash
  apiUrl = apiUrl.replace(/\/$/, '')
  
  // Ensure URL has protocol
  if (!apiUrl.startsWith('http://') && !apiUrl.startsWith('https://')) {
    // Default to https for production-like domains
    apiUrl = `https://${apiUrl}`
  }
  
  return apiUrl
}

