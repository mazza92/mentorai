import { NextResponse } from 'next/server'

export async function GET() {
  const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID

  return NextResponse.json({
    hasGaId: !!gaId,
    gaId: gaId ? `${gaId.substring(0, 4)}...${gaId.substring(gaId.length - 4)}` : 'NOT SET',
    fullId: gaId || 'Environment variable NEXT_PUBLIC_GA_MEASUREMENT_ID is not set'
  })
}
