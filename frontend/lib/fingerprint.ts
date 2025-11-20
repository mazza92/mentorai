/**
 * Browser Fingerprinting
 * Generates a unique fingerprint to prevent VPN/cookie bypass
 */

/**
 * Generate a canvas fingerprint
 */
function getCanvasFingerprint(): string {
  try {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) return 'no-canvas'

    canvas.width = 200
    canvas.height = 50

    // Draw text with specific styling
    ctx.textBaseline = 'top'
    ctx.font = '14px "Arial"'
    ctx.textBaseline = 'alphabetic'
    ctx.fillStyle = '#f60'
    ctx.fillRect(125, 1, 62, 20)
    ctx.fillStyle = '#069'
    ctx.fillText('Browser Fingerprint', 2, 15)
    ctx.fillStyle = 'rgba(102, 204, 0, 0.7)'
    ctx.fillText('Browser Fingerprint', 4, 17)

    // Convert to data URL
    return canvas.toDataURL()
  } catch {
    return 'canvas-error'
  }
}

/**
 * Generate a WebGL fingerprint
 */
function getWebGLFingerprint(): string {
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl') as WebGLRenderingContext | null
    if (!gl) return 'no-webgl'

    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info')
    if (!debugInfo) return 'no-debug-info'

    const vendor = gl.getParameter((debugInfo as any).UNMASKED_VENDOR_WEBGL)
    const renderer = gl.getParameter((debugInfo as any).UNMASKED_RENDERER_WEBGL)

    return `${vendor}~${renderer}`
  } catch {
    return 'webgl-error'
  }
}

/**
 * Get screen properties
 */
function getScreenFingerprint(): string {
  const screen = window.screen
  return `${screen.width}x${screen.height}x${screen.colorDepth}@${screen.availWidth}x${screen.availHeight}`
}

/**
 * Get timezone
 */
function getTimezoneFingerprint(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

/**
 * Get language preferences
 */
function getLanguageFingerprint(): string {
  return `${navigator.language}|${navigator.languages.join(',')}`
}

/**
 * Get platform info
 */
function getPlatformFingerprint(): string {
  return `${navigator.platform}|${navigator.userAgent.substring(0, 50)}`
}

/**
 * Simple hash function
 */
function simpleHash(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36)
}

/**
 * Generate a unique browser fingerprint
 * Returns a hash that's consistent across sessions but unique per browser
 */
export function generateFingerprint(): string {
  if (typeof window === 'undefined') {
    return 'server-side'
  }

  try {
    const components = [
      getCanvasFingerprint(),
      getWebGLFingerprint(),
      getScreenFingerprint(),
      getTimezoneFingerprint(),
      getLanguageFingerprint(),
      getPlatformFingerprint(),
    ]

    const combined = components.join('|')
    const hash = simpleHash(combined)

    console.log('🔐 Browser fingerprint generated:', hash)

    return `fp_${hash}`
  } catch (error) {
    console.error('Fingerprint generation error:', error)
    return `fp_error_${Date.now()}`
  }
}

/**
 * Get or create cached fingerprint
 */
export function getCachedFingerprint(): string {
  if (typeof window === 'undefined') {
    return 'server-side'
  }

  // Check if we already have a fingerprint cached
  const cached = localStorage.getItem('wandercut_fingerprint')
  if (cached) {
    return cached
  }

  // Generate new fingerprint
  const fingerprint = generateFingerprint()
  localStorage.setItem('wandercut_fingerprint', fingerprint)

  return fingerprint
}
