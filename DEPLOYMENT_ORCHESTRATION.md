# Keystroke Symphony - Deployment Orchestration Plan

**Version:** 1.0
**Last Updated:** 2025-11-22
**Orchestrator:** Claude Code (DGF Multi-Agent System)
**Estimated Timeline:** 3-4 days (parallel execution) | 9 days (sequential)

---

## Executive Summary

This document orchestrates the complete deployment of Keystroke Symphony v5 from current state (frontend-only) to production (full-stack SaaS with payments, auth, and error logging).

**Approach:** Multi-agent parallel execution across 4 specialized agents:
- **Agent 1 (BACKEND)**: Supabase setup + Edge Functions
- **Agent 2 (INTEGRATION)**: Stripe integration + webhooks
- **Agent 3 (FRONTEND)**: Replace mocks with real API calls
- **Agent 4 (QA/SECURITY)**: Error logging + testing + deployment

---

## Current State Assessment

### ✅ Complete (95% of frontend)
- React/TypeScript app with Vite build system
- Web Audio engine with professional effects chain
- Gemini AI integration (client-side - **SECURITY RISK**)
- Complete UI/UX (Landing, Typing Interface, Results, Community)
- Recording system with video capture (localStorage only)
- Typing curriculum with 5 challenges (hardcoded)
- Forum (static mock data)
- Paywall UI (easily bypassed, client-side only)

### ❌ Missing (100% of backend)
- User authentication
- Database persistence
- Stripe payments (real integration)
- Error logging/monitoring (Sentry)
- Backend API (Edge Functions)
- Storage for recordings (Supabase Storage)
- Security (API key exposed, no auth, no validation)

---

## Deployment Architecture

### Tech Stack (Serverless)

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | Cloudflare Pages | Static hosting + global CDN |
| **Backend** | Supabase Edge Functions | Serverless API (Deno runtime) |
| **Database** | Supabase PostgreSQL | User data, sessions, forum posts |
| **Auth** | Supabase Auth | Email/password + OAuth |
| **Storage** | Supabase Storage | Recording videos (.webm) |
| **Payments** | Stripe | Subscriptions + webhooks |
| **Monitoring** | Sentry | Error tracking + performance |
| **Analytics** | Cloudflare Analytics | Usage metrics |

**Cost:** $0/month for first 500 users, scales with usage

---

## Agent Task Decomposition

### **AGENT 1: BACKEND (Supabase + Edge Functions)**

**Estimated Time:** 20 hours
**Owner:** CODE agent (backend specialist)
**Priority:** P0 (Critical path)

#### Tasks:

##### 1.1 Supabase Project Setup (2 hours)
- [ ] Create Supabase project at https://supabase.com
- [ ] Configure project settings (region: us-east-1 or closest to target users)
- [ ] Note down `SUPABASE_URL` and `SUPABASE_ANON_KEY`
- [ ] Generate `SUPABASE_SERVICE_ROLE_KEY` (for Edge Functions)

##### 1.2 Database Schema Migration (3 hours)
- [ ] Open Supabase SQL Editor
- [ ] Run schema from `SUPABASE_ARCHITECTURE.md`:
  - [ ] `profiles` table + triggers + RLS
  - [ ] `recordings` table + RLS
  - [ ] `sessions` table + RLS
  - [ ] `forum_posts` table + RLS
  - [ ] `forum_comments` table + RLS
  - [ ] `achievements` table + RLS
  - [ ] Leaderboard views (wpm, accuracy, weekly)
  - [ ] Stored procedures (`handle_new_user`, `update_user_stats_after_session`)
- [ ] Verify all tables created: `SELECT * FROM information_schema.tables WHERE table_schema = 'public';`
- [ ] Test RLS policies with test users

##### 1.3 Supabase Auth Configuration (2 hours)
- [ ] Enable email provider (Dashboard > Authentication > Providers)
- [ ] Configure email templates:
  - [ ] Confirmation email
  - [ ] Password reset
  - [ ] Magic link (optional)
