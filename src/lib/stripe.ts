import Stripe from 'stripe'

let _stripe: Stripe | null = null

/**
 * Lazily-initialized Stripe client. Safe during Next.js build.
 * The STRIPE_SECRET_KEY environment variable must be set at runtime.
 */
export function getStripe(): Stripe {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY is not set')
    }
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2024-12-18.acacia',
    })
  }
  return _stripe
}

// Backwards-compatible named export
export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    return getStripe()[prop as keyof Stripe]
  },
})
