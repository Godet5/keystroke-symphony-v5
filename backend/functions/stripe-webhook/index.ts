/**
 * Supabase Edge Function: stripe-webhook
 *
 * Purpose: Handle Stripe webhook events to sync subscription status with database
 *
 * CRITICAL SECURITY:
 * - ALWAYS verify webhook signature (prevents spoofing)
 * - Never trust data without signature verification
 *
 * Events Handled:
 * 1. checkout.session.completed - User completed checkout → Upgrade to PAID
 * 2. customer.subscription.updated - Subscription changed → Update status
 * 3. customer.subscription.deleted - Subscription canceled → Downgrade to FREE
 * 4. invoice.payment_succeeded - Payment successful → Log success
 * 5. invoice.payment_failed - Payment failed → Mark as past_due
 *
 * Idempotency:
 * - Webhooks may be sent multiple times (Stripe retries on failure)
 * - Use Stripe event IDs to prevent duplicate processing
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14.10.0?target=deno';

// Initialize Stripe
const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
});

// Supabase client config
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;

// Track processed events (simple in-memory cache, resets on cold start)
// In production, consider using Redis or database for distributed systems
const processedEvents = new Set<string>();

serve(async (req) => {
  // Stripe webhooks always POST
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    console.error('Missing Stripe signature header');
    return new Response('Missing signature', { status: 400 });
  }

  try {
    // 1. Verify webhook signature (CRITICAL SECURITY)
    const body = await req.text();
    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return new Response(
        JSON.stringify({ error: 'Invalid signature' }),
        {
          headers: { 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    console.log(`Webhook received: ${event.type} (ID: ${event.id})`);

    // 2. Check idempotency (prevent duplicate processing)
    if (processedEvents.has(event.id)) {
      console.log(`Event ${event.id} already processed, skipping`);
      return new Response(
        JSON.stringify({ received: true, skipped: true }),
        {
          headers: { 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // 3. Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 4. Process event based on type
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        console.log(`Processing checkout.session.completed: ${session.id}`);

        // Get user ID from session metadata
        const userId = session.client_reference_id || session.metadata?.supabase_user_id;

        if (!userId) {
          console.error('Missing user ID in checkout session');
          throw new Error('Missing user ID in session');
        }

        // Retrieve full subscription details
        const subscriptionId = session.subscription as string;
        if (!subscriptionId) {
          console.error('No subscription ID in checkout session');
          throw new Error('No subscription in session');
        }

        const subscription = await stripe.subscriptions.retrieve(subscriptionId);

        // Update user profile to PAID tier
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            tier: 'PAID',
            stripe_customer_id: session.customer as string,
            stripe_subscription_id: subscription.id,
            subscription_status: subscription.status,
            subscription_current_period_end: new Date(
              subscription.current_period_end * 1000
            ).toISOString(),
            daily_limit: 999999, // Unlimited for paid users
          })
          .eq('id', userId);

        if (updateError) {
          console.error('Failed to update user profile:', updateError);
          throw updateError;
        }

        console.log(`User ${userId} upgraded to PAID tier`);
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        console.log(`Processing subscription update for customer ${customerId}`);

        // Find user by customer ID
        const { data: profile, error: fetchError } = await supabase
          .from('profiles')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .single();

        if (fetchError || !profile) {
          console.error('User not found for customer:', customerId);
          throw new Error('User not found for customer');
        }

        // Update subscription status
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            subscription_status: subscription.status,
            subscription_current_period_end: new Date(
              subscription.current_period_end * 1000
            ).toISOString(),
            stripe_subscription_id: subscription.id,
          })
          .eq('id', profile.id);

        if (updateError) {
          console.error('Failed to update subscription status:', updateError);
          throw updateError;
        }

        console.log(
          `Subscription updated for user ${profile.id}: status=${subscription.status}`
        );
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        console.log(`Processing subscription deletion for customer ${customerId}`);

        // Find user by customer ID
        const { data: profile, error: fetchError } = await supabase
          .from('profiles')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .single();

        if (fetchError || !profile) {
          console.error('User not found for customer:', customerId);
          throw new Error('User not found for customer');
        }

        // Downgrade user to FREE tier
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            tier: 'FREE',
            subscription_status: 'canceled',
            stripe_subscription_id: null,
            daily_limit: 1, // Reset to free tier limit
          })
          .eq('id', profile.id);

        if (updateError) {
          console.error('Failed to downgrade user:', updateError);
          throw updateError;
        }

        console.log(`User ${profile.id} downgraded to FREE tier`);
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        console.log(`Payment succeeded for customer ${customerId}`);

        // Optional: Log successful payment to a payments table
        // Or send receipt email (Stripe handles this automatically)

        // For recurring subscriptions, just log success
        // The subscription status is already 'active' from subscription.updated event

        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        console.error(`Payment failed for customer ${customerId}`);

        // Find user and update status to past_due
        const { data: profile, error: fetchError } = await supabase
          .from('profiles')
          .select('id, tier')
          .eq('stripe_customer_id', customerId)
          .single();

        if (fetchError || !profile) {
          console.error('User not found for customer:', customerId);
          throw new Error('User not found for customer');
        }

        // Update subscription status to past_due
        // Don't immediately downgrade - give Stripe time to retry
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ subscription_status: 'past_due' })
          .eq('id', profile.id);

        if (updateError) {
          console.error('Failed to update payment status:', updateError);
          throw updateError;
        }

        console.log(`User ${profile.id} marked as past_due`);

        // Optional: Send notification to user
        // (Stripe automatically sends email, but you can add in-app notification)

        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    // 5. Mark event as processed
    processedEvents.add(event.id);

    // 6. Return 200 OK (REQUIRED - Stripe will retry if not 200)
    return new Response(
      JSON.stringify({ received: true, eventId: event.id }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Webhook error:', error);

    // Log error but still return 200 to prevent infinite retries
    // (unless it's a signature verification error, which should return 400)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return new Response(
      JSON.stringify({
        error: 'Webhook processing failed',
        details: errorMessage,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
