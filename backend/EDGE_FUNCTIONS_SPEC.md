# Edge Functions Specification - Keystroke Symphony v5

**Version:** 1.0
**Last Updated:** 2025-11-22
**Runtime:** Deno (Supabase Edge Functions)
**Language:** TypeScript

---

## Overview

This document specifies all 7 Edge Functions for Keystroke Symphony, including:
- Input/output interfaces
- Authentication requirements
- Rate limiting rules
- Error handling
- Implementation notes

All Edge Functions are deployed as Supabase Edge Functions and run on Deno runtime.

---

## Common Patterns

### Authentication

Most endpoints require authentication via JWT token:

```typescript
// Get user from JWT
const authHeader = req.headers.get('Authorization');
if (!authHeader) {
  return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' }
  });
}

const token = authHeader.replace('Bearer ', '');
const { data: { user }, error } = await supabaseClient.auth.getUser(token);

if (error || !user) {
  return new Response(JSON.stringify({ error: 'Invalid token' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' }
  });
}
```

### Rate Limiting

Implement simple in-memory rate limiting (for production, use Redis):

```typescript
const rateLimits = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const userLimit = rateLimits.get(userId);

  if (!userLimit || now > userLimit.resetAt) {
    rateLimits.set(userId, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (userLimit.count >= maxRequests) {
    return false;
  }

  userLimit.count++;
  return true;
}
```

### CORS Headers

All responses should include CORS headers:

```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
```

### Error Responses

Standardized error format:

```typescript
interface ErrorResponse {
  error: string;
  message?: string;
  code?: string;
}
```

---

## Function 1: `generate-song`

### Purpose
Proxy to Gemini API for song configuration generation. Hides API key from client.

### Authentication
**Public** (no JWT required)

### Endpoint
```
POST /functions/v1/generate-song
```

### Input Schema

```typescript
interface GenerateSongRequest {
  theme: string;      // User-provided theme (e.g., "sunset over mountains")
  mode: AppMode;      // "CURRICULUM" | "FREE_PLAY" | "PLAYBACK"
}

type AppMode = "CURRICULUM" | "FREE_PLAY" | "PLAYBACK";
```

### Output Schema

```typescript
interface SongConfig {
  theme: string;
  text: string;               // Generated typing text
  mood: string;               // "serene" | "energetic" | "melancholic" | "playful"
  tempo: number;              // BPM (40-120)
  soundProfile: string;       // "warm-dreamy" | "bright-energetic" | "dark-mysterious"
  scale: string;              // "C-major-pentatonic" | "A-minor" | etc.
  musicalStyle: string;       // "ambient" | "jazz" | "classical" | "electronic"
}
```

### Rate Limiting
- **10 requests per minute** per IP address
- **60 requests per hour** per IP address

### Error Handling

| Status | Error | Cause |
|--------|-------|-------|
| 400 | `Invalid request body` | Missing or invalid `theme` or `mode` |
| 429 | `Rate limit exceeded` | Too many requests |
| 500 | `AI service unavailable` | Gemini API error |
| 500 | `Failed to generate song` | Parsing error or invalid response |

### Implementation Notes

1. **Input Validation:**
   - `theme` must be 1-200 characters
   - Sanitize input (remove special characters, SQL injection attempts)

2. **Gemini API Call:**
   - Use structured output schema
   - Include fallback if API fails (default song config)

3. **Caching (Optional):**
   - Cache common themes for 24 hours to reduce API costs

4. **Fallback Config:**
```typescript
const FALLBACK_CONFIG: SongConfig = {
  theme: "tranquil waters",
  text: "gentle waves flow beneath the moonlight",
  mood: "serene",
  tempo: 60,
  soundProfile: "warm-dreamy",
  scale: "C-major-pentatonic",
  musicalStyle: "ambient"
};
```

---

## Function 2: `analyze-performance`

### Purpose
Proxy to Gemini API for AI-powered typing performance analysis.

### Authentication
**Required** (JWT token)

### Endpoint
```
POST /functions/v1/analyze-performance
```

### Input Schema

```typescript
interface AnalyzePerformanceRequest {
  stats: TypingStats;
  config: SongConfig;
}

interface TypingStats {
  wpm: number;
  accuracy: number;          // Percentage (0-100)
  duration: number;          // Milliseconds
  mistakes: number;
  totalChars: number;
  combo: number;
  maxCombo: number;
  rhythmHistory?: Array<{ time: number; wpm: number }>;
}
```

### Output Schema