- [ ] Set redirect URLs: `http://localhost:3000/*`, `https://keystroke-symphony.pages.dev/*`
- [ ] (Optional) Enable OAuth providers (Google, GitHub)
- [ ] Test signup/login flows

##### 1.4 Supabase Storage Setup (1 hour)
- [ ] Create bucket: `recordings` (private)
- [ ] Set up RLS policies for storage (see `SUPABASE_ARCHITECTURE.md`)
- [ ] Test file upload/download
- [ ] Configure max file size limit (e.g., 50MB per recording)

##### 1.5 Edge Functions Development (12 hours)

**Create 7 Edge Functions:**

###### 1.5.1 `generate-song` (2 hours)
**Purpose:** Proxy to Gemini API (hide API key)

```typescript
// Input: { theme: string, mode: AppMode }
// Output: SongConfig
```

- [ ] Move Gemini API key to backend
- [ ] Implement rate limiting (max 10 requests/min per user)
- [ ] Add input validation (sanitize theme string)
- [ ] Return structured JSON (validate with Zod or similar)
- [ ] Error handling with fallback config

###### 1.5.2 `analyze-performance` (2 hours)
**Purpose:** Proxy to Gemini API for session analysis

```typescript
// Input: { stats: TypingStats, config: SongConfig }
// Output: AnalysisResult
```

- [ ] Verify user is authenticated
- [ ] Call Gemini API with structured schema
- [ ] Cache results in `sessions` table (`ai_analysis` column)
- [ ] Return analysis + update DB

###### 1.5.3 `recordings` (CRUD) (3 hours)
**Purpose:** Manage user recordings

**Endpoints:**
- `GET /recordings` - List user's recordings
- `POST /recordings` - Create new recording (upload video to Storage)
- `GET /recordings/:id` - Get single recording
- `DELETE /recordings/:id` - Delete recording

```typescript
// POST /recordings
// Input: { title, description, duration, config, events, videoBlob }
// 1. Upload video to Supabase Storage (recordings/{userId}/{recordingId}.webm)
// 2. Insert record into `recordings` table
// 3. Return recording object with signed URL
```

- [ ] Verify user tier (PAID only for recordings feature)
- [ ] Validate input data (Zod schemas)
- [ ] Handle video upload (multipart/form-data)
- [ ] Generate thumbnail (optional: canvas screenshot)
- [ ] Return signed URLs (expiry: 1 hour)

###### 1.5.4 `sessions` (POST) (2 hours)
**Purpose:** Save typing session performance

```typescript
// Input: TypingStats + challengeId + mode
// Output: { sessionId, badges }
```

- [ ] Verify user is authenticated
- [ ] Insert session into `sessions` table
- [ ] Trigger `update_user_stats_after_session` (auto via DB trigger)
- [ ] Check for new badges (e.g., first 100 WPM)
- [ ] Insert achievements if earned
- [ ] Return session ID + earned badges

###### 1.5.5 `forum` (CRUD) (2 hours)
**Purpose:** Forum posts and comments

**Endpoints:**
- `GET /forum/posts` - List posts (paginated)
- `POST /forum/posts` - Create post
- `GET /forum/posts/:id` - Get post + comments
- `POST /forum/posts/:id/comments` - Add comment
- `POST /forum/posts/:id/like` - Like post
- `DELETE /forum/posts/:id` - Delete post (author only)

- [ ] Pagination (limit: 20 posts per page)
- [ ] Tag filtering
- [ ] Sort options (recent, popular, trending)
- [ ] Spam prevention (rate limit: 1 post per minute)

###### 1.5.6 `leaderboards` (GET) (1 hour)
**Purpose:** Fetch leaderboard data

```typescript
// Endpoints:
// GET /leaderboards/wpm
// GET /leaderboards/accuracy
// GET /leaderboards/weekly
```

- [ ] Return top 100 users
- [ ] Include user's rank (even if not in top 100)
- [ ] Cache for 5 minutes (reduce DB load)

##### 1.6 Testing & Deployment (2 hours)
- [ ] Local testing with `supabase functions serve`
- [ ] Deploy to Supabase: `supabase functions deploy <function-name>`
- [ ] Test all endpoints with Postman/curl
- [ ] Set environment variables in Supabase Dashboard (Secrets)
- [ ] Verify CORS headers working correctly

