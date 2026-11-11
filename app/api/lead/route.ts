// Receives lead form posts from public/index.html and forwards them to Zapier.
//
// Leads go to the Zapier "Catch Hook" URL in the ZAPIER_WEBHOOK_URL environment
// variable, set in the Vercel project. Keep the URL out of this repository:
// anyone who has it can post fake leads into the Zap. Until it is set (or when
// it is set to "test") the route answers { test: true } and the thank-you
// screen says nothing was sent.

const TRACKING_KEYS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'gclid',
  'gbraid',
  'wbraid',
  'fbclid',
] as const

const INTERESTS = ['Buy', 'Build', 'Sell'] as const

function text(value: unknown, max = 200): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function json(body: Record<string, unknown>, status = 200) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: Request) {
  let input: Record<string, unknown>
  try {
    input = await request.json()
  } catch {
    return json({ error: 'invalid_json' }, 400)
  }
  if (!input || typeof input !== 'object') return json({ error: 'invalid_json' }, 400)

  // Honeypot: people never see this field, bots tend to fill it. Pretend it worked.
  if (text(input.website)) return json({ ok: true })

  const firstName = text(input.first_name, 60)
  const lastName = text(input.last_name, 80)
  const email = text(input.email, 200)
  let digits = text(input.phone, 40).replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('1')) digits = digits.slice(1)
  const interests = Array.isArray(input.interests)
    ? INTERESTS.filter((option) => (input.interests as unknown[]).includes(option))
    : []

  const problems: string[] = []
  if (!firstName) problems.push('first_name')
  if (!lastName) problems.push('last_name')
  if (!/^[2-9]\d{9}$/.test(digits)) problems.push('phone')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) problems.push('email')
  if (!interests.length) problems.push('interests')
  if (problems.length) return json({ error: 'invalid', fields: problems }, 422)

  const now = new Date()
  const lead: Record<string, string> = {
    name: `${firstName} ${lastName}`,
    first_name: firstName,
    last_name: lastName,
    phone: `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`,
    phone_e164: `+1${digits}`,
    email,
    interest: interests.join(', '),
    wants_to_buy: interests.includes('Buy') ? 'yes' : 'no',
    wants_to_build: interests.includes('Build') ? 'yes' : 'no',
    wants_to_sell: interests.includes('Sell') ? 'yes' : 'no',
    source: 'Lakewood Ranch landing page',
    page: text(input.page, 500),
    referrer: text(input.referrer, 500),
    submitted_at: now.toISOString(),
    submitted_at_local: now.toLocaleString('en-US', { timeZone: 'America/New_York' }),
  }
  for (const key of TRACKING_KEYS) lead[key] = text(input[key], 300)

  const webhook = process.env.ZAPIER_WEBHOOK_URL
  if (!webhook || webhook === 'test') return json({ ok: true, test: true })

  try {
    const res = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(lead),
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) {
      console.error('Zapier webhook returned', res.status, await res.text().catch(() => ''))
      return json({ error: 'forward_failed' }, 502)
    }
  } catch (error) {
    console.error('Zapier webhook request failed', error)
    return json({ error: 'forward_failed' }, 502)
  }

  return json({ ok: true })
}
