import React, { useState } from 'react';
import { Settings, X, Music, Zap, Activity, Save, Volume2, Waves } from 'lucide-react';
import { SoundProfile, ScaleType } from '../types';

interface Props {
  profile: SoundProfile;
  scale: ScaleType;
  intensity: number;
  harmonizerActive: boolean;
  onUpdateProfile: (key: keyof SoundProfile, value: any) => void;
  onUpdateScale: (scale: ScaleType) => void;
  onUpdateIntensity: (val: number) => void;
  onToggleHarmonizer: (val: boolean) => void;
  onSave: () => void;
}

const SynthControls: React.FC<Props> = ({
  profile, scale, intensity, harmonizerActive,
  onUpdateProfile, onUpdateScale, onUpdateIntensity, onToggleHarmonizer, onSave
}) => {
  const [isOpen, setIsOpen] = useState(false);

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed top-8 right-8 z-50 bg-white/10 hover:bg-white/20 backdrop-blur-md p-3 rounded-full text-white transition-all border border-white/10 shadow-xl group"
        title="Open Synth Lab"
      >
        <Settings className="group-hover:rotate-90 transition-transform duration-500" />
      </button>
    );
  }

  return (
    <div className="fixed top-0 right-0 h-full w-80 bg-symphony-card/95 backdrop-blur-xl border-l border-white/10 shadow-2xl z-50 overflow-y-auto p-6 animate-float">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-xl font-bold text-neon-blue flex items-center gap-2">
          <Settings size={20} /> Synth Lab
        </h2>
        <button 
          onClick={() => setIsOpen(false)}
          className="text-gray-400 hover:text-white transition-colors"
        >
          <X size={24} />
        </button>
      </div>

      <div className="space-y-8">
        {/* Scale Selection */}
        <div className="space-y-3">
            <label className="text-xs font-mono uppercase text-gray-500 tracking-widest flex items-center gap-2">
                <Music size={12} /> Musical Scale
            </label>
            <select 
                value={scale}
                onChange={(e) => onUpdateScale(e.target.value as ScaleType)}
                className="w-full bg-black/30 border border-white/10 rounded px-3 py-2 text-white font-mono text-sm focus:border-neon-blue outline-none"
            >
                <option value="pentatonic">Pentatonic (Dreamy)</option>
                <option value="major">Major (Happy)</option>
                <option value="minor">Minor (Sad)</option>
                <option value="blues">Blues (Soulful)</option>
                <option value="chromatic">Chromatic (Chaos)</option>
            </select>
        </div>

        {/* Toggles */}
        <div className="space-y-3">
            <label className="text-xs font-mono uppercase text-gray-500 tracking-widest flex items-center gap-2">
                <Zap size={12} /> FX Modules
            </label>
            <div className="flex gap-2">
                 <button
                    onClick={() => onToggleHarmonizer(!harmonizerActive)}
                    className={`flex-1 py-2 rounded border text-xs font-bold uppercase transition-all ${harmonizerActive ? 'bg-neon-purple/20 border-neon-purple text-neon-purple' : 'bg-white/5 border-white/10 text-gray-400'}`}
                 >
                    Harmonizer
                 </button>
            </div>
        </div>

        {/* Visuals */}
        <div className="space-y-3">
            <div className="flex justify-between">
                <label className="text-xs font-mono uppercase text-gray-500 tracking-widest flex items-center gap-2">
                    <Activity size={12} /> Visual Intensity
                </label>
                <span className="text-xs font-mono text-neon-gold">{Math.round(intensity * 100)}%</span>
            </div>
            <input 
                type="range" min="0.1" max="2.0" step="0.1"
                value={intensity}
                onChange={(e) => onUpdateIntensity(parseFloat(e.target.value))}
                className="w-full accent-neon-gold h-1 bg-white/10 rounded-full appearance-none cursor-pointer"
            />
        </div>

        <div className="h-px bg-white/10 my-4" />

        {/* Sound Controls */}
        <div className="space-y-6">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Volume2 size={16} /> Audio Parameters
            </h3>

            <div className="space-y-2">
                <div className="flex justify-between text-xs text-gray-400 font-mono">
                    <span>Filter Cutoff</span>
                    <span>{Math.round(profile.filterFreq)}Hz</span>
                </div>
                <input 
                    type="range" min="200" max="8000" step="100"
                    value={profile.filterFreq}
                    onChange={(e) => onUpdateProfile('filterFreq', parseFloat(e.target.value))}
                    className="w-full accent-neon-blue h-1 bg-white/10 rounded-full appearance-none cursor-pointer"
                />
            </div>

            <div className="space-y-2">
                <div className="flex justify-between text-xs text-gray-400 font-mono">
                    <span>Resonance (Q)</span>
                    <span>{profile.filterQ.toFixed(1)}</span>
                </div>
                <input 
                    type="range" min="0" max="15" step="0.1"
                    value={profile.filterQ}
                    onChange={(e) => onUpdateProfile('filterQ', parseFloat(e.target.value))}
                    className="w-full accent-neon-blue h-1 bg-white/10 rounded-full appearance-none cursor-pointer"
                />
            </div>

             <div className="space-y-2">
                <div className="flex justify-between text-xs text-gray-400 font-mono">
                    <span>Reverb Mix</span>
                    <span>{Math.round(profile.reverbMix * 100)}%</span>
                </div>
                <input 
                    type="range" min="0" max="1" step="0.05"
                    value={profile.reverbMix}
                    onChange={(e) => onUpdateProfile('reverbMix', parseFloat(e.target.value))}
                    className="w-full accent-neon-blue h-1 bg-white/10 rounded-full appearance-none cursor-pointer"
                />
            </div>

            <div className="space-y-2">
                <div className="flex justify-between text-xs text-gray-400 font-mono">
                    <span>Distortion</span>
                    <span>{Math.round(profile.distortion * 100)}%</span>
                </div>
                <input 
                    type="range" min="0" max="1" step="0.05"
                    value={profile.distortion}
                    onChange={(e) => onUpdateProfile('distortion', parseFloat(e.target.value))}
                    className="w-full accent-red-500 h-1 bg-white/10 rounded-full appearance-none cursor-pointer"
                />
            </div>
        </div>

        <div className="pt-6 mt-6 border-t border-white/10">
            <button 
                onClick={onSave}
                className="w-full py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg font-bold flex items-center justify-center gap-2 transition-colors border border-white/10"
            >
                <Save size={18} /> Save Preset
            </button>
        </div>

      </div>
    </div>
  );
};

export default SynthControls;