**Deliverables:**
- ✅ Supabase project configured
- ✅ Database schema deployed
- ✅ 7 Edge Functions deployed and tested
- ✅ Documentation: API endpoint reference

---

### **AGENT 2: INTEGRATION (Stripe Payments)**

**Estimated Time:** 10 hours
**Owner:** INTEGRATION agent (payments specialist)
**Priority:** P0 (Critical path)

#### Tasks:

##### 2.1 Stripe Account Setup (1 hour)
- [ ] Create Stripe account at https://stripe.com
- [ ] Complete business verification (for production)
- [ ] Note down API keys (test + live):
  - `STRIPE_PUBLISHABLE_KEY`
  - `STRIPE_SECRET_KEY`
- [ ] Configure webhook endpoint (to be created)

##### 2.2 Create Products & Prices (1 hour)
- [ ] Create product: "Keystroke Symphony Pro"
- [ ] Create price: $9.99/month (recurring)
- [ ] (Optional) Create annual price: $95.99/year (20% discount)
- [ ] Note down `price_id` (e.g., `price_1Abc123xyz`)
- [ ] Test with Stripe test mode

##### 2.3 Edge Function: `create-checkout-session` (3 hours)
- [ ] Implement Checkout Session creation
- [ ] Verify user authentication
- [ ] Create/retrieve Stripe customer
- [ ] Link customer to Supabase user
- [ ] Set success/cancel URLs
- [ ] Return checkout URL
- [ ] Test with test credit card

##### 2.4 Edge Function: `stripe-webhook` (4 hours)
- [ ] Implement webhook signature verification
- [ ] Handle events:
  - [ ] `checkout.session.completed` → Upgrade user to PAID
  - [ ] `customer.subscription.updated` → Update subscription status
  - [ ] `customer.subscription.deleted` → Downgrade to FREE
  - [ ] `invoice.payment_succeeded` → Log successful payment
  - [ ] `invoice.payment_failed` → Mark as past_due, notify user
- [ ] Update `profiles` table on each event
- [ ] Error handling + logging
- [ ] Deploy and configure webhook URL in Stripe Dashboard

##### 2.5 Edge Function: `create-portal-session` (1 hour)
- [ ] Implement Customer Portal session creation
- [ ] Verify user has stripe_customer_id
- [ ] Return portal URL
- [ ] Test cancel/update subscription flows

##### 2.6 Testing & Production Setup (1 hour)
- [ ] Test complete subscription flow (test mode)
- [ ] Verify tier upgrades/downgrades work
- [ ] Test failed payment handling
- [ ] Switch to live mode (production keys)
- [ ] Configure Stripe Customer Portal branding
- [ ] Set up email receipts in Stripe

**Deliverables:**
- ✅ Stripe account configured (test + live)
- ✅ 3 Edge Functions deployed (checkout, webhook, portal)
- ✅ Webhook verified and responding correctly
- ✅ Documentation: Payment flow diagram

---

### **AGENT 3: FRONTEND (API Integration)**

**Estimated Time:** 14 hours
**Owner:** CODE agent (frontend specialist)
**Priority:** P1 (Depends on Agent 1 & 2)

#### Tasks:

##### 3.1 Install Dependencies (1 hour)
```bash
npm install @supabase/supabase-js @stripe/stripe-js
npm install @sentry/react @sentry/vite-plugin
```

##### 3.2 Environment Variables Setup (1 hour)
- [ ] Create `.env.local`:
```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_SENTRY_DSN=https://xxx@sentry.io/xxx (from Agent 4)
```
- [ ] Update `.gitignore` (ensure `.env.local` is ignored)
- [ ] Create `.env.example` template for other developers

##### 3.3 Replace Mock Auth with Supabase Auth (3 hours)
- [ ] Create `src/lib/supabase.ts` client
- [ ] Create auth components:
  - [ ] `SignupForm.tsx`
  - [ ] `LoginForm.tsx`
  - [ ] `ResetPasswordForm.tsx`
  - [ ] `AuthModal.tsx` (unified modal)