```typescript
interface AnalysisResult {
  title: string;             // e.g., "Steady Rhythm Master"
  critique: string;          // Multi-sentence feedback (100-300 words)
  score: number;             // 1-100
  strengths: string[];       // Array of positive observations
  improvements: string[];    // Array of suggestions
}
```

### Rate Limiting
- **5 requests per minute** per user
- **30 requests per hour** per user

### Error Handling

| Status | Error | Cause |
|--------|-------|-------|
| 401 | `Unauthorized` | Missing or invalid JWT |
| 400 | `Invalid stats data` | Missing required fields |
| 429 | `Rate limit exceeded` | Too many requests |
| 500 | `AI service unavailable` | Gemini API error |

### Implementation Notes

1. **Store Analysis in DB:**
   - After generating, update the `sessions` table with `ai_analysis` JSONB

2. **Check for Existing Analysis:**
   - If session already has analysis, return cached version (no new API call)

3. **Gemini Prompt Engineering:**
   - Include context: WPM percentile, accuracy tier, combo analysis
   - Request constructive feedback (not just criticism)

---

## Function 3: `recordings` (CRUD)

### Purpose
Manage user recordings (create, read, update, delete).

### Authentication
**Required** (JWT token)

### Endpoints

#### 3.1 List Recordings
```
GET /functions/v1/recordings
```

**Query Parameters:**
- `page` (optional, default: 1)
- `limit` (optional, default: 20, max: 100)

**Response:**
```typescript
interface RecordingsListResponse {
  recordings: Recording[];
  total: number;
  page: number;
  limit: number;
}

interface Recording {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  duration: number;
  isPublic: boolean;
  config: SongConfig;
  events: NoteEvent[];
  videoUrl: string | null;
  videoSizeBytes: number | null;
  wpm: number | null;
  accuracy: number | null;
  views: number;
  likes: number;
  createdAt: string;
  updatedAt: string;
}

interface NoteEvent {
  char: string;
  time: number;
  duration: number;
}
```

#### 3.2 Get Single Recording
```
GET /functions/v1/recordings/:id
```

**Response:** `Recording` object or 404

#### 3.3 Create Recording
```
POST /functions/v1/recordings
```

**Request Body:**
```typescript
interface CreateRecordingRequest {
  title: string;
  description?: string;
  duration: number;
  config: SongConfig;
  events: NoteEvent[];
  wpm?: number;
  accuracy?: number;
  videoBlob?: Blob;          // Optional video file
}
```

**Response:**
```typescript
interface CreateRecordingResponse {
  recording: Recording;
  uploadUrl?: string;        // Signed URL for video upload (if videoBlob provided)
}
```

**Implementation Notes:**
1. Check user tier - recording feature requires **PAID** tier
2. Upload video to Supabase Storage: `recordings/{userId}/{recordingId}.webm`
3. Generate thumbnail (optional): Use canvas snapshot from first frame
4. Return signed URL with 1-hour expiry

#### 3.4 Update Recording
```
PATCH /functions/v1/recordings/:id
```

**Request Body:**
```typescript
interface UpdateRecordingRequest {
  title?: string;
  description?: string;
  isPublic?: boolean;
}
```

#### 3.5 Delete Recording
```
DELETE /functions/v1/recordings/:id
```

**Response:** `{ success: true }`

**Implementation Notes:**
- Also delete video file from Storage
- Verify user owns the recording (RLS handles this, but double-check)

### Rate Limiting
- **10 uploads per hour** per user
- **100 reads per minute** per user

### Error Handling

| Status | Error | Cause |
|--------|-------|-------|
| 401 | `Unauthorized` | Missing or invalid JWT |
| 403 | `Tier upgrade required` | Free user attempting to create recording |
| 404 | `Recording not found` | Invalid ID or not owned by user |
| 413 | `File too large` | Video exceeds 50MB limit |
| 429 | `Rate limit exceeded` | Too many uploads |
| 500 | `Upload failed` | Storage error |

---

## Function 4: `sessions` (POST)

### Purpose
Save typing session performance data and award badges.

### Authentication
**Required** (JWT token)

### Endpoint
```
POST /functions/v1/sessions
```

### Input Schema

```typescript
interface CreateSessionRequest {
  challengeId: string | null;  // e.g., 'teach_01' or null for free play
  mode: AppMode;
  theme: string | null;
  wpm: number;
  accuracy: number;
  duration: number;
  mistakes: number;
  totalChars: number;
  combo: number;
  maxCombo: number;
  rhythmHistory?: Array<{ time: number; wpm: number }>;
}
```

### Output Schema

