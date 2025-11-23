# Stripe Integration for Keystroke Symphony

**Version:** 1.0
**Last Updated:** 2025-11-22
**Integration Type:** Subscription-based SaaS with Stripe Checkout + Customer Portal

---

## Overview

This document defines the complete Stripe payment integration for Keystroke Symphony's subscription model:
- **Free Tier**: 1 curriculum challenge only
- **Paid Tier ($9.99/month)**: All features unlocked (unlimited sessions, recording/export, community access)
- **Stripe Checkout** for subscription flow
- **Stripe Customer Portal** for self-service management
- **Webhooks** for automated subscription lifecycle

---

## Pricing Model (3-Tier Structure)

### Subscription Tiers

**FREE Tier**: $0/month (email enrollment only)
- Basic access
- Limited features
- Email verification required

**TIER 1 (Base Paid)**: $4.99/month
- Expanded feature set
- Recording capabilities
- Community access

**TIER 2 (Premium)**: $9.99/month
- Full feature access
- Unlimited sessions
- All challenges
- Export functionality
- Priority support

### Products and Prices (Create in Stripe Dashboard)

```javascript
// Product 1: Keystroke Symphony - Base Paid (Tier 1)
{
  name: "Keystroke Symphony Base",
  description: "Upgrade to unlock recordings and community features",
  pricing: {
    type: "recurring",
    interval: "month",
    amount: 499, // $4.99 USD (in cents)
    currency: "usd"
  },
  metadata: {
    tier: "TIER_1",
    features: "recordings,community,basic_challenges"
  }
}

// Product 2: Keystroke Symphony - Premium (Tier 2)
{
  name: "Keystroke Symphony Premium",
  description: "Full access to all challenges, unlimited sessions, and export",
  pricing: {
    type: "recurring",
    interval: "month",
    amount: 999, // $9.99 USD (in cents)
    currency: "usd"
  },
  metadata: {
    tier: "TIER_2",
    features: "unlimited_sessions,all_challenges,recordings,community,export,priority_support"
  }
}
```

**Create in Stripe Dashboard:**
1. Go to Products > Add product
2. Create **Base** product:
   - Name: "Keystroke Symphony Base"
   - Pricing: Recurring, $4.99/month
   - Save → Copy `price_id` (e.g., `price_tier1_xxxxx`)
3. Create **Premium** product:
   - Name: "Keystroke Symphony Premium"
   - Pricing: Recurring, $9.99/month
   - Save → Copy `price_id` (e.g., `price_tier2_xxxxx`)

---

## Stripe Dashboard Configuration

### 1. Enable Customer Portal

**Settings > Billing > Customer portal**

Enable these features:
- [x] Subscription cancellation (immediate or at period end)
- [x] Subscription update/upgrade
- [x] Invoice history
- [x] Payment method update
- [ ] Pause subscription (optional)

**Customize branding:**
- Logo: Upload Keystroke Symphony logo
- Primary color: `#F59E0B` (Amber)
- Background color: `#050505` (Obsidian)

### 2. Configure Webhooks

**Developers > Webhooks > Add endpoint**

**Endpoint URL:** `https://your-project.supabase.co/functions/v1/stripe-webhook`

**Events to listen to:**
- `checkout.session.completed` - Subscription created
- `customer.subscription.updated` - Subscription changed (plan upgrade, renewal)
- `customer.subscription.deleted` - Subscription canceled
- `invoice.payment_succeeded` - Successful payment
- `invoice.payment_failed` - Failed payment (retry logic)

**Webhook Signing Secret:**
- After creating webhook, copy `whsec_xxx` secret
- Store in Supabase secrets as `STRIPE_WEBHOOK_SECRET`

---

## Backend Implementation (Supabase Edge Functions)

### Edge Function: `create-checkout-session`

**File:** `supabase/functions/create-checkout-session/index.ts`

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14.10.0?target=deno';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
});

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Invalid user token');
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('stripe_customer_id, tier')
      .eq('id', user.id)
      .single();

    if (profileError) {
      throw new Error('Profile not found');
    }

    // Check if already subscribed
    if (profile.tier === 'PAID') {
      return new Response(
        JSON.stringify({ error: 'Already subscribed' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Parse request body
    const { priceId } = await req.json();
    if (!priceId) {
      throw new Error('Missing priceId in request body');
    }

    // Create or retrieve Stripe customer
    let customerId = profile.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          supabase_user_id: user.id,
        },
      });
      customerId = customer.id;

      // Update profile with customer ID
      await supabase
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id);
    }

    // Create Checkout Session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      client_reference_id: user.id, // Link session to Supabase user
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${req.headers.get('origin')}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.get('origin')}/subscription/canceled`,
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      metadata: {
        supabase_user_id: user.id,
      },
    });

    return new Response(
      JSON.stringify({ url: session.url }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Checkout session error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
```

---

### Edge Function: `stripe-webhook`

**File:** `supabase/functions/stripe-webhook/index.ts`

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14.10.0?target=deno';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
});

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;