- [ ] Update `App.tsx`:
  - [ ] Remove mock `userTier` state
  - [ ] Fetch real user profile from Supabase
  - [ ] Subscribe to auth state changes
  - [ ] Redirect to login if unauthenticated
- [ ] Add protected routes (require auth)
- [ ] Test signup → confirm email → login flow

##### 3.4 Replace localStorage with Supabase API (4 hours)

**Recordings:**
- [ ] Replace `localStorage.getItem('symphony_recordings')` with API call to `GET /recordings`
- [ ] Update save recording flow:
  - [ ] Convert Blob to FormData
  - [ ] POST to `/recordings` endpoint
  - [ ] Show upload progress bar
  - [ ] Handle errors (quota exceeded, network failure)
- [ ] Delete recording: `DELETE /recordings/:id`

**Sessions:**
- [ ] After completing typing session, POST stats to `/sessions`
- [ ] Save `sessionId` for later reference
- [ ] Award badges if returned from API

**Forum:**
- [ ] Replace static `FORUM_POSTS` array with API call
- [ ] Implement CRUD operations (create post, add comment, like)
- [ ] Pagination for post list
- [ ] Real-time updates (optional: use Supabase subscriptions)

##### 3.5 Integrate Stripe Checkout (2 hours)
- [ ] Create `SubscribeButton` component
- [ ] Call `create-checkout-session` endpoint
- [ ] Redirect to Stripe Checkout
- [ ] Create success/cancel pages
- [ ] Add "Manage Subscription" button (calls `create-portal-session`)
- [ ] Update paywall logic to check real tier from DB

##### 3.6 Move Gemini API to Backend (1 hour)
- [ ] Remove `geminiService.ts` client-side API calls
- [ ] Replace with:
  - [ ] `generateSongConfig()` → `POST /generate-song`
  - [ ] `analyzePerformance()` → `POST /analyze-performance`
- [ ] Remove `GEMINI_API_KEY` from `.env.local`
- [ ] Test AI features still work

##### 3.7 Add Loading/Error States (2 hours)
- [ ] Add loading spinners for all async operations
- [ ] Error boundaries for React errors
- [ ] Toast notifications for user-facing errors
- [ ] Retry logic for failed API calls (exponential backoff)
- [ ] Offline detection (show message if no internet)

**Deliverables:**
- ✅ Frontend fully integrated with backend APIs
- ✅ Auth flows working (signup, login, logout)
- ✅ Payments functional (Stripe Checkout)
- ✅ Data persisted to database
- ✅ No mock data remaining

---

### **AGENT 4: QA/SECURITY (Testing + Error Logging + Deployment)**

**Estimated Time:** 12 hours
**Owner:** TESTING + DOCS agents (parallel)
**Priority:** P2 (Can start in parallel with Agent 3)

#### Tasks:

##### 4.1 Sentry Setup (2 hours)
- [ ] Create Sentry project at https://sentry.io
- [ ] Install Sentry SDKs:
```bash
npm install @sentry/react @sentry/vite-plugin
```
- [ ] Configure Sentry in `src/main.tsx`:
```typescript
Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  integrations: [new Sentry.BrowserTracing(), new Sentry.Replay()],
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
});
```
- [ ] Add React Error Boundary
- [ ] Test error capture (throw test error)
- [ ] Configure source maps upload (Vite plugin)

##### 4.2 Backend Error Logging (1 hour)
- [ ] Add Sentry to Edge Functions (Deno SDK)
- [ ] Wrap all API handlers with try/catch
- [ ] Log errors with context (user ID, request data)
- [ ] Test with intentional error

##### 4.3 Security Audit (3 hours)
- [ ] **SQL Injection:** Verify all queries use parameterized inputs
- [ ] **XSS:** Verify React escaping + no `dangerouslySetInnerHTML`
- [ ] **CSRF:** Verify Supabase uses CSRF tokens
- [ ] **API Key Exposure:** Verify Gemini key not in client bundle
- [ ] **Rate Limiting:** Add to Edge Functions (max 60 req/min per user)
- [ ] **Input Validation:** Add Zod schemas to all Edge Functions
- [ ] **RLS Policies:** Test with different user roles (anon, authenticated, owner)
- [ ] **Webhook Signatures:** Verify Stripe webhook signature validation

