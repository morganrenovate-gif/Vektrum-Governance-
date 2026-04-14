import Stripe from 'stripe'

/**
 * Singleton Stripe client. Use this instance throughout the application.
 * The STRIPE_SECRET_KEY environment variable must be set in all environments.
 */
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia',
})
