
export enum AppState {
  LANDING = 'LANDING',
  GENERATING = 'GENERATING',
  PLAYING = 'PLAYING',
  RESULTS = 'RESULTS',
  ERROR = 'ERROR'
}

export enum AppMode {
  CURRICULUM = 'CURRICULUM',
  FREE_PLAY = 'FREE_PLAY',
  PLAYBACK = 'PLAYBACK'
}

export enum UserTier {
  PUBLIC = 'PUBLIC',              // No account (visitor)
  EMAIL_SUBSCRIBER = 'EMAIL',     // Free account ($0)
  TIER_1 = 'TIER_1',             // Base paid ($4.99/month)
  TIER_2 = 'TIER_2',             // Premium ($9.99/month)
  OWNER = 'OWNER'                // Admin (full access)
}

export type ScaleType = 'pentatonic' | 'major' | 'minor' | 'blues' | 'chromatic';

export type MusicalStyle = 'Dreamy' | 'Happy' | 'Sad' | 'Soulful' | 'Chaos' | 'Neon Jazz' | 'Cyber Classical' | 'Glitch Hop';

export interface SoundProfile {
  oscillatorType: 'sine' | 'square' | 'sawtooth' | 'triangle';
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  filterFreq: number;
  filterQ: number;
  distortion: number; // 0 to 1
  reverbMix: number; // 0 to 1
  detune?: number; // Random pitch variance
  tremolo?: number; // Volume wobble
}

export interface SongConfig {
  theme: string;
  text: string;
  mood: string;
  tempo: number;
  soundProfile: SoundProfile;
  scale?: ScaleType;
  musicalStyle?: MusicalStyle;
}

export interface TypingStats {
  wpm: number;
  accuracy: number;
  duration: number;
  mistakes: number;
  totalChars: number;
  rhythmHistory: { time: number; wpm: number }[];
  targetWpm?: number;
  combo: number;
  maxCombo: number;
}

export interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
}

export interface AnalysisResult {
  title: string;
  critique: string;
  score: number;
}

export interface NoteEvent {
  char: string;
  time: number;
  duration?: number; // Added for smoother playback handling
}

export interface Recording {
  id: string;
  title: string;
  author: string;
  date: number;
  duration: number;
  events: NoteEvent[];
  config: SongConfig;
}

// Mock User State
export interface UserState {
  tier: UserTier;
  dailySessionsUsed: number;
  dailyLimit: number;
}

export interface Challenge {
  id: string;
  title: string;
  difficulty: 'Teach' | 'Practice' | 'Perfect';
  description: string;
  text: string;
  bpm: number;
  soundProfile?: SoundProfile;
  locked?: boolean; // For UI logic
  requiredTier?: UserTier; // Minimum tier required to access
}

// Forum Types
export interface ForumPost {
  id: string;
  author: string;
  tier: UserTier;
  title: string;
  content: string;
  likes: number;
  comments: number;
  date: string;
  tags: string[];
}