```typescript
interface CreateSessionResponse {
  sessionId: string;
  badges: Badge[];           // Newly earned badges
  profileUpdated: {
    bestWpm: number;
    bestAccuracy: number;
    totalSessions: number;
  };
}

interface Badge {
  badgeType: string;
  earnedAt: string;
  badgeData: any;
}
```

### Badge Award Logic

```typescript
const BADGE_CRITERIA = {
  'First Steps': { condition: 'totalSessions === 1' },
  'Speed Demon': { condition: 'wpm >= 100' },
  'Hypersonic': { condition: 'wpm >= 120' },
  'Perfect Flow': { condition: 'accuracy === 100 && totalChars >= 50' },
  'Marathon Runner': { condition: 'duration >= 300000' }, // 5 minutes
  'Combo Master': { condition: 'maxCombo >= 50' },
  'Daily Grinder': { condition: 'sessionsToday >= 10' },
};
```

### Rate Limiting
- **No rate limit** (users should be able to save unlimited sessions)
- But check daily session limit for FREE tier (1 per day)

### Error Handling

| Status | Error | Cause |
|--------|-------|-------|
| 401 | `Unauthorized` | Missing or invalid JWT |
| 403 | `Daily limit reached` | Free user exceeded 1 session/day |
| 400 | `Invalid session data` | Missing required fields |
| 500 | `Failed to save session` | Database error |

### Implementation Notes

1. **Check Daily Limit (Free Users):**
   - Call `reset_daily_sessions_if_needed(userId)` first
   - If `daily_sessions_used >= daily_limit`, return 403

2. **Increment Daily Counter:**
   - After inserting session, increment `daily_sessions_used`

3. **Award Badges:**
   - Check all badge criteria after session insert
   - Insert new badges into `achievements` table (unique constraint prevents duplicates)

4. **Trigger Auto-Updates:**
   - Database trigger `update_user_stats_after_session` handles profile updates

---

## Function 5: `forum` (CRUD)

### Purpose
Community forum for posts and comments.

### Authentication
**Required** (JWT token)

### Endpoints

#### 5.1 List Posts
```
GET /functions/v1/forum/posts
```

**Query Parameters:**
- `page` (optional, default: 1)
- `limit` (optional, default: 20, max: 100)
- `tag` (optional, filter by tag)
- `sort` (optional: "recent" | "popular" | "trending", default: "recent")

**Response:**
```typescript
interface ForumPostsResponse {
  posts: ForumPost[];
  total: number;
  page: number;
  limit: number;
}

interface ForumPost {
  id: string;
  authorId: string;
  authorUsername: string;
  authorDisplayName: string;
  authorAvatar: string | null;
  authorTier: string;
  title: string;
  content: string;
  tags: string[];
  isPinned: boolean;
  isLocked: boolean;
  likes: number;
  views: number;
  commentCount: number;
  createdAt: string;
  updatedAt: string;
}
```

#### 5.2 Get Single Post (with Comments)
```
GET /functions/v1/forum/posts/:id
```

**Response:**
```typescript
interface ForumPostDetailResponse {
  post: ForumPost;
  comments: ForumComment[];
}

interface ForumComment {
  id: string;
  postId: string;
  authorId: string;
  authorUsername: string;
  authorDisplayName: string;
  authorAvatar: string | null;
  content: string;
  likes: number;
  createdAt: string;
  updatedAt: string;
}
```

**Side Effect:** Increment `views` count

#### 5.3 Create Post
```
POST /functions/v1/forum/posts
```

**Request:**
```typescript
interface CreatePostRequest {
  title: string;             // 5-200 characters
  content: string;           // 10-5000 characters
  tags?: string[];           // Max 5 tags
}
```

**Response:** `ForumPost` object

#### 5.4 Update Post
```
PATCH /functions/v1/forum/posts/:id
```

**Request:**
```typescript
interface UpdatePostRequest {
  title?: string;
  content?: string;
  tags?: string[];
}
```

#### 5.5 Delete Post
```
DELETE /functions/v1/forum/posts/:id
```

#### 5.6 Create Comment
```
POST /functions/v1/forum/posts/:id/comments
```

**Request:**
```typescript
interface CreateCommentRequest {
  content: string;           // 1-2000 characters
}
```

**Response:** `ForumComment` object

#### 5.7 Like Post
```
POST /functions/v1/forum/posts/:id/like
```

**Response:**
```typescript
{ likes: number }
```

**Implementation Notes:**
- Increment `likes` count (use atomic operation)
- Consider tracking user likes in separate table to prevent double-liking (future enhancement)

