# Agent 3: Frontend Integration Checklist

**Purpose:** Track all integration tasks for replacing mock data with real backend APIs

---

## Phase 1: Environment Setup (1 hour)

### Prerequisites from Agent 1:
- [ ] `SUPABASE_URL` provided
- [ ] `SUPABASE_ANON_KEY` provided
- [ ] Edge Functions deployed and URLs documented

### Prerequisites from Agent 2:
- [ ] `STRIPE_PUBLISHABLE_KEY` provided (test mode)
- [ ] Stripe Edge Function URLs documented

### Prerequisites from Agent 4:
- [ ] `SENTRY_DSN` provided

### Tasks:
- [ ] Create `.env.local` with all credentials
- [ ] Create `.env.example` template (no secrets)
- [ ] Install dependencies:
  ```bash
  npm install @supabase/supabase-js
  npm install @stripe/stripe-js
  npm install @sentry/react @sentry/vite-plugin
  npm install react-hot-toast
  ```
- [ ] Verify `.gitignore` includes `.env.local`
- [ ] Test build with new dependencies

---

## Phase 2: Supabase Client Setup (1 hour)

### Tasks:
- [ ] Create `src/lib/supabase.ts`:
  - [ ] Initialize Supabase client
  - [ ] Export singleton instance
  - [ ] Add TypeScript types for database schema

- [ ] Create `src/lib/auth.ts`:
  - [ ] `getCurrentUser()` - Get current auth user
  - [ ] `getProfile()` - Fetch user profile from DB
  - [ ] `signUp(email, password, username)` - Register new user
  - [ ] `signIn(email, password)` - Login
  - [ ] `signOut()` - Logout
  - [ ] `resetPassword(email)` - Send reset email
  - [ ] `updateProfile(data)` - Update user profile

- [ ] Create `src/types/database.ts`:
  - [ ] `Profile` interface (matches DB schema)
  - [ ] `Recording` interface (matches DB schema)
  - [ ] `Session` interface (matches DB schema)
  - [ ] `ForumPost` interface (matches DB schema)
  - [ ] `ForumComment` interface (matches DB schema)

- [ ] Test connection:
  - [ ] Can connect to Supabase
  - [ ] Can fetch from `profiles` table
  - [ ] Auth state changes detected

---

## Phase 3: Authentication Integration (3 hours)

### Component Creation:
- [ ] Create `src/components/Auth/SignupForm.tsx`:
  - [ ] Email input
  - [ ] Password input (with strength indicator)
  - [ ] Username input
  - [ ] Submit button
  - [ ] Link to login
  - [ ] Error handling
  - [ ] Loading state

- [ ] Create `src/components/Auth/LoginForm.tsx`:
  - [ ] Email input
  - [ ] Password input
  - [ ] Submit button
  - [ ] "Forgot password" link
  - [ ] Link to signup
  - [ ] Error handling
  - [ ] Loading state

- [ ] Create `src/components/Auth/ResetPasswordForm.tsx`:
  - [ ] Email input
  - [ ] Submit button
  - [ ] Success message
  - [ ] Back to login link

- [ ] Create `src/components/Auth/AuthModal.tsx`:
  - [ ] Unified modal for signup/login/reset
  - [ ] Tab switching
  - [ ] Close button
  - [ ] Backdrop click to close

- [ ] Create `src/components/Auth/ProtectedRoute.tsx`:
  - [ ] Check if user is authenticated
  - [ ] Redirect to login if not
  - [ ] Show loading spinner during check

### App.tsx Updates:
- [ ] Remove mock `userTier` state (line 17)
- [ ] Remove `onToggleSubscription` prop (line 69)
- [ ] Add auth state:
  ```typescript
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  ```
- [ ] Add `useEffect` to subscribe to auth changes:
  ```typescript
  useEffect(() => {
    supabase.auth.onAuthStateChange(async (event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        const profile = await getProfile(session.user.id);
        setProfile(profile);
      }
      setAuthLoading(false);
    });
  }, []);
  ```
- [ ] Pass real `userTier` from profile to Landing
- [ ] Show AuthModal when user not authenticated
- [ ] Handle loading state

