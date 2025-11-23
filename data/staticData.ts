import { Challenge, ForumPost, UserTier } from '../types';

export const CURRICULUM: Challenge[] = [
  {
    id: 'teach_01',
    title: 'Rhythm Basics',
    difficulty: 'Teach',
    description: 'Establish your internal metronome. Focus on steady, even keystrokes.',
    text: 'rhythm flows when the mind is still',
    bpm: 20, // Very accessible speed for beginners
    soundProfile: {
        oscillatorType: 'sine',
        attack: 0.05,
        decay: 0.3,
        sustain: 0.2,
        release: 1.0,
        filterFreq: 800,
        filterQ: 0.5,
        distortion: 0,
        reverbMix: 0.4,
        detune: 2
    },
    locked: false, // Only this one is Free
    requiredTier: UserTier.PUBLIC // Public access (no account needed)
  },
  {
    id: 'teach_02',
    title: 'Finger Travel',
    difficulty: 'Teach',
    description: 'Explore the reach of the home row to the upper deck.',
    text: 'quiet water reflects the golden sun',
    bpm: 30,
    soundProfile: {
        oscillatorType: 'triangle',
        attack: 0.05,
        decay: 0.3,
        sustain: 0.3,
        release: 1.2,
        filterFreq: 1000,
        filterQ: 1,
        distortion: 0.02,
        reverbMix: 0.5,
        detune: 4
    },
    locked: true, // Paid
    requiredTier: UserTier.EMAIL_SUBSCRIBER // Requires free account
  },
  {
    id: 'practice_01',
    title: 'The Flow State',
    difficulty: 'Practice',
    description: 'A longer passage to test your endurance and consistency.',
    text: 'In the obsidian void, a single spark of amber light creates a symphony of infinite possibilities. Type with purpose.',
    bpm: 45,
    soundProfile: {
        oscillatorType: 'sawtooth',
        attack: 0.02,
        decay: 0.2,
        sustain: 0.2,
        release: 1.5,
        filterFreq: 1200,
        filterQ: 1.0,
        distortion: 0.05,
        reverbMix: 0.6,
        detune: 6
    },
    locked: true, // Paid
    requiredTier: UserTier.EMAIL_SUBSCRIBER // Requires free account
  },
  {
    id: 'practice_02',
    title: 'Syncopation',
    difficulty: 'Practice',
    description: 'Alternating hands to create a complex rhythmic texture.',
    text: 'Left hand right hand weaving a tapestry of digital sound across the silence.',
    bpm: 60,
    soundProfile: {
        oscillatorType: 'square',
        attack: 0.02,
        decay: 0.15,
        sustain: 0.1,
        release: 0.6,
        filterFreq: 1400,
        filterQ: 1.0,
        distortion: 0.05,
        reverbMix: 0.4,
        detune: 5
    },
    locked: true, // Paid
    requiredTier: UserTier.EMAIL_SUBSCRIBER // Requires free account
  },
  {
    id: 'perfect_01',
    title: 'Mastery',
    difficulty: 'Perfect',
    description: 'Precision is paramount. Hesitation breaks the spell.',
    text: 'True mastery is not just speed but the silence between the notes. Control the chaos.',
    bpm: 80,
    soundProfile: {
        oscillatorType: 'sawtooth',
        attack: 0.01,
        decay: 0.1,
        sustain: 0.4,
        release: 2.0,
        filterFreq: 2000,
        filterQ: 1,
        distortion: 0.08,
        reverbMix: 0.5,
        detune: 8
    },
    locked: true, // Paid
    requiredTier: UserTier.EMAIL_SUBSCRIBER // Requires free account
  }
];

export const FORUM_POSTS: ForumPost[] = [
  {
    id: '1',
    author: 'NeonDrifter',
    tier: UserTier.PAID,
    title: 'Best settings for "Chaos" mode?',
    content: 'I found that setting distortion to 0.6 and delay to max creates an incredible industrial soundscape. Has anyone else tried mixing this with the Blues scale?',
    likes: 24,
    comments: 5,
    date: '2 hours ago',
    tags: ['Sound Design', 'Chaos']
  },
  {
    id: '2',
    author: 'SymphonyAdmin',
    tier: UserTier.OWNER,
    title: 'Weekly Challenge: 100 WPM on "Mastery"',
    content: 'This weeks challenge is brutal. Post your high scores here. The top 3 rhythm masters get a custom "Obsidian" badge on their profile.',
    likes: 156,
    comments: 42,
    date: '1 day ago',
    tags: ['Challenge', 'Official']
  },
  {
    id: '3',
    author: 'FlowState_99',
    tier: UserTier.PAID,
    title: 'The Ghost is too fast!',
    content: 'I swear the ghost on level 3 cheats. It accelerates right at the end. Any tips for maintaining pace during the line breaks?',
    likes: 12,
    comments: 8,
    date: '3 days ago',
    tags: ['Help', 'Curriculum']
  },
  {
    id: '4',
    author: 'KeyMaster',
    tier: UserTier.PAID,
    title: 'My "Cyber Classical" patch',
    content: 'Try these settings: Triangle Wave, Attack 0.1, Release 2.0, Reverb 0.8. It sounds like a cathedral in space.',
    likes: 89,
    comments: 15,
    date: '5 days ago',
    tags: ['Patches', 'Sharing']
  }
];