serve(async (req) => {
  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    return new Response('Missing signature', { status: 400 });
  }

  try {
    const body = await req.text();
    const event = stripe.webhooks.constructEvent(body, signature, webhookSecret);

    console.log(`Webhook received: ${event.type}`);

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.client_reference_id || session.metadata?.supabase_user_id;

        if (!userId) {
          throw new Error('Missing user ID in session');
        }

        // Retrieve subscription details
        const subscription = await stripe.subscriptions.retrieve(
          session.subscription as string
        );

        // Update user profile
        await supabase
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

        console.log(`User ${userId} upgraded to PAID`);
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        // Find user by customer ID
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .single();

        if (!profile) {
          throw new Error('User not found for customer');
        }

        // Update subscription status
        await supabase
          .from('profiles')
          .update({
            subscription_status: subscription.status,
            subscription_current_period_end: new Date(
              subscription.current_period_end * 1000
            ).toISOString(),
          })
          .eq('id', profile.id);

        console.log(`Subscription updated for user ${profile.id}: ${subscription.status}`);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        // Find user by customer ID
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .single();

        if (!profile) {
          throw new Error('User not found for customer');
        }

        // Downgrade user to FREE tier
        await supabase
          .from('profiles')
          .update({
            tier: 'FREE',
            subscription_status: 'canceled',
            stripe_subscription_id: null,
            daily_limit: 1, // Reset to free tier limit
          })
          .eq('id', profile.id);

        console.log(`User ${profile.id} downgraded to FREE`);
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        console.log(`Payment succeeded for ${invoice.customer}`);
        // Optional: Send receipt email, log transaction
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        console.error(`Payment failed for ${invoice.customer}`);

        // Find user and update status
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('stripe_customer_id', invoice.customer as string)
          .single();

        if (profile) {
          await supabase
            .from('profiles')
            .update({ subscription_status: 'past_due' })
            .eq('id', profile.id);
        }

        // Optional: Send email notification to user
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
```

---

### Edge Function: `create-portal-session`

For users to manage their subscription (cancel, update payment method, view invoices).

**File:** `supabase/functions/create-portal-session/index.ts`

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14.10.0?target=deno';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
});

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Invalid user token');
    }

    // Get user's Stripe customer ID
    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single();

    if (!profile?.stripe_customer_id) {
      throw new Error('No Stripe customer found');
    }

    // Create portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${req.headers.get('origin')}/account`,
    });

    return new Response(
      JSON.stringify({ url: session.url }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Portal session error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
```

---

## Frontend Integration

### 1. Subscribe Button Component

**File:** `src/components/SubscribeButton.tsx`

```typescript
import React, { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

interface Props {
  priceId: string; // e.g., 'price_1Abc123xyz'
}

const SubscribeButton: React.FC<Props> = ({ priceId }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubscribe = async () => {
    setLoading(true);
    setError(null);

    try {
      // Get current session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Please log in to subscribe');
      }

      // Call Edge Function
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-checkout-session`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ priceId }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create checkout session');
      }

      const { url } = await response.json();

      // Redirect to Stripe Checkout
      window.location.href = url;
    } catch (err: any) {
      console.error('Subscribe error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button
        onClick={handleSubscribe}
        disabled={loading}
        className="bg-symphony-amber text-black font-bold py-3 px-6 rounded-lg hover:bg-amber-600 transition-colors disabled:opacity-50"
      >
        {loading ? 'Loading...' : 'Upgrade to Pro - $9.99/month'}
      </button>
      {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
    </div>
  );
};

export default SubscribeButton;
```

### 2. Manage Subscription Button

```typescript
const ManageSubscriptionButton: React.FC = () => {
  const [loading, setLoading] = useState(false);

  const handleManageSubscription = async () => {
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-portal-session`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        }
      );

      const { url } = await response.json();
      window.location.href = url;
    } catch (err) {
      console.error('Portal error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button onClick={handleManageSubscription} disabled={loading}>
      Manage Subscription
    </button>
  );
};
```

### 3. Paywall Modal (Updated)

Replace the mock toggle with real subscription check:

```typescript
// App.tsx or Paywall component
const [userTier, setUserTier] = useState<UserTier>(UserTier.FREE);

useEffect(() => {
  const fetchUserTier = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('tier')
      .eq('id', user.id)
      .single();

    if (profile) {
      setUserTier(profile.tier as UserTier);
    }
  };

  fetchUserTier();

  // Subscribe to profile changes (real-time)
  const subscription = supabase
    .channel('profile-changes')
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'profiles',
        filter: `id=eq.${user?.id}`,
      },
      (payload) => {
        setUserTier(payload.new.tier as UserTier);
      }
    )
    .subscribe();

  return () => {
    subscription.unsubscribe();
  };
}, []);
```

---

## Success/Cancel Pages

### Subscription Success Page

**File:** `src/pages/SubscriptionSuccess.tsx`

```typescript
import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const SubscriptionSuccess: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const sessionId = searchParams.get('session_id');
    if (sessionId) {
      // Optional: Verify session with backend
      console.log('Checkout session completed:', sessionId);
    }

    // Redirect to app after 3 seconds
    setTimeout(() => {
      navigate('/');
    }, 3000);
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen bg-symphony-obsidian text-white flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">Welcome to Keystroke Symphony Pro! 🎹</h1>
        <p className="text-gray-400 mb-6">
          Your subscription is now active. All features are unlocked!
        </p>
        <p className="text-sm text-gray-500">Redirecting you to the app...</p>
      </div>
    </div>
  );
};