### Testing:
- [ ] Signup creates user in Supabase Auth
- [ ] Signup creates profile in `profiles` table
- [ ] Signup sends confirmation email
- [ ] Login with correct credentials works
- [ ] Login with incorrect credentials fails
- [ ] Logout clears auth state
- [ ] Password reset sends email
- [ ] Auth state persists on page refresh
- [ ] Protected routes redirect to login

---

## Phase 4: API Integration (4 hours)

### 4.1 Recordings API (2 hours)

#### Create `src/lib/api/recordings.ts`:
- [ ] `fetchRecordings()` - GET /recordings
- [ ] `createRecording(data, videoFile)` - POST /recordings (multipart)
- [ ] `getRecording(id)` - GET /recordings/:id
- [ ] `deleteRecording(id)` - DELETE /recordings/:id

#### Update `components/Landing.tsx`:
- [ ] Replace lines 27-36 (localStorage) with API call:
  ```typescript
  useEffect(() => {
    const loadRecordings = async () => {
      try {
        const data = await fetchRecordings();
        setRecordings(data);
      } catch (error) {
        toast.error('Failed to load recordings');
      }
    };
    loadRecordings();
  }, []);
  ```

- [ ] Replace line 82-86 (localStorage delete) with API call:
  ```typescript
  const handleDeleteRecording = async (id: string) => {
    try {
      await deleteRecording(id);
      setRecordings(prev => prev.filter(r => r.id !== id));
      toast.success('Recording deleted');
    } catch (error) {
      toast.error('Failed to delete recording');
    }
  };
  ```

- [ ] Add upload progress indicator
- [ ] Handle errors (quota exceeded, network failure)

#### Update `components/TypingInterface.tsx`:
- [ ] Add save recording logic:
  ```typescript
  const handleSaveRecording = async (title, description) => {
    try {
      const videoBlob = /* capture from MediaRecorder */;
      await createRecording({
        title,
        description,
        duration,
        config,
        events,
      }, videoBlob);
      toast.success('Recording saved!');
    } catch (error) {
      toast.error('Failed to save recording');
    }
  };
  ```

#### Testing:
- [ ] Recordings load on Landing mount
- [ ] Create recording uploads video to Storage
- [ ] Create recording inserts record in DB
- [ ] Upload progress shows correctly
- [ ] Delete removes from DB and Storage
- [ ] Error handling works (network failure, quota)

---

### 4.2 Sessions API (1 hour)

#### Create `src/lib/api/sessions.ts`:
- [ ] `createSession(stats, challengeId, mode)` - POST /sessions

#### Update `components/Results.tsx`:
- [ ] Add session save logic:
  ```typescript
  useEffect(() => {
    const saveSession = async () => {
      try {
        const result = await createSession(stats, config.theme, mode);
        if (result.badges?.length > 0) {
          setBadges(result.badges);
          toast.success(`Earned ${result.badges.length} badge(s)!`);
        }
      } catch (error) {
        console.error('Failed to save session', error);
      }
    };
    saveSession();
  }, []);
  ```

- [ ] Display earned badges
- [ ] Show session ID (optional)

#### Testing:
- [ ] Session saved to database after challenge
- [ ] Stats correct in database
- [ ] Profile stats updated (best_wpm, total_sessions)
- [ ] Badges returned if earned
- [ ] Badges displayed in UI

---

### 4.3 Forum API (1 hour)

#### Create `src/lib/api/forum.ts`:
- [ ] `fetchPosts(page, limit)` - GET /forum/posts
- [ ] `createPost(title, content, tags)` - POST /forum/posts
- [ ] `getPost(id)` - GET /forum/posts/:id
- [ ] `createComment(postId, content)` - POST /forum/posts/:id/comments
- [ ] `likePost(postId)` - POST /forum/posts/:id/like
- [ ] `deletePost(postId)` - DELETE /forum/posts/:id

#### Update `components/Community.tsx`:
- [ ] Remove hardcoded `FORUM_POSTS` array
- [ ] Add state:
  ```typescript
  const [posts, setPosts] = useState([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  ```

- [ ] Fetch posts on mount:
  ```typescript
  useEffect(() => {
    const loadPosts = async () => {
      setLoading(true);
      try {
        const data = await fetchPosts(page, 20);
        setPosts(data);
      } catch (error) {
        toast.error('Failed to load posts');
      } finally {
        setLoading(false);
      }
    };
    loadPosts();
  }, [page]);
  ```

