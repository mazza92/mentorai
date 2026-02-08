import { NextRequest, NextResponse } from 'next/server'

const INDEXNOW_KEY = 'lurnia-indexnow-key-2024'
const SITE_HOST = 'lurnia.app'

/**
 * POST /api/indexnow
 * Notify search engines (Bing, Yandex) about new/updated URLs via IndexNow
 *
 * Body: { urls: string[] }
 *
 * IndexNow instantly notifies search engines about content changes,
 * reducing the time between publishing and indexing.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { urls = [] } = body

    if (!urls.length) {
      return NextResponse.json(
        { success: false, error: 'No URLs provided' },
        { status: 400 }
      )
    }

    // Ensure URLs are absolute
    const absoluteUrls = urls.map((url: string) => {
      if (url.startsWith('http')) return url
      return `https://${SITE_HOST}${url.startsWith('/') ? url : '/' + url}`
    })

    // IndexNow API endpoint (Bing hosts this, shared with Yandex, Seznam, etc.)
    const indexNowPayload = {
      host: SITE_HOST,
      key: INDEXNOW_KEY,
      keyLocation: `https://${SITE_HOST}/${INDEXNOW_KEY}.txt`,
      urlList: absoluteUrls.slice(0, 10000) // Max 10k URLs per request
    }

    const response = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(indexNowPayload)
    })

    // IndexNow returns 200, 202 (accepted), or 4xx/5xx
    const success = response.status >= 200 && response.status < 300

    console.log(`[IndexNow] Submitted ${absoluteUrls.length} URLs, status: ${response.status}`)

    return NextResponse.json({
      success,
      submitted: absoluteUrls.length,
      status: response.status,
      urls: absoluteUrls
    })
  } catch (error) {
    console.error('[IndexNow] Error:', error)
    return NextResponse.json(
      { success: false, error: 'IndexNow submission failed' },
      { status: 500 }
    )
  }
}

// GET endpoint for testing
export async function GET() {
  return NextResponse.json({
    service: 'IndexNow',
    key: INDEXNOW_KEY,
    keyUrl: `https://${SITE_HOST}/${INDEXNOW_KEY}.txt`,
    usage: 'POST { urls: ["/guides/slug1", "/guides/slug2"] }'
  })
}