export default SubscriptionSuccess;
```

### Subscription Canceled Page

```typescript
const SubscriptionCanceled: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-symphony-obsidian text-white flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">Subscription Canceled</h1>
        <p className="text-gray-400 mb-6">
          No worries! You can upgrade anytime.
        </p>
        <button
          onClick={() => navigate('/')}
          className="bg-symphony-amber text-black px-6 py-3 rounded-lg font-bold"
        >
          Return to App
        </button>
      </div>
    </div>
  );
};
```

---

## Testing

### 1. Test Mode (Stripe Dashboard)

Use test credit cards:
- **Success:** `4242 4242 4242 4242`
- **Decline:** `4000 0000 0000 0002`
- **Requires Authentication (3D Secure):** `4000 0027 6000 3184`

Any future expiry date, any 3-digit CVC, any ZIP code.

### 2. Test Webhook Locally

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Forward webhooks to local Edge Function
stripe listen --forward-to https://your-project.supabase.co/functions/v1/stripe-webhook

# Trigger test events
stripe trigger checkout.session.completed
stripe trigger customer.subscription.deleted
```

### 3. Verify Subscription Flow

**Checklist:**
- [ ] User can click "Upgrade to Pro"
- [ ] Redirected to Stripe Checkout
- [ ] Complete payment with test card
- [ ] Redirected to success page
- [ ] User tier updated to PAID in database
- [ ] Paywall no longer blocks premium features
- [ ] User can access Customer Portal
- [ ] User can cancel subscription
- [ ] User tier downgraded to FREE on cancel

---

## Security Best Practices

1. **Never expose Stripe Secret Key in frontend:**
   - Only in Edge Functions or backend
   - Use environment variables

2. **Always verify webhook signatures:**
   - Prevents spoofed webhook requests
   - Use `stripe.webhooks.constructEvent()`

3. **Validate subscription status server-side:**
   - Don't trust client-side tier checks
   - Verify on every API request requiring paid tier

4. **Use HTTPS everywhere:**
   - Stripe requires HTTPS for webhooks
   - Supabase provides HTTPS by default

5. **Log all payment events:**
   - Track successful/failed payments
   - Monitor for fraud or abuse

---

## Monitoring & Analytics

### Stripe Dashboard Metrics

Track these KPIs:
- Monthly Recurring Revenue (MRR)
- Churn rate (canceled subscriptions)
- Failed payments (dunning)
- Customer Lifetime Value (CLV)

### Custom Analytics (PostHog/Mixpanel)

```typescript
// Track conversion events
analytics.track('subscription_started', {
  priceId: 'price_xxx',
  plan: 'monthly',
  amount: 999,
});

analytics.track('subscription_canceled', {
  reason: 'user_request',
  subscriptionId: 'sub_xxx',
});
```

---

## Troubleshooting

### Issue: Webhook not firing

**Solution:**
- Verify webhook endpoint URL is correct
- Check webhook signing secret matches
- Test with Stripe CLI: `stripe listen`
- Check Supabase Edge Function logs

### Issue: User tier not updating after payment

**Solution:**
- Check webhook handler logs in Supabase
- Verify `client_reference_id` is set correctly in checkout session
- Manually trigger webhook from Stripe Dashboard > Webhooks > Event details > Resend

### Issue: Double subscription created

**Solution:**
- Check for existing customer before creating new Checkout Session
- Use `customer` field instead of creating new customer each time

---

## Future Enhancements

1. **Promo Codes:**
   - Create in Stripe Dashboard
   - Enable `allow_promotion_codes: true` in Checkout Session

2. **Trial Period:**
   - Add `trial_period_days: 7` to price in Stripe Dashboard

3. **Usage-Based Billing:**
   - Track recording exports as metered usage
   - Charge per export beyond a threshold

4. **Team/Multi-Seat Licenses:**
   - Create separate product for teams
   - Implement seat-based pricing

5. **Lifetime Access:**
   - One-time payment product (mode: 'payment' instead of 'subscription')

---

**Stripe Integration Complete! ✅**

This setup handles:
- ✅ Subscription creation via Stripe Checkout
- ✅ Automated tier upgrades/downgrades via webhooks
- ✅ Self-service subscription management via Customer Portal
- ✅ Failed payment handling
- ✅ Security via signature verification
- ✅ Test mode for development

Ready to deploy to production! 💳🎵