- [ ] Add create post form
- [ ] Add comment form
- [ ] Add like button
- [ ] Add pagination controls

#### Testing:
- [ ] Posts load and display correctly
- [ ] Pagination works
- [ ] Create post adds to database
- [ ] Create comment adds to database
- [ ] Like increments count
- [ ] Only author can delete post

---

### 4.4 Gemini API Migration (1 hour)

#### Create `src/lib/api/ai.ts`:
- [ ] `generateSong(theme, mode)` - POST /generate-song
- [ ] `analyzePerformance(stats, config)` - POST /analyze-performance

#### Update `App.tsx`:
- [ ] Replace line 1-2:
  ```typescript
  // OLD:
  import { generateSongConfig } from './services/geminiService';

  // NEW:
  import { generateSong } from './lib/api/ai';
  ```

- [ ] Replace line 41:
  ```typescript
  // OLD:
  const songConfig = await generateSongConfig(theme, selectedMode);

  // NEW:
  const songConfig = await generateSong(theme, selectedMode);
  ```

#### Update `components/Results.tsx`:
- [ ] Replace AI analysis call:
  ```typescript
  // OLD:
  import { analyzePerformance } from '../services/geminiService';
  const analysis = await analyzePerformance(stats, config);

  // NEW:
  import { analyzePerformance } from '../lib/api/ai';
  const analysis = await analyzePerformance(stats, config);
  ```

#### Delete Old Files:
- [ ] Delete `services/geminiService.ts`

#### Update `.env.local`:
- [ ] Remove `GEMINI_API_KEY` (now backend only)

#### Testing:
- [ ] Song generation works via backend
- [ ] Performance analysis works via backend
- [ ] No Gemini API key in frontend bundle (verify with build)
- [ ] Fallback config returned on error

---

## Phase 5: Stripe Checkout Integration (2 hours)

### Component Creation:
- [ ] Create `src/components/Subscription/SubscribeButton.tsx`:
  - [ ] Click handler calls `create-checkout-session`
  - [ ] Redirects to Stripe Checkout
  - [ ] Loading state during redirect
  - [ ] Error handling

- [ ] Create `src/pages/SubscriptionSuccess.tsx`:
  - [ ] Thank you message
  - [ ] Confirmation details
  - [ ] Redirect to Landing after 5 seconds
  - [ ] Button to go to Landing immediately

- [ ] Create `src/pages/SubscriptionCanceled.tsx`:
  - [ ] Cancellation message
  - [ ] Encourage to try again
  - [ ] Button to return to Landing

### Create `src/lib/api/stripe.ts`:
- [ ] `createCheckoutSession()` - POST /create-checkout-session
- [ ] `createPortalSession()` - POST /create-portal-session

### Update `components/Landing.tsx`:
- [ ] Remove mock toggle button (lines 111-116)
- [ ] Add `<SubscribeButton />` component
- [ ] Add "Manage Subscription" button (if user.tier === PAID)
- [ ] Update paywall logic:
  ```typescript
  // OLD:
  const isFree = userTier === UserTier.FREE;

  // NEW (trust server-side tier):
  const isFree = profile?.tier === 'FREE';
  ```

### Router Setup (if needed):
- [ ] Add React Router (if not already installed)
- [ ] Add routes for success/cancel pages
- [ ] Update `index.tsx` with Router

### Testing:
- [ ] Subscribe button redirects to Stripe Checkout
- [ ] Test card (4242 4242 4242 4242) completes payment
- [ ] Webhook updates user tier to PAID
- [ ] Success page displays after payment
- [ ] Canceled page displays if checkout canceled
- [ ] Manage Subscription button opens Customer Portal
- [ ] Cancel subscription downgrades tier to FREE
- [ ] Features locked/unlocked based on tier

---

## Phase 6: Error Handling & UX (2 hours)

### Install Toast Notifications:
- [ ] Install `react-hot-toast`:
  ```bash
  npm install react-hot-toast
  ```

- [ ] Add `<Toaster />` to `App.tsx`:
  ```typescript
  import { Toaster } from 'react-hot-toast';

  // In JSX:
  <Toaster position="top-right" />
  ```

### Create Error Boundary:
- [ ] Create `src/components/ErrorBoundary.tsx`:
  - [ ] Catch React errors
  - [ ] Display friendly error UI
  - [ ] Log to Sentry (from Agent 4)
  - [ ] Reload button

