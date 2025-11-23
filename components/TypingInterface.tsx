import React, { useState, useEffect, useRef, useCallback } from 'react';
import { SongConfig, TypingStats, AppMode, ScaleType, SoundProfile, NoteEvent, Recording, UserTier } from '../types';
import { audioEngine } from '../utils/audioEngine';
import Visualizer from './Visualizer';
import SynthControls from './SynthControls';
import { ArrowLeft, Ghost, Lock } from 'lucide-react';

interface Props {
  config: SongConfig;
  mode: AppMode;
  recordingData?: Recording; // For playback
  onComplete: (stats: TypingStats) => void;
  onRestart: () => void;
  userTier: UserTier;
}

const TypingInterface: React.FC<Props> = ({ config, mode, recordingData, onComplete, onRestart, userTier }) => {
  // Core State
  const [input, setInput] = useState('');
  const [startTime, setStartTime] = useState<number | null>(null);
  const [mistakes, setMistakes] = useState(0);
  const [triggerVisual, setTriggerVisual] = useState(0);
  const [cursorPos, setCursorPos] = useState<{ x: number, y: number } | null>(null);
  const [isFocused, setIsFocused] = useState(true);

  // Recording & Export State
  const [recordEnabled, setRecordEnabled] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedEvents, setRecordedEvents] = useState<NoteEvent[]>([]);
  const [recordingStartTime, setRecordingStartTime] = useState<number>(0);
  const [canvasRef, setCanvasRef] = useState<HTMLCanvasElement | null>(null);

  // Playback State
  const [isPlayingBack, setIsPlayingBack] = useState(false);
  const [playbackProgress, setPlaybackProgress] = useState(0);

  // Customization State
  const [soundProfile, setSoundProfile] = useState<SoundProfile>(config.soundProfile);
  const [currentScale, setCurrentScale] = useState<ScaleType>('pentatonic');
  const [visualIntensity, setVisualIntensity] = useState(1.0);
  const [harmonizerActive, setHarmonizerActive] = useState(false);

  // Stats State
  const [currentWpm, setCurrentWpm] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [ghostPosition, setGhostPosition] = useState(0);
  const [isGlitching, setIsGlitching] = useState(false);
  const [rhythmHistory, setRhythmHistory] = useState<{time: number, wpm: number}[]>([]);

  // Metronome State
  const [metronomePulse, setMetronomePulse] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const charRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const caretRef = useRef<HTMLSpanElement>(null);
  const playbackFrameRef = useRef<number>(0);
  const gameLoopRef = useRef<number>(0);
  const lastKeystrokeTime = useRef<number>(0);
  
  // Recording requires TIER_1 or higher
  const hasTier1Access = userTier === UserTier.TIER_1 || userTier === UserTier.TIER_2 || userTier === UserTier.OWNER;

  // Initialize Audio Engine
  useEffect(() => {
    if (config.soundProfile) {
        setSoundProfile(config.soundProfile);
        audioEngine.setProfile(config.soundProfile);
    }
  }, [config.soundProfile]);

  // Initialize refs for curriculum
  useEffect(() => {
    if (mode === AppMode.CURRICULUM) {
        charRefs.current = charRefs.current.slice(0, config.text.length);
    }
  }, [config.text, mode]);

  // --- RECORDING LOGIC ---
  useEffect(() => {
      if (hasTier1Access && recordEnabled && mode === AppMode.FREE_PLAY && canvasRef) {
          // Start recording if enabled and not already recording
          if (!isRecording && startTime) {
              const stream = canvasRef.captureStream(30);
              audioEngine.startRecording(stream);
              setIsRecording(true);
              setRecordingStartTime(Date.now());
              setRecordedEvents([]);
          }
      } else if (!recordEnabled && isRecording) {
          // Stop recording if toggle switched off
          setIsRecording(false);
          audioEngine.stopRecording();
      }
  }, [mode, isRecording, canvasRef, hasTier1Access, recordEnabled, startTime]);


  // --- GAME LOOP ---
  useEffect(() => {
    const loop = () => {
        // Ghost waits for start
        if (!startTime) {
             gameLoopRef.current = requestAnimationFrame(loop);
             return;
        }

        const now = Date.now();
        
        // Correct Ghost Logic: purely time based from startTime
        if (mode === AppMode.CURRICULUM) {
             // WPM formula: (Chars / 5) / Minutes
             // Chars per second = (WPM * 5) / 60 = WPM / 12
             const charsPerSecond = config.tempo / 12;
             const elapsedSec = (now - startTime) / 1000;
             setGhostPosition(elapsedSec * charsPerSecond);
        }

        gameLoopRef.current = requestAnimationFrame(loop);
    };
    
    gameLoopRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(gameLoopRef.current);
  }, [startTime, mode, config.tempo]);

  // Metronome Loop (Pre-start)
  useEffect(() => {
      if (mode === AppMode.CURRICULUM && !startTime) {
          const bpm = config.tempo;
          const intervalMs = 60000 / bpm;
          
          const tick = () => {
            setMetronomePulse(true);
            audioEngine.playMetronomeTick();
            setTimeout(() => setMetronomePulse(false), 150);
          };

          const interval = setInterval(tick, intervalMs);
          return () => clearInterval(interval);
      }
  }, [mode, startTime, config.tempo]);

  // Stats Update Loop (500ms)
  useEffect(() => {
      const interval = setInterval(() => {
          if (!startTime) return;
          const now = Date.now();
          const elapsedMin = (now - startTime) / 60000;
          const safeElapsed = elapsedMin > 0.001 ? elapsedMin : 0.001;
          
          const val = Math.round((input.length / 5) / safeElapsed);
          setCurrentWpm(val);
          setRhythmHistory(prev => [...prev, { time: now - startTime, wpm: val }]);

          const adrenaline = Math.min(1, val / 120);
          audioEngine.setAdrenaline(adrenaline);
          setIsGlitching(val > 90 || combo > 25);
      }, 500);

      return () => clearInterval(interval);
  }, [startTime, input, combo]);

  // --- Playback Logic ---
  useEffect(() => {
      if (mode === AppMode.PLAYBACK && recordingData) {
          setIsPlayingBack(true);
          let startPlaybackTime = Date.now();
          
          const playbackLoop = () => {
              const now = Date.now();
              const elapsed = now - startPlaybackTime;
              
              // Progress bar 0-100
              const prog = Math.min(100, (elapsed / recordingData.duration) * 100);
              setPlaybackProgress(prog);

              // Trigger events
              // (Simple implementation - in reality we'd pop events from a queue)
              recordingData.events.forEach(e => {
                  const diff = Math.abs(elapsed - e.time);
                  if (diff < 20) { // 20ms window
                       // Visual only, audio is handled by Web Audio if we recorded output, 
                       // OR we re-trigger synthesis.
                       // For this MVP, we'll re-trigger synth
                       if (Math.random() > 0.5) { // Throttle re-triggers to avoid lag
                           audioEngine.playKey(e.char);
                           setTriggerVisual(n => n + 1);
                           setCursorPos({ 
                               x: window.innerWidth / 2 + (Math.random() * 100 - 50), 
                               y: window.innerHeight / 2 + (Math.random() * 100 - 50)
                           });
                       }
                  }
              });

              if (elapsed < recordingData.duration) {
                  playbackFrameRef.current = requestAnimationFrame(playbackLoop);
              } else {
                  setIsPlayingBack(false);
              }
          };
          playbackFrameRef.current = requestAnimationFrame(playbackLoop);
          return () => cancelAnimationFrame(playbackFrameRef.current);
      }
  }, [mode, recordingData]);

  const handleInput = (char: string) => {
    if (isPlayingBack) return;
    if (!startTime) setStartTime(Date.now());

    const now = Date.now();
    const timeSinceLast = now - lastKeystrokeTime.current;
    lastKeystrokeTime.current = now;

    // Combo Logic: Consistent rhythm (keys within 300ms)
    if (timeSinceLast < 300 && timeSinceLast > 50) {
        setCombo(c => {
            const newCombo = c + 1;
            if (newCombo > maxCombo) setMaxCombo(newCombo);
            return newCombo;
        });
    } else {
        setCombo(0);
    }

    // Audio Trigger
    audioEngine.playKey(char);

    // Visual Trigger
    setTriggerVisual(prev => prev + 1);
    if (mode === AppMode.CURRICULUM && charRefs.current[input.length]) {
        const rect = charRefs.current[input.length]?.getBoundingClientRect();
        if (rect) setCursorPos({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
    } else if (mode === AppMode.FREE_PLAY) {
        // Free Play: Use Caret Ref for exact precision
        if (caretRef.current) {
            const rect = caretRef.current.getBoundingClientRect();
            setCursorPos({ x: rect.left, y: rect.top + rect.height / 2 });
        } else {
             // Fallback
             setCursorPos({ x: window.innerWidth/2 + (Math.random()*20-10), y: window.innerHeight/2 + (Math.random()*20-10)});
        }
    }
    
    // Recording Event
    if (isRecording) {
        setRecordedEvents(prev => [...prev, { char, time: now - recordingStartTime }]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (mode === AppMode.PLAYBACK) return;

    // Block certain keys
    if (['Shift', 'Control', 'Alt', 'Meta', 'Tab', 'CapsLock'].includes(e.key)) return;

    // Handle Backspace
    if (e.key === 'Backspace') {
        if (input.length > 0) {
            setInput(prev => prev.slice(0, -1));
            setCombo(0); // Penalty
        }
        return;
    }

    // Handle Enter (Completion check for Free Play, ignored for Curriculum usually)
    if (e.key === 'Enter') {
        if (mode === AppMode.FREE_PLAY && input.length > 10) {
             finishSession();
        } else {
             setInput(prev => prev + '\n');
             handleInput('\n');
        }
        return;
    }

    if (e.key.length !== 1) return; // Ignore special keys

    // CURRICULUM MODE LOGIC
    if (mode === AppMode.CURRICULUM) {
        const targetChar = config.text[input.length];
        if (e.key === targetChar) {
            setInput(prev => prev + e.key);
            handleInput(e.key);
            
            // Completion Check
            if (input.length + 1 === config.text.length) {
                finishSession();
            }
        } else {
            // Mistake
            audioEngine.playError();
            setMistakes(prev => prev + 1);
            setCombo(0);
            setIsGlitching(true);
            setTimeout(() => setIsGlitching(false), 200);
        }
    } 
    // FREE PLAY MODE LOGIC
    else {
        setInput(prev => prev + e.key);
        handleInput(e.key);
    }
  };

  const finishSession = async () => {
      if (isRecording) {
         await audioEngine.stopRecording();
      }

      const duration = (Date.now() - (startTime || Date.now())) / 1000 / 60;
      const wpm = Math.round((input.length / 5) / duration);
      const accuracy = Math.round(((input.length - mistakes) / input.length) * 100) || 0;

      const stats: TypingStats = {
          wpm,
          accuracy,
          duration,
          mistakes,
          totalChars: input.length,
          rhythmHistory,
          targetWpm: config.tempo,
          combo: combo, 
          maxCombo: maxCombo
      };

      // If recording, save it to local storage (requires TIER_1)
      if (mode === AppMode.FREE_PLAY && hasTier1Access) { 
          const newRecording: Recording = {
              id: Date.now().toString(),
              title: `Session ${new Date().toLocaleTimeString()}`,
              author: 'User',
              date: Date.now(),
              duration: (Date.now() - (startTime || 0)),
              events: recordedEvents,
              config: config
          };
          const existing = JSON.parse(localStorage.getItem('symphony_recordings') || '[]');
          localStorage.setItem('symphony_recordings', JSON.stringify([...existing, newRecording]));
      }

      onComplete(stats);
  };

  return (
    <div 
        className={`relative w-full h-screen flex flex-col items-center justify-center outline-none overflow-hidden ${isGlitching ? 'animate-shake' : ''}`}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        ref={containerRef}
    >
      <Visualizer 
        active={true} 
        trigger={triggerVisual} 
        cursorPosition={cursorPos} 
        theme={config.mood}
        intensity={visualIntensity}
        onCanvasRef={setCanvasRef}
      />

      <SynthControls 
        profile={soundProfile} 
        scale={currentScale} 
        intensity={visualIntensity}
        harmonizerActive={harmonizerActive}
        onUpdateProfile={(k, v) => {
            audioEngine.updateParam(k, v);
            setSoundProfile(prev => ({...prev, [k]: v}));
        }}
        onUpdateScale={(s) => {
            audioEngine.setScale(s);
            setCurrentScale(s);
        }}
        onUpdateIntensity={setVisualIntensity}
        onToggleHarmonizer={(v) => {
            audioEngine.setHarmonizer(v);
            setHarmonizerActive(v);
        }}
        onSave={() => {}}
      />

      {/* HEADER / STATS */}
      <div className="absolute top-0 w-full p-6 flex justify-between items-start z-20 pointer-events-none">
        <button onClick={onRestart} className="pointer-events-auto bg-white/10 p-2 rounded-full hover:bg-white/20 backdrop-blur text-white transition-colors">
            <ArrowLeft />
        </button>

        <div className="flex flex-col items-end gap-2">
            <div className="flex gap-4 text-sm font-mono bg-black/50 backdrop-blur px-4 py-2 rounded-lg border border-white/10">
                <div className="flex flex-col items-center">
                    <span className="text-gray-400 text-[10px] uppercase">WPM</span>
                    <span className="text-xl font-bold text-neon-blue">{currentWpm}</span>
                </div>
                <div className="w-px bg-white/20" />
                <div className="flex flex-col items-center">
                    <span className="text-gray-400 text-[10px] uppercase">Combo</span>
                    <span className={`text-xl font-bold ${combo > 10 ? 'text-symphony-amber animate-pulse' : 'text-white'}`}>{combo}</span>
                </div>
                {mode === AppMode.CURRICULUM && (
                     <>
                        <div className="w-px bg-white/20" />
                        <div className="flex flex-col items-center">
                            <span className="text-gray-400 text-[10px] uppercase">Target</span>
                            <span className="text-xl font-bold text-gray-300">{config.tempo}</span>
                        </div>
                     </>
                )}
            </div>
            {metronomePulse && <div className="text-xs text-symphony-amber font-mono animate-ping">● METRONOME</div>}
        </div>
      </div>

      {/* MAIN TYPING AREA */}
      <div className="relative z-10 max-w-4xl w-full px-12 text-center pointer-events-none">
        {mode === AppMode.CURRICULUM ? (
            <div className="text-3xl md:text-4xl leading-relaxed font-mono text-left relative tracking-wide">
                {/* Ghost Cursor */}
                {startTime && (
                    <div 
                        className="absolute top-1 w-1 h-8 bg-white/20 blur-sm transition-all duration-1000 ease-linear"
                        style={{ 
                            left: `${Math.min(100, (ghostPosition / config.text.length) * 100)}%`,
                            top: `${Math.floor(ghostPosition / 40) * 3}rem` // Rough line height calc
                        }} 
                    >
                        <Ghost size={24} className="text-white/20 -mt-8 ml-[-10px]" />
                    </div>
                )}

                {config.text.split('').map((char, i) => {
                    let colorClass = 'text-gray-600';
                    if (i < input.length) {
                        colorClass = input[i] === config.text[i] ? 'text-symphony-amber drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]' : 'text-red-500 line-through decoration-2';
                    } else if (i === input.length) {
                        colorClass = 'text-white bg-white/10 rounded px-1 animate-pulse';
                    }

                    return (
                        <span 
                            key={i} 
                            ref={el => { charRefs.current[i] = el; }}
                            className={`${colorClass} transition-colors duration-100`}
                        >
                            {char}
                        </span>
                    );
                })}
            </div>
        ) : (
            // FREE PLAY INPUT VISUALIZATION
            <div className="text-3xl md:text-5xl font-sans font-bold text-white/90 break-words whitespace-pre-wrap animate-in fade-in duration-1000">
                {input || <span className="text-white/20 italic animate-pulse">Type to begin the symphony...</span>}
                <span className="inline-block w-1 h-12 bg-symphony-amber ml-1 animate-pulse align-middle" ref={caretRef}/>
            </div>
        )}
      </div>

      {/* Footer Controls */}
      <div className="absolute bottom-8 left-0 w-full px-8 flex justify-between items-end z-30 pointer-events-auto">
         <div className="text-xs text-gray-500 font-mono max-w-[200px]">
            {config.mood} Mode • {config.soundProfile.oscillatorType} wave
         </div>

         {/* Record Toggle (Locked for Free) */}
         <div className="flex items-center gap-4">
             {mode === AppMode.FREE_PLAY && (
                 <div className="flex items-center gap-2 bg-black/40 backdrop-blur rounded-full p-1 pr-4 border border-white/10">
                     <button
                        onClick={() => hasTier1Access && setRecordEnabled(!recordEnabled)}
                        className={`relative w-12 h-6 rounded-full transition-colors duration-300 ${recordEnabled ? 'bg-red-500' : 'bg-gray-700'} ${!hasTier1Access ? 'opacity-50 cursor-not-allowed' : ''}`}
                     >
                         <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform duration-300 ${recordEnabled ? 'translate-x-6' : ''}`} />
                     </button>
                     <div className="flex flex-col leading-none">
                         <span className={`text-xs font-bold uppercase ${recordEnabled ? 'text-white' : 'text-gray-400'}`}>REC</span>
                         {!hasTier1Access && <span className="text-[8px] text-symphony-amber flex items-center gap-1"><Lock size={6} /> $4.99</span>}
                     </div>
                     {isRecording && <div className="w-2 h-2 rounded-full bg-red-500 animate-ping ml-2" />}
                 </div>
             )}
         </div>
         
         {!isFocused && !startTime && mode !== AppMode.CURRICULUM && (
            <div className="absolute bottom-20 left-1/2 -translate-x-1/2 text-white/50 bg-black/80 px-4 py-2 rounded animate-bounce">
                Click to Focus
            </div>
         )}
      </div>

    </div>
  );
};

export default TypingInterface;