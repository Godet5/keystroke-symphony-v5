import React, { useState, useEffect } from 'react';
import { Music, Sparkles, Play, Trash2, Mic, Disc, BookOpen, LayoutGrid, Zap, ChevronRight, Globe, Activity, Lock, Users, CreditCard } from 'lucide-react';
import { audioEngine } from '../utils/audioEngine';
import { AppMode, SongConfig, Recording, Challenge, MusicalStyle, UserTier } from '../types';
import { CURRICULUM } from '../data/staticData';
import Community from './Community';

interface Props {
  onStart: (theme: string, mode: AppMode, config?: SongConfig, recording?: Recording) => void;
  isLoading: boolean;
  userTier: UserTier;
  onToggleSubscription: () => void; // Mock function
}

type Tab = 'curriculum' | 'studio' | 'remix' | 'community';

const Landing: React.FC<Props> = ({ onStart, isLoading, userTier, onToggleSubscription }) => {
  const [activeTab, setActiveTab] = useState<Tab>('curriculum');
  const [theme, setTheme] = useState('');
  const [selectedStyle, setSelectedStyle] = useState<MusicalStyle>('Dreamy');
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [showPaywall, setShowPaywall] = useState(false);

  // Access control helpers
  const hasEmailAccess = userTier !== UserTier.PUBLIC;
  const hasTier1Access = userTier === UserTier.TIER_1 || userTier === UserTier.TIER_2 || userTier === UserTier.OWNER;
  const hasTier2Access = userTier === UserTier.TIER_2 || userTier === UserTier.OWNER;

  const styles: MusicalStyle[] = ['Dreamy', 'Happy', 'Sad', 'Soulful', 'Chaos', 'Neon Jazz', 'Cyber Classical', 'Glitch Hop'];

  useEffect(() => {
    const stored = localStorage.getItem('symphony_recordings');
    if (stored) {
        try {
            setRecordings(JSON.parse(stored));
        } catch (e) {
            console.error("Failed to load recordings");
        }
    }
  }, []);

  const handleStartFreePlay = (e: React.FormEvent) => {
    e.preventDefault();

    // Studio requires EMAIL_SUBSCRIBER or higher
    if (!hasEmailAccess) {
      setShowPaywall(true);
      return;
    }

    audioEngine.start();
    const config: SongConfig = {
        theme: theme || "Free Improvisation",
        text: "",
        mood: selectedStyle,
        tempo: 80,
        soundProfile: audioEngine.getStyleProfile(selectedStyle),
        musicalStyle: selectedStyle
    };
    onStart(theme || "Free Improvisation", AppMode.FREE_PLAY, config);
  };

  const handleStartChallenge = (challenge: Challenge) => {
      // Module 1 is public (no lock)
      // Modules 2+ require EMAIL_SUBSCRIBER
      if (challenge.locked && !hasEmailAccess) {
          setShowPaywall(true);
          return;
      }

      audioEngine.start();
      const config: SongConfig = {
          theme: challenge.title,
          text: challenge.text,
          mood: 'Focused',
          tempo: challenge.bpm,
          soundProfile: challenge.soundProfile || audioEngine.getStyleProfile('Dreamy')
      };
      onStart(challenge.title, AppMode.CURRICULUM, config);
  };

  const handlePlayRecording = (rec: Recording) => {
      // Remix/Playback requires TIER_2
      if (!hasTier2Access) {
          setShowPaywall(true);
          return;
      }
      audioEngine.start();
      onStart(rec.title, AppMode.PLAYBACK, rec.config, rec);
  };

  const handleDeleteRecording = (id: string) => {
      const updated = recordings.filter(r => r.id !== id);
      setRecordings(updated);
      localStorage.setItem('symphony_recordings', JSON.stringify(updated));
  };

  return (
    <div className="min-h-screen w-full bg-symphony-obsidian text-white font-sans flex flex-col relative selection:bg-symphony-amber selection:text-black">
      
      {/* Ambient Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
         <div className="absolute -top-[10%] left-[20%] w-[50vw] h-[50vw] bg-symphony-amber/5 rounded-full blur-[120px] animate-pulse-slow"></div>
         <div className="absolute bottom-[0%] right-[0%] w-[40vw] h-[40vw] bg-cyber-blue/5 rounded-full blur-[150px]"></div>
         <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgb3BhY2l0eT0iMC4wMyI+CjxwYXRoIGQ9Ik0wIDBoNDB2NDBIMHoiIGZpbGw9Im5vbmUiI2ZmZiIgc3Ryb2tlLXdpZHRoPSIwLjUiLz4KPC9zdmc+')] opacity-20"></div>
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 w-full px-8 py-6 bg-symphony-obsidian/80 backdrop-blur-md border-b border-white/5 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-symphony-amber rounded-lg flex items-center justify-center text-black shadow-[0_0_15px_rgba(245,158,11,0.5)]">
                  <Music size={24} strokeWidth={2.5} />
              </div>
              <div>
                  <h1 className="text-2xl font-bold tracking-tight leading-none">Keystroke Symphony</h1>
                  <p className="text-xs font-mono text-gray-500 uppercase tracking-[0.2em]">Obsidian Protocol v2.0</p>
              </div>
          </div>

          {/* Auth Mock Toggle */}
          <button
            onClick={onToggleSubscription}
            className="text-[10px] font-mono uppercase px-2 py-1 rounded border border-symphony-amber text-symphony-amber hover:bg-symphony-amber/10 transition-colors"
          >
              Simulate: {userTier === UserTier.PUBLIC ? 'PUBLIC' : userTier === UserTier.EMAIL_SUBSCRIBER ? 'EMAIL' : userTier === UserTier.TIER_1 ? 'TIER_1' : userTier === UserTier.TIER_2 ? 'TIER_2' : 'OWNER'}
          </button>

          <nav className="flex items-center bg-white/5 rounded-full p-1 border border-white/10">
              {(['curriculum', 'studio', 'remix', 'community'] as Tab[]).map((tab) => (
                  <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`px-4 md:px-6 py-2 rounded-full text-xs md:text-sm font-mono font-bold uppercase transition-all duration-300 flex items-center gap-2 ${
                          activeTab === tab 
                          ? 'bg-symphony-amber text-black shadow-lg scale-105' 
                          : 'text-gray-400 hover:text-white hover:bg-white/5'
                      }`}
                  >
                      {tab === 'curriculum' && <BookOpen size={16} />}
                      {tab === 'studio' && (!hasEmailAccess ? <Lock size={14} className="text-gray-500" /> : <Mic size={16} />)}
                      {tab === 'remix' && (!hasTier2Access ? <Lock size={14} className="text-gray-500" /> : <LayoutGrid size={16} />)}
                      {tab === 'community' && <Users size={16} />}
                      <span className="hidden md:inline">{tab}</span>
                  </button>
              ))}
          </nav>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-grow w-full max-w-[1800px] mx-auto p-6 md:p-12">
        
        {/* CURRICULUM TAB */}
        {activeTab === 'curriculum' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="mb-12">
                    <h2 className="text-5xl font-bold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-500">Neural Training</h2>
                    <p className="text-xl text-gray-400 font-light max-w-2xl">
                        Calibrate your rhythm and accuracy through the <span className="text-symphony-amber">Teach → Practice → Perfect</span> protocol.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {CURRICULUM.map((item, idx) => (
                        <div
                            key={item.id}
                            onClick={() => handleStartChallenge(item)}
                            className={`group relative bg-symphony-charcoal border rounded-2xl p-8 transition-all duration-300 overflow-hidden
                                ${item.locked && !hasEmailAccess
                                    ? 'border-white/5 opacity-80 hover:opacity-100 cursor-pointer grayscale-[0.5] hover:grayscale-0'
                                    : 'border-white/5 hover:border-symphony-amber/50 cursor-pointer hover:-translate-y-1 hover:shadow-[0_0_30px_rgba(0,0,0,0.5)]'
                                }`}
                        >
                            <div className="absolute inset-0 bg-gradient-to-br from-symphony-amber/0 to-symphony-amber/0 group-hover:from-symphony-amber/5 group-hover:to-transparent transition-all duration-500" />
                            
                            <div className="relative z-10">
                                <div className="flex justify-between items-start mb-6">
                                    <span className="font-mono text-4xl font-bold text-white/10 group-hover:text-symphony-amber/20 transition-colors">
                                        {(idx + 1).toString().padStart(2, '0')}
                                    </span>
                                    {item.locked && !hasEmailAccess ? (
                                        <div className="bg-black/50 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider text-gray-400 border border-white/10 flex items-center gap-2">
                                            <Lock size={12} /> Email Required
                                        </div>
                                    ) : (
                                        <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${
                                            item.difficulty === 'Teach' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                                            item.difficulty === 'Practice' ? 'bg-symphony-amber/10 text-symphony-amber border-symphony-amber/20' :
                                            'bg-purple-500/10 text-purple-400 border-purple-500/20'
                                        }`}>
                                            {item.difficulty}
                                        </div>
                                    )}
                                </div>

                                <h3 className="text-2xl font-bold text-white mb-2 group-hover:text-symphony-amber transition-colors">{item.title}</h3>
                                <p className="text-gray-400 text-sm mb-8 line-clamp-2 h-10">{item.description}</p>

                                <div className="flex items-center justify-between pt-6 border-t border-white/5">
                                    <div className="flex items-center gap-2 text-gray-500 text-xs font-mono uppercase">
                                        <Activity size={14} />
                                        <span>Target: {item.bpm} WPM</span>
                                    </div>
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${item.locked && !hasEmailAccess ? 'bg-gray-800 text-gray-500' : 'bg-white/5 text-white group-hover:bg-symphony-amber group-hover:text-black'}`}>
                                        {item.locked && !hasEmailAccess ? <Lock size={14} /> : <ChevronRight size={16} />}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {/* STUDIO TAB */}
        {activeTab === 'studio' && (
            <div className="h-full flex flex-col items-center justify-center min-h-[60vh] animate-in fade-in zoom-in-95 duration-500 relative">
                {!hasEmailAccess && (
                    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-symphony-obsidian/90 backdrop-blur-sm rounded-3xl border border-white/5">
                         <div className="bg-symphony-charcoal p-8 rounded-3xl border border-white/10 text-center max-w-md shadow-2xl">
                            <Lock size={48} className="text-symphony-amber mb-6 mx-auto" />
                            <h2 className="text-2xl font-bold mb-2">Studio Access Locked</h2>
                            <p className="text-gray-400 mb-8">Sign up for free to unlock improvisation, custom themes, and AI generation.</p>
                            <button onClick={() => setShowPaywall(true)} className="w-full px-8 py-4 bg-symphony-amber text-black font-bold rounded-xl hover:scale-105 transition-transform shadow-lg shadow-amber-500/20">
                                Sign Up Free
                            </button>
                         </div>
                    </div>
                )}

                <div className={`w-full max-w-2xl text-center space-y-8 ${!hasEmailAccess ? 'blur-sm opacity-20 pointer-events-none' : ''}`}>
                    <div className="inline-block p-4 rounded-full bg-symphony-amber/10 border border-symphony-amber/20 mb-4">
                        <Globe className="text-symphony-amber w-8 h-8 animate-pulse-slow" />
                    </div>
                    
                    <div>
                        <h2 className="text-6xl font-bold text-white mb-4 tracking-tight">Studio</h2>
                        <p className="text-xl text-gray-400">Initialize a new generative session. No rules. Just flow.</p>
                    </div>

                    <form onSubmit={handleStartFreePlay} className="relative group space-y-6">
                        
                        {/* Musical Style Selector */}
                        <div className="flex flex-wrap justify-center gap-2">
                            {styles.map(style => (
                                <button
                                    key={style}
                                    type="button"
                                    onClick={() => setSelectedStyle(style)}
                                    disabled={!hasEmailAccess}
                                    className={`px-4 py-1 rounded-full text-xs font-mono font-bold uppercase border transition-all ${
                                        selectedStyle === style
                                        ? 'bg-symphony-amber text-black border-symphony-amber shadow-[0_0_10px_rgba(245,158,11,0.4)]'
                                        : 'bg-black/40 text-gray-400 border-white/10 hover:bg-white/5'
                                    }`}
                                >
                                    {style}
                                </button>
                            ))}
                        </div>

                        <div className="relative">
                            <div className="absolute inset-0 bg-symphony-amber/20 blur-xl rounded-full opacity-0 group-hover:opacity-50 transition-opacity duration-500" />
                            <input
                                type="text"
                                value={theme}
                                onChange={(e) => setTheme(e.target.value)}
                                placeholder={`Enter a theme for ${selectedStyle} style...`}
                                disabled={!hasEmailAccess}
                                className="relative w-full bg-black/50 border-2 border-white/10 focus:border-symphony-amber rounded-full px-8 py-6 text-2xl text-white placeholder-gray-600 outline-none transition-all shadow-2xl disabled:cursor-not-allowed"
                                autoFocus={hasEmailAccess}
                            />
                            <button
                                type="submit"
                                disabled={isLoading || !hasEmailAccess}
                                className="absolute right-3 top-3 bottom-3 px-8 bg-symphony-amber hover:bg-amber-400 text-black font-bold rounded-full transition-all flex items-center gap-2 hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
                            >
                                {isLoading ? <Sparkles className="animate-spin" /> : <Play fill="currentColor" />}
                                <span className="hidden md:inline">INITIALIZE</span>
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        )}

        {/* REMIX TAB */}
        {activeTab === 'remix' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 relative h-full min-h-[50vh]">
                 {!hasTier2Access && (
                    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-symphony-obsidian/90 backdrop-blur-sm rounded-3xl border border-white/5">
                         <div className="bg-symphony-charcoal p-8 rounded-3xl border border-white/10 text-center max-w-md shadow-2xl">
                             <Lock size={48} className="text-symphony-amber mb-6 mx-auto" />
                             <h2 className="text-2xl font-bold mb-2">Memory Core Locked</h2>
                             <p className="text-gray-400 mb-8">Replay and remix your sessions with TIER_2 ($9.99/month).</p>
                             <button onClick={() => setShowPaywall(true)} className="w-full px-6 py-4 bg-white text-black font-bold rounded-xl hover:bg-gray-200 transition-colors shadow-lg">
                                 Upgrade to TIER_2
                             </button>
                         </div>
                    </div>
                )}

                 <div className={`mb-12 flex items-end justify-between ${!hasTier2Access ? 'blur-sm opacity-20' : ''}`}>
                    <div>
                        <h2 className="text-5xl font-bold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-500">Memory Core</h2>
                        <p className="text-xl text-gray-400 font-light">
                            Access and replay your recorded symphonies.
                        </p>
                    </div>
                </div>

                {recordings.length === 0 ? (
                    <div className={`flex flex-col items-center justify-center py-32 border-2 border-dashed border-white/5 rounded-3xl bg-white/[0.02] ${!hasTier2Access ? 'blur-sm opacity-20' : ''}`}>
                        <Disc size={48} className="text-gray-600 mb-4" />
                        <p className="text-xl text-gray-400 font-mono">No data found in core.</p>
                        <button onClick={() => setActiveTab('studio')} className="mt-6 text-symphony-amber hover:underline font-mono uppercase text-sm tracking-widest">
                            Record new session
                        </button>
                    </div>
                ) : (
                    <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 ${!hasTier2Access ? 'blur-sm opacity-20 pointer-events-none' : ''}`}>
                        {recordings.slice().reverse().map(rec => (
                            <div key={rec.id} className="group bg-symphony-charcoal border border-white/5 hover:border-white/20 rounded-2xl p-6 flex flex-col gap-4 transition-all hover:bg-white/5">
                                <div className="flex items-start justify-between">
                                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-gray-800 to-black flex items-center justify-center border border-white/10 group-hover:border-symphony-amber/50 transition-colors">
                                        <Music size={20} className="text-gray-400 group-hover:text-symphony-amber" />
                                    </div>
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={() => handleDeleteRecording(rec.id)}
                                            className="p-2 hover:bg-red-500/10 hover:text-red-500 text-gray-600 rounded-lg transition-colors"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <h4 className="text-lg font-bold text-white group-hover:text-symphony-amber transition-colors truncate">{rec.title}</h4>
                                    <p className="text-xs text-gray-500 font-mono mt-1">{new Date(rec.date).toLocaleDateString()}</p>
                                </div>

                                <div className="mt-auto pt-4 border-t border-white/5 flex items-center justify-between">
                                    <div className="text-xs text-gray-500 font-mono">
                                        {(rec.duration / 1000).toFixed(1)}s • {rec.events.length} notes
                                    </div>
                                    <button 
                                        onClick={() => handlePlayRecording(rec)}
                                        className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center hover:scale-110 hover:bg-symphony-amber transition-all"
                                    >
                                        <Play size={16} fill="currentColor" className="ml-0.5" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        )}

        {/* COMMUNITY TAB */}
        {activeTab === 'community' && (
             <Community userTier={userTier} />
        )}

      </main>

      {/* PAYWALL MODAL */}
      {showPaywall && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-6">
              <div className="bg-symphony-charcoal border border-symphony-amber/20 rounded-3xl max-w-lg w-full p-8 shadow-[0_0_50px_rgba(245,158,11,0.1)] relative animate-in zoom-in-95 text-center">
                  <button onClick={() => setShowPaywall(false)} className="absolute top-4 right-4 text-gray-500 hover:text-white">
                      <Trash2 className="rotate-45" size={24} />
                  </button>
                  
                  <div className="w-20 h-20 bg-symphony-amber/10 rounded-full flex items-center justify-center mx-auto mb-6 text-symphony-amber">
                      <Lock size={40} />
                  </div>

                  <h2 className="text-3xl font-bold text-white mb-2">Unlock the Full Symphony</h2>
                  <p className="text-gray-400 mb-8">Advanced Neural Training, Studio Improvisation, Recording, and Community Access await.</p>
                  
                  <div className="grid grid-cols-2 gap-4 text-left mb-8">
                      <div className="flex items-center gap-3 text-sm text-gray-300">
                          <div className="w-1.5 h-1.5 bg-symphony-amber rounded-full" /> All 5 Training Levels
                      </div>
                      <div className="flex items-center gap-3 text-sm text-gray-300">
                          <div className="w-1.5 h-1.5 bg-symphony-amber rounded-full" /> Studio Mode (AI)
                      </div>
                      <div className="flex items-center gap-3 text-sm text-gray-300">
                          <div className="w-1.5 h-1.5 bg-symphony-amber rounded-full" /> Remix & Recording
                      </div>
                      <div className="flex items-center gap-3 text-sm text-gray-300">
                          <div className="w-1.5 h-1.5 bg-symphony-amber rounded-full" /> Full Community Access
                      </div>
                  </div>

                  <button 
                    onClick={() => { setShowPaywall(false); onToggleSubscription(); }}
                    className="w-full py-4 bg-symphony-amber hover:bg-amber-400 text-black font-bold rounded-xl transition-all flex items-center justify-center gap-3 text-lg shadow-lg hover:shadow-amber-500/20"
                  >
                      <CreditCard size={24} /> Subscribe for $4.99/mo
                  </button>
                  
                  <p className="mt-4 text-xs text-gray-500 font-mono">Secured by Supabase • Cancel Anytime</p>
              </div>
          </div>
      )}
    </div>
  );
};

export default Landing;