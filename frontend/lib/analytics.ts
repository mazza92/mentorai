/**
 * Enhanced Analytics Tracking for Lurnia
 * Provides comprehensive funnel tracking and user behavior analytics
 */

// Get UTM parameters from URL
export function getUTMParams(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  
  const params = new URLSearchParams(window.location.search)
  const utmParams: Record<string, string> = {}
  
  const utmKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid']
  utmKeys.forEach(key => {
    const value = params.get(key)
    if (value) {
      utmParams[key] = value
    }
  })
  
  // Store UTM params in sessionStorage for attribution across page loads
  if (Object.keys(utmParams).length > 0) {
    sessionStorage.setItem('utm_params', JSON.stringify(utmParams))
  }
  
  // Return stored params if no new ones
  const stored = sessionStorage.getItem('utm_params')
  return stored ? JSON.parse(stored) : utmParams
}

// Get or create a session ID for anonymous tracking
export function getSessionTrackingId(): string {
  if (typeof window === 'undefined') return 'ssr'
  
  let sessionId = sessionStorage.getItem('analytics_session_id')
  if (!sessionId) {
    sessionId = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    sessionStorage.setItem('analytics_session_id', sessionId)
  }
  return sessionId
}

// Track event with enriched data
export function trackAnalyticsEvent(
  eventName: string, 
  eventParams: Record<string, any> = {}
) {
  if (typeof window === 'undefined') return
  
  const gtag = (window as any).gtag
  if (!gtag) {
    console.warn('[Analytics] gtag not loaded')
    return
  }
  
  // Enrich with UTM params and session info
  const enrichedParams = {
    ...eventParams,
    ...getUTMParams(),
    session_id: getSessionTrackingId(),
    page_path: window.location.pathname,
    page_referrer: document.referrer,
    timestamp: new Date().toISOString(),
  }
  
  gtag('event', eventName, enrichedParams)
  
  // Also log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.log(`[Analytics] ${eventName}`, enrichedParams)
  }
}

// =====================================================
// FUNNEL TRACKING EVENTS
// =====================================================

/**
 * Track when user lands on the page (with source attribution)
 */
export function trackLandingPageView() {
  trackAnalyticsEvent('landing_page_view', {
    has_utm: Object.keys(getUTMParams()).length > 0,
    source: getUTMParams().utm_source || 'direct',
    medium: getUTMParams().utm_medium || 'none',
    campaign: getUTMParams().utm_campaign || 'none',
  })
}

/**
 * Track landing page scroll depth
 */
export function trackScrollDepth(depth: number) {
  trackAnalyticsEvent('scroll_depth', {
    depth_percent: depth,
    milestone: depth >= 75 ? 'deep' : depth >= 50 ? 'mid' : depth >= 25 ? 'shallow' : 'top',
  })
}

/**
 * Track when user focuses on the URL input (intent signal)
 */
export function trackInputFocus() {
  trackAnalyticsEvent('url_input_focus', {
    funnel_stage: 'interest',
  })
}

/**
 * Track when user starts typing in URL input
 */
export function trackInputTyping() {
  trackAnalyticsEvent('url_input_typing', {
    funnel_stage: 'consideration',
  })
}

/**
 * Track when user submits a URL
 */
export function trackUrlSubmit(urlType: 'channel' | 'video') {
  trackAnalyticsEvent('url_submit', {
    url_type: urlType,
    funnel_stage: 'action',
  })
}

/**
 * Track video/channel processing start
 */
export function trackProcessingStart(data: {
  projectId: string
  type: 'channel' | 'video'
  channelName?: string
  videoCount?: number
}) {
  trackAnalyticsEvent('processing_start', {
    ...data,
    funnel_stage: 'processing',
  })
}

/**
 * Track video/channel processing complete
 */
export function trackProcessingComplete(data: {
  projectId: string
  type: 'channel' | 'video'
  duration_seconds: number
  video_count?: number
}) {
  trackAnalyticsEvent('processing_complete', {
    ...data,
    funnel_stage: 'ready',
  })
}

/**
 * Track first question asked (key activation metric)
 */
export function trackFirstQuestion(data: {
  projectId: string
  questionLength: number
}) {
  trackAnalyticsEvent('first_question', {
    ...data,
    funnel_stage: 'activation',
  })
}

/**
 * Track question asked (repeat engagement)
 */
export function trackQuestionAsked(data: {
  projectId: string
  questionNumber: number
  questionLength: number
  hasAnswer: boolean
  answerSourceCount?: number
}) {
  trackAnalyticsEvent('question_asked', {
    ...data,
    is_engaged_user: data.questionNumber >= 3,
  })
}

