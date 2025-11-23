/**
 * Supabase Edge Function: create-checkout-session
 *
 * Purpose: Create a Stripe Checkout Session for subscription signup
 *
 * Flow:
 * 1. Verify user is authenticated
 * 2. Check if user already has a Stripe customer ID
 * 3. If not, create a new Stripe customer
 * 4. Create a Checkout Session with the subscription price
 * 5. Return the checkout URL to redirect user
 *
 * Security:
 * - Requires authentication (JWT in Authorization header)
 * - Uses Stripe Secret Key (never exposed to client)
 * - Links customer to Supabase user for tracking
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

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limiting map (simple in-memory, resets on function cold start)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

// Helper: Check rate limit (max 5 requests per minute per user)
function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const userLimit = rateLimitMap.get(userId);

  if (!userLimit || now > userLimit.resetAt) {
    // Reset or initialize
    rateLimitMap.set(userId, { count: 1, resetAt: now + 60000 });
    return true;
  }

  if (userLimit.count >= 5) {
    return false; // Rate limit exceeded
  }

  userLimit.count++;
  return true;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.replace('Bearer ', '');

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Invalid authentication token' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 2. Check rate limit
    if (!checkRateLimit(user.id)) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded. Please try again in a minute.' }),
        {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 3. Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('stripe_customer_id, tier, subscription_status')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('Profile fetch error:', profileError);
      throw new Error('User profile not found');
    }

    // 4. Check if already subscribed
    if (profile.tier === 'PAID' && profile.subscription_status === 'active') {
      return new Response(
        JSON.stringify({
          error: 'Already subscribed',
          message: 'You already have an active subscription. Use the Customer Portal to manage it.'
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 5. Parse request body
    const { priceId } = await req.json();

    // Use provided priceId or fall back to env var
    const finalPriceId = priceId || Deno.env.get('STRIPE_PRICE_ID');

    if (!finalPriceId) {
      throw new Error('Missing price ID. Please contact support.');
    }

    // 6. Create or retrieve Stripe customer
    let customerId = profile.stripe_customer_id;

    if (!customerId) {
      console.log(`Creating new Stripe customer for user ${user.id}`);

      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          supabase_user_id: user.id,
        },
      });

      customerId = customer.id;

      // Update profile with customer ID
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id);

      if (updateError) {
        console.error('Failed to update profile with customer ID:', updateError);
        // Continue anyway - we can retry update on webhook
      }
    } else {
      console.log(`Using existing Stripe customer ${customerId} for user ${user.id}`);
    }

    // 7. Create Checkout Session
    const origin = req.headers.get('origin') || 'http://localhost:5173';

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      client_reference_id: user.id, // Link session to Supabase user
      line_items: [
        {
          price: finalPriceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${origin}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/subscription/canceled`,
      allow_promotion_codes: true, // Allow users to enter promo codes
      billing_address_collection: 'auto',
      customer_update: {
        address: 'auto', // Update customer address from checkout
      },
      metadata: {
        supabase_user_id: user.id,
      },
      subscription_data: {
        metadata: {
          supabase_user_id: user.id,
        },
      },
    });

    console.log(`Checkout session created: ${session.id} for user ${user.id}`);

    // 8. Return checkout URL
    return new Response(
      JSON.stringify({
        url: session.url,
        sessionId: session.id,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Checkout session error:', error);

    // Return user-friendly error message
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

    return new Response(
      JSON.stringify({
        error: 'Failed to create checkout session',
        details: errorMessage,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