##### 4.4 End-to-End Testing (4 hours)

**Test Scenarios:**
1. **Auth Flow:**
   - [ ] Signup → Email confirmation → Login
   - [ ] Login → Logout
   - [ ] Password reset

2. **Free User Experience:**
   - [ ] Can access 1 curriculum challenge
   - [ ] Blocked from other challenges (paywall shown)
   - [ ] Cannot save recordings
   - [ ] Cannot access community posts

3. **Paid User Experience:**
   - [ ] Complete Stripe Checkout (test card)
   - [ ] Tier upgraded to PAID
   - [ ] All challenges unlocked
   - [ ] Can save recordings
   - [ ] Can post to forum

4. **Subscription Management:**
   - [ ] Access Customer Portal
   - [ ] Cancel subscription
   - [ ] Verify downgrade to FREE tier
   - [ ] Features locked again

5. **Recording Flow:**
   - [ ] Create recording in Free Play mode
   - [ ] Video captured correctly
   - [ ] Upload to Supabase Storage
   - [ ] Playback recording
   - [ ] Delete recording

6. **Performance Session:**
   - [ ] Complete typing challenge
   - [ ] Stats saved to database
   - [ ] AI analysis generated
   - [ ] Badges awarded
   - [ ] Leaderboard updated

##### 4.5 Performance Testing (2 hours)
- [ ] Lighthouse audit (target: 90+ performance score)
- [ ] Core Web Vitals:
  - [ ] LCP (Largest Contentful Paint) < 2.5s
  - [ ] FID (First Input Delay) < 100ms
  - [ ] CLS (Cumulative Layout Shift) < 0.1
- [ ] Audio latency testing (target: <50ms from keypress to sound)
- [ ] Database query optimization (slow query log)
- [ ] Bundle size analysis (target: <500KB initial load)

##### 4.6 Deployment to Cloudflare Pages (2 hours)
- [ ] Connect GitHub repo to Cloudflare Pages
- [ ] Configure build settings:
  - Build command: `npm run build`
  - Build output: `dist`
  - Environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_SENTRY_DSN`
- [ ] Configure custom domain (optional)
- [ ] Set up preview deployments (per PR)
- [ ] Test production build
- [ ] Verify HTTPS certificate

**Deliverables:**
- ✅ Sentry error tracking active
- ✅ Security audit passed
- ✅ All test scenarios passing
- ✅ Production deployment live
- ✅ Documentation: Testing report

---

## Orchestration Timeline (Parallel Execution)

### Day 1-2: Infrastructure Setup (Agents 1, 2, 4 in parallel)
- **Agent 1:** Supabase setup + Database schema (5 hours)
- **Agent 2:** Stripe setup + Products (2 hours)
- **Agent 4:** Sentry setup (2 hours)

**End of Day 2:** Backend infrastructure ready for integration

### Day 2-3: API Development (Agents 1, 2 continue)
- **Agent 1:** Edge Functions development (12 hours)
- **Agent 2:** Stripe Edge Functions (8 hours)

**End of Day 3:** All backend APIs deployed and tested

### Day 3-4: Frontend Integration (Agent 3 starts)
- **Agent 3:** Replace mocks with real APIs (14 hours)
- **Agent 4 (parallel):** Security audit + testing (7 hours)

**End of Day 4:** Full-stack integration complete, tested, and deployed

---

## Dependency Graph

```
[Agent 1: Supabase Setup] ──┐
                            ├──> [Agent 3: Frontend Integration] ──> [Agent 4: Testing] ──> [Deploy]
[Agent 2: Stripe Setup] ────┘