- [ ] Wrap `<App />` in ErrorBoundary (in `index.tsx`)

### Add Loading States:
- [ ] `App.tsx` - Loading during auth check
- [ ] `Landing.tsx` - Loading during recordings fetch
- [ ] `Community.tsx` - Loading during posts fetch
- [ ] All forms - Loading during submit
- [ ] All API calls - Loading indicators

### Add Error Handling:
- [ ] Wrap all API calls in try/catch
- [ ] Display toast on error
- [ ] Log errors to Sentry
- [ ] Graceful degradation (show cached data if available)

### Add Retry Logic:
- [ ] Create `src/lib/api/client.ts`:
  - [ ] Base fetch wrapper
  - [ ] Exponential backoff retry (max 3 attempts)
  - [ ] Timeout handling (10 seconds)
  - [ ] Network error detection

### Add Offline Detection:
- [ ] Create `src/hooks/useOnlineStatus.ts`:
  - [ ] Listen to `online`/`offline` events
  - [ ] Return boolean `isOnline`

- [ ] Add offline banner:
  ```typescript
  const isOnline = useOnlineStatus();

  {!isOnline && (
    <div className="bg-red-500 text-white p-2 text-center">
      You are offline. Some features may not work.
    </div>
  )}
  ```

### Testing:
- [ ] Loading spinners display during async operations
- [ ] Toast notifications show on errors
- [ ] Retry logic triggers on network failure
- [ ] Error boundary catches React errors
- [ ] Offline banner displays when offline
- [ ] No unhandled promise rejections in console
- [ ] No 404 errors for missing endpoints

---

## Phase 7: Documentation & Cleanup (1 hour)

### Create Documentation:
- [ ] Create `FRONTEND_INTEGRATION_GUIDE.md`:
  - [ ] Overview of changes
  - [ ] Environment variables required
  - [ ] New dependencies added
  - [ ] Files created
  - [ ] Files modified
  - [ ] Files deleted
  - [ ] Migration notes (localStorage → DB)
  - [ ] Testing instructions
  - [ ] Known issues
  - [ ] Future enhancements

### Code Cleanup:
- [ ] Remove all console.log statements (or use proper logger)
- [ ] Remove unused imports
- [ ] Remove commented-out code
- [ ] Ensure consistent code style
- [ ] Add JSDoc comments to public functions
- [ ] Verify no hardcoded credentials

### Build Testing:
- [ ] Run `npm run build`
- [ ] Verify no build errors
- [ ] Check bundle size (target: <500KB)
- [ ] Verify environment variables replaced correctly
- [ ] Test production build locally (`npm run preview`)

### Final Checklist:
- [ ] All mock data replaced
- [ ] All localStorage removed
- [ ] No Gemini API key in frontend
- [ ] All API calls use backend endpoints
- [ ] Auth flows work end-to-end
- [ ] Payments work end-to-end
- [ ] Error handling in place
- [ ] Loading states in place
- [ ] No console errors
- [ ] Documentation complete

---

## Handoff to Agent 4

### Deliverables:
- [ ] `FRONTEND_INTEGRATION_GUIDE.md` - Complete documentation
- [ ] Updated codebase with all changes
- [ ] `.env.example` template
- [ ] Test results summary
- [ ] List of known issues (if any)

### Information for Agent 4:
- [ ] All API endpoints documented
- [ ] All environment variables documented
- [ ] Test scenarios to verify
- [ ] Any remaining bugs/issues
- [ ] Performance optimization opportunities

---

## Progress Tracking

**Phase 1:** ⬜ Not Started (blocked - awaiting credentials)
**Phase 2:** ⬜ Not Started (blocked - awaiting Supabase)
**Phase 3:** ⬜ Not Started (blocked - awaiting Supabase)
**Phase 4:** ⬜ Not Started (blocked - awaiting Edge Functions)
**Phase 5:** ⬜ Not Started (blocked - awaiting Stripe)
**Phase 6:** ⬜ Not Started (can prepare, but cannot test)
**Phase 7:** ⬜ Not Started

**Overall Progress:** 0% (blocked by Agent 1 & 2)

---

**Last Updated:** 2025-11-22
**Agent:** FRONTEND_INTEGRATION (Agent 3)
**Status:** READY TO START (once dependencies met)
