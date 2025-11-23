
import React, { useState } from 'react';
import Landing from './components/Landing';
import TypingInterface from './components/TypingInterface';
import Results from './components/Results';
import { AppState, SongConfig, TypingStats, AppMode, Recording, UserTier } from './types';
import { generateSongConfig } from './services/geminiService';

const App: React.FC = () => {
  const [state, setState] = useState<AppState>(AppState.LANDING);
  const [mode, setMode] = useState<AppMode>(AppMode.CURRICULUM);
  const [config, setConfig] = useState<SongConfig | null>(null);
  const [stats, setStats] = useState<TypingStats | null>(null);
  const [currentRecording, setCurrentRecording] = useState<Recording | undefined>(undefined);
  
  // User State (Default to Free for demo of paywall)
  const [userTier, setUserTier] = useState<UserTier>(UserTier.FREE);

  // Main start handler
  const handleStart = async (theme: string, selectedMode: AppMode, predefinedConfig?: SongConfig, recording?: Recording) => {
    setMode(selectedMode);
    setCurrentRecording(recording);

    if (recording) {
        // Immediate Playback
        setConfig(recording.config);
        setState(AppState.PLAYING);
        return;
    }

    if (predefinedConfig) {
        // Curriculum or Preset
        setConfig(predefinedConfig);
        setState(AppState.PLAYING);
        return;
    }

    // Generate new config for Free Play / Challenge
    setState(AppState.GENERATING);
    try {
      const songConfig = await generateSongConfig(theme, selectedMode);
      setConfig(songConfig);
      setState(AppState.PLAYING);
    } catch (error) {
      console.error(error);
      setState(AppState.LANDING);
    }
  };

  const handleComplete = (resultStats: TypingStats) => {
    setStats(resultStats);
    setState(AppState.RESULTS);
  };

  const handleRestart = () => {
    setState(AppState.LANDING);
    setConfig(null);
    setStats(null);
    setCurrentRecording(undefined);
  };

  return (
    <div className="w-full h-full text-white bg-symphony-obsidian">
      {state === AppState.LANDING && (
        <Landing 
            onStart={handleStart} 
            isLoading={false} 
            userTier={userTier}
            onToggleSubscription={() => setUserTier(prev => prev === UserTier.FREE ? UserTier.PAID : UserTier.FREE)}
        />
      )}
      
      {state === AppState.GENERATING && (
        <Landing 
            onStart={() => {}} 
            isLoading={true} 
            userTier={userTier}
            onToggleSubscription={() => {}}
        />
      )}

      {state === AppState.PLAYING && config && (
        <TypingInterface 
          config={config} 
          mode={mode}
          recordingData={currentRecording}
          onComplete={handleComplete} 
          onRestart={handleRestart}
          userTier={userTier}
        />
      )}

      {state === AppState.RESULTS && stats && config && (
        <Results 
          stats={stats} 
          config={config} 
          onRestart={handleRestart} 
        />
      )}
    </div>
  );
};

export default App;
