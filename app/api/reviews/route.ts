// Live Google rating and review count for the landing page.
//
// Needs two environment variables in the Vercel project:
//   GOOGLE_PLACES_API_KEY  a Google Cloud API key with Places API (New) enabled
//   GOOGLE_PLACE_ID        the business's Place ID (from Google's Place ID Finder)
// Until both are set the route answers { configured: false } and the page keeps
// the numbers written into public/index.html.
//
// The answer is cached for a day (Next.js data cache plus the CDN), so Google is
// asked roughly once a day no matter how much traffic the page gets.

const DAY = 60 * 60 * 24

function json(body: Record<string, unknown>, cacheSeconds: number) {
  return Response.json(body, {
    headers: {
      'Cache-Control': `public, max-age=300, s-maxage=${cacheSeconds}, stale-while-revalidate=3600`,
    },
  })
}

export async function GET() {
  const key = process.env.GOOGLE_PLACES_API_KEY
  const placeId = process.env.GOOGLE_PLACE_ID
  if (!key || !placeId) return json({ configured: false }, 300)

  try {
    const res = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
      headers: { 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'rating,userRatingCount' },
      next: { revalidate: DAY },
      signal: AbortSignal.timeout(8_000),
    })
    if (!res.ok) {
      console.error('Places API returned', res.status, await res.text().catch(() => ''))
      return json({ error: 'places_failed' }, 300)
    }
    const place = (await res.json()) as { rating?: unknown; userRatingCount?: unknown }
    const rating = Number(place.rating)
    const count = Number(place.userRatingCount)
    if (!(rating >= 1 && rating <= 5) || !Number.isInteger(count) || count < 1) {
      console.error('Places API returned unexpected data', place)
      return json({ error: 'bad_data' }, 300)
    }
    return json({ rating: Math.round(rating * 10) / 10, count }, DAY)
  } catch (error) {
    console.error('Places API request failed', error)
    return json({ error: 'places_failed' }, 300)
  }
}