[Agent 4: Sentry Setup] ────> (Can run in parallel with all agents)
```

**Critical Path:** Agent 1 → Agent 3 → Agent 4 → Deploy

**Parallel Work:** Agents 1, 2, 4 can all work simultaneously on Days 1-2

---

## Risk Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **Stripe webhook delays** | Medium | High | Test with Stripe CLI locally first |
| **Supabase RLS misconfiguration** | Medium | Critical | Thorough testing with different user roles |
| **API rate limits** | Low | Medium | Implement rate limiting + caching |
| **Data migration issues** | Low | Medium | Use transactions, test rollback |
| **CORS errors** | Medium | Medium | Set correct headers in Edge Functions |
| **Audio latency on mobile** | Medium | Medium | Test on real devices, optimize buffer sizes |

---

## Go-Live Checklist

### Pre-Launch
- [ ] All agents complete their tasks
- [ ] End-to-end tests passing
- [ ] Security audit passed
- [ ] Performance metrics met
- [ ] Sentry monitoring active
- [ ] Stripe in live mode (real payments)
- [ ] Backup database created
- [ ] Domain configured with SSL
- [ ] Email templates tested (signup, reset password)
- [ ] Customer support docs prepared

### Launch
- [ ] Deploy to Cloudflare Pages (production)
- [ ] Enable Stripe webhooks (live mode)
- [ ] Monitor Sentry for errors
- [ ] Monitor Stripe Dashboard for payments
- [ ] Monitor Supabase Dashboard for DB load
- [ ] Announce launch (social media, ProductHunt, etc.)

### Post-Launch (Week 1)
- [ ] Daily error monitoring (Sentry)
- [ ] Daily metrics review (conversions, churn)
- [ ] User feedback collection (Typeform or email)
- [ ] Performance optimization (if needed)
- [ ] Bug fixes (prioritize critical)

---

## Success Metrics (KPIs)

### Technical Metrics
- **Uptime:** 99.9% (Cloudflare + Supabase SLA)
- **Error Rate:** < 0.1% (Sentry)
- **API Latency:** P95 < 500ms
- **Page Load Time:** < 3s (LCP)
- **Audio Latency:** < 50ms

### Business Metrics
- **Free → Paid Conversion:** Target 5-10%
- **Monthly Recurring Revenue (MRR):** Track growth
- **Churn Rate:** < 10% monthly
- **Daily Active Users (DAU):** Increase week-over-week
- **Net Promoter Score (NPS):** Target 40+

---

## Post-Deployment Enhancements (Future Roadmap)

### Phase 2 (Month 2-3)
- [ ] Leaderboards with real-time updates
- [ ] Social sharing (auto-generate result images)
- [ ] Weekly challenges with prizes
- [ ] Email notifications (new comments, badges earned)
- [ ] Advanced analytics dashboard

### Phase 3 (Month 4-6)
- [ ] Mobile app (React Native)
- [ ] Offline mode (service workers)
- [ ] Multiplayer typing races (WebSockets)
- [ ] API for third-party integrations
- [ ] White-label version for schools

---

## Agent Launch Commands

### Start Orchestration

```bash
# From DGF Orchestrator
~/bin/agents/orchestrate --plan "Deploy Keystroke Symphony v5 to production"

# Or spawn agents individually:
~/bin/agents/spawn-agent BackendAgent backend "Supabase setup + Edge Functions"
~/bin/agents/spawn-agent StripeAgent integration "Stripe payment integration"
~/bin/agents/spawn-agent FrontendAgent code "Frontend API integration"
~/bin/agents/spawn-agent QAAgent testing "Security + testing + deployment"
```

### Monitor Progress

```bash
~/bin/agents/orchestrate-dashboard --live
~/bin/agents/list-agents
~/bin/agents/agent-status BackendAgent
```

---

## Conclusion

This orchestration plan breaks down the complete deployment into **4 parallel workstreams** that can be executed simultaneously, reducing total time from **9 days (sequential)** to **3-4 days (parallel)**.

**Next Step:** Launch agents and begin execution. Each agent will work autonomously on their assigned tasks, reporting progress to the Orchestrator.

**Ready to deploy?** 🚀🎵

---

**END OF ORCHESTRATION PLAN**