### Rate Limiting
- **1 post per minute** per user
- **10 comments per minute** per user
- **100 reads per minute** per user

### Error Handling

| Status | Error | Cause |
|--------|-------|-------|
| 401 | `Unauthorized` | Missing or invalid JWT |
| 403 | `Post is locked` | Trying to comment on locked post |
| 404 | `Post not found` | Invalid post ID |
| 429 | `Rate limit exceeded` | Too many posts/comments |
| 400 | `Invalid input` | Title/content too short/long |

---

## Function 6: `leaderboards` (GET)

### Purpose
Fetch leaderboard data (WPM, Accuracy, Weekly).

### Authentication
**Optional** (if authenticated, include user's rank even if not in top 100)

### Endpoints

#### 6.1 WPM Leaderboard
```
GET /functions/v1/leaderboards/wpm
```

#### 6.2 Accuracy Leaderboard
```
GET /functions/v1/leaderboards/accuracy
```

#### 6.3 Weekly Leaderboard
```
GET /functions/v1/leaderboards/weekly
```

### Output Schema

```typescript
interface LeaderboardResponse {
  leaderboard: LeaderboardEntry[];
  userRank?: LeaderboardEntry;  // If authenticated and user has sessions
}

interface LeaderboardEntry {
  rank: number;
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  tier: string;
  bestWpm?: number;
  avgAccuracy?: number;
  totalSessions: number;
  lastSessionAt?: string;
}
```

### Rate Limiting
- **60 requests per minute** per user/IP
- Cache for 5 minutes (reduce DB load)

### Error Handling

| Status | Error | Cause |
|--------|-------|-------|
| 500 | `Failed to fetch leaderboard` | Database error |

### Implementation Notes

1. **Use Database Views:**
   - Query `leaderboard_wpm`, `leaderboard_accuracy`, `leaderboard_weekly` views
   - Views already compute rankings and limit to top 100

2. **User Rank (if authenticated):**
   - If user is in top 100, they'll appear in the leaderboard
   - If not, run a separate query to find their rank:

   ```sql
   SELECT
     ROW_NUMBER() OVER (ORDER BY best_wpm DESC) as rank,
     *
   FROM (
     SELECT user_id, MAX(wpm) as best_wpm
     FROM sessions
     WHERE user_id = $1
   )
   ```

3. **Caching:**
   - Use in-memory cache with 5-minute TTL
   - Invalidate cache on new high scores (optional optimization)

---

## Function 7: Stripe Integration Functions

These functions handle Stripe payment flows. See **STRIPE_INTEGRATION.md** for detailed implementation (coordinated with Agent 2).

### 7.1 `stripe-checkout` (POST)
Create Checkout Session for subscription purchase.

### 7.2 `stripe-webhook` (POST)
Handle Stripe webhook events (payment success, subscription updates, etc.).

### 7.3 `stripe-portal` (POST)
Create Customer Portal session for subscription management.

**Note:** These functions are specified separately in collaboration with Agent 2 (Stripe specialist).

---

## Deployment Checklist

- [ ] All functions have TypeScript types defined
- [ ] Input validation with Zod or similar
- [ ] Rate limiting implemented
- [ ] Error handling with proper status codes
- [ ] CORS headers included
- [ ] Environment variables configured in Supabase Dashboard
- [ ] Functions tested locally with `supabase functions serve`
- [ ] Functions deployed with `supabase functions deploy <name>`
- [ ] Endpoints tested with Postman/curl
- [ ] Documentation updated with actual endpoint URLs

---

## Security Considerations

1. **Input Validation:**
   - Validate all user inputs with Zod schemas
   - Sanitize strings to prevent XSS/SQL injection

2. **Authentication:**
   - Verify JWT on all protected endpoints
   - Use Supabase client with service role key for admin operations

3. **Rate Limiting:**
   - Implement rate limits to prevent abuse
   - Consider using Redis for distributed rate limiting in production

4. **API Keys:**
   - Never expose Gemini API key to client
   - Store all secrets in Supabase Edge Function secrets

5. **RLS Bypass:**
   - Service role key bypasses RLS - use carefully
   - Double-check user ownership before admin operations

6. **Error Messages:**
   - Don't leak sensitive info in error messages
   - Log detailed errors server-side only

---

## Next Steps

1. Implement all 7 Edge Functions in TypeScript (see `/edge-functions/` directory)
2. Test each function locally
3. Deploy to Supabase
4. Create API reference documentation
5. Integrate with frontend (Agent 3)

**Ready for implementation!**
