import { revalidatePath } from 'next/cache'
import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/revalidate
 * On-demand ISR revalidation for guides pages
 *
 * Body: { paths?: string[], secret?: string }
 *
 * Examples:
 *   { "paths": ["/guides"] }  - Revalidate directory only
 *   { "paths": ["/guides", "/guides/some-slug"] }  - Revalidate specific pages
 *   { }  - Revalidate /guides by default
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { paths = ['/guides'], secret } = body

    // Optional: Validate secret token for security
    const expectedSecret = process.env.REVALIDATION_SECRET
    if (expectedSecret && secret !== expectedSecret) {
      return NextResponse.json(
        { success: false, error: 'Invalid secret' },
        { status: 401 }
      )
    }

    // Revalidate each path
    const revalidated: string[] = []
    for (const path of paths) {
      if (typeof path === 'string' && path.startsWith('/')) {
        revalidatePath(path)
        revalidated.push(path)
      }
    }

    console.log(`[Revalidate] Paths revalidated: ${revalidated.join(', ')}`)

    return NextResponse.json({
      success: true,
      revalidated,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('[Revalidate] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Revalidation failed' },
      { status: 500 }
    )
  }
}

// Also support GET for simple webhook triggers
export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get('secret')
  const path = request.nextUrl.searchParams.get('path') || '/guides'

  const expectedSecret = process.env.REVALIDATION_SECRET
  if (expectedSecret && secret !== expectedSecret) {
    return NextResponse.json(
      { success: false, error: 'Invalid secret' },
      { status: 401 }
    )
  }

  revalidatePath(path)

  return NextResponse.json({
    success: true,
    revalidated: [path],
    timestamp: new Date().toISOString()
  })
}