/**
 * Track when user receives an answer with citations
 */
export function trackAnswerReceived(data: {
  projectId: string
  answerLength: number
  citationCount: number
  responseTime_ms: number
}) {
  trackAnalyticsEvent('answer_received', {
    ...data,
    answer_quality: data.citationCount > 0 ? 'cited' : 'uncited',
  })
}

/**
 * Track when signup wall is shown
 */
export function trackSignupWallShown(reason: 'video_limit' | 'question_limit' | 'feature_gate') {
  trackAnalyticsEvent('signup_wall_shown', {
    trigger_reason: reason,
    funnel_stage: 'conversion_prompt',
  })
}

/**
 * Track when upgrade modal is shown
 */
export function trackUpgradeModalShown(reason: string, currentUsage?: { used: number; limit: number }) {
  trackAnalyticsEvent('upgrade_modal_shown', {
    trigger_reason: reason,
    current_usage: currentUsage?.used,
    usage_limit: currentUsage?.limit,
    funnel_stage: 'upsell_prompt',
  })
}

/**
 * Track signup attempt
 */
export function trackSignupAttempt(method: 'email' | 'google') {
  trackAnalyticsEvent('signup_attempt', {
    method,
    funnel_stage: 'signup_attempt',
  })
}

/**
 * Track signup success
 */
export function trackSignupSuccess(method: 'email' | 'google') {
  trackAnalyticsEvent('signup_success', {
    method,
    funnel_stage: 'signup_complete',
  })
}

/**
 * Track checkout initiated
 */
export function trackCheckoutInitiated(plan: string, value: number) {
  trackAnalyticsEvent('checkout_initiated', {
    plan,
    value,
    currency: 'EUR',
    funnel_stage: 'checkout',
  })
}

/**
 * Track purchase complete
 */
export function trackPurchaseComplete(data: {
  plan: string
  value: number
  transaction_id: string
}) {
  trackAnalyticsEvent('purchase', {
    ...data,
    currency: 'EUR',
    funnel_stage: 'converted',
  })
}

// =====================================================
// USER BEHAVIOR EVENTS
// =====================================================

/**
 * Track time spent on page before taking action
 */
export function trackTimeToAction(action: string, seconds: number) {
  trackAnalyticsEvent('time_to_action', {
    action,
    seconds,
    is_quick: seconds < 30,
    is_considered: seconds >= 30 && seconds < 120,
    is_hesitant: seconds >= 120,
  })
}

/**
 * Track feature usage
 */
export function trackFeatureUsage(feature: string, context?: Record<string, any>) {
  trackAnalyticsEvent('feature_usage', {
    feature,
    ...context,
  })
}

/**
 * Track user returning to app
 */
export function trackReturnVisit(daysSinceLastVisit: number) {
  trackAnalyticsEvent('return_visit', {
    days_since_last: daysSinceLastVisit,
    is_same_day: daysSinceLastVisit === 0,
    is_next_day: daysSinceLastVisit === 1,
    is_within_week: daysSinceLastVisit <= 7,
  })
}

/**
 * Track conversation history navigation
 */
export function trackConversationSwitch() {
  trackAnalyticsEvent('conversation_switch', {
    behavior: 'multi_project_user',
  })
}

/**
 * Track error encountered
 */
export function trackError(errorType: string, errorMessage: string, context?: string) {
  trackAnalyticsEvent('error_encountered', {
    error_type: errorType,
    error_message: errorMessage.substring(0, 100), // Truncate
    context,
  })
}

// =====================================================
// SCROLL DEPTH TRACKER (auto-initialize)
// =====================================================

let scrollDepthTracked = { 25: false, 50: false, 75: false, 100: false }

export function initScrollTracking() {
  if (typeof window === 'undefined') return
  
  const handleScroll = () => {
    const scrollTop = window.scrollY
    const docHeight = document.documentElement.scrollHeight - window.innerHeight
    const scrollPercent = Math.round((scrollTop / docHeight) * 100)
    
    const milestones = [25, 50, 75, 100] as const
    milestones.forEach(milestone => {
      if (scrollPercent >= milestone && !scrollDepthTracked[milestone]) {
        scrollDepthTracked[milestone] = true
        trackScrollDepth(milestone)
      }
    })
  }
  
  // Throttle scroll events
  let ticking = false
  window.addEventListener('scroll', () => {
    if (!ticking) {
      window.requestAnimationFrame(() => {
        handleScroll()
        ticking = false
      })
      ticking = true
    }
  })
}

// Reset scroll tracking on route change
export function resetScrollTracking() {
  scrollDepthTracked = { 25: false, 50: false, 75: false, 100: false }
}

