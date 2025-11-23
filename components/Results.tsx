import React, { useEffect, useState } from 'react';
import { TypingStats, SongConfig, AnalysisResult } from '../types';
import { analyzePerformance } from '../services/geminiService';
import { ArrowLeft, RefreshCw, Share2, Star, Activity, Trophy, Check, Copy } from 'lucide-react';
import { RadialBarChart, RadialBar, ResponsiveContainer, PolarAngleAxis, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

interface Props {
  stats: TypingStats;
  config: SongConfig;
  onRestart: () => void;
}

const Results: React.FC<Props> = ({ stats, config, onRestart }) => {
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [shareState, setShareState] = useState<'idle' | 'copied'>('idle');

  useEffect(() => {
    analyzePerformance(stats, config).then(setAnalysis);
  }, [stats, config]);

  const chartData = [
    { name: 'Accuracy', value: stats.accuracy, fill: '#ff003c' },
    { name: 'WPM', value: Math.min(100, stats.wpm), fill: '#00f3ff' }
  ];
  
  // Filter heatmap data to be reasonable size
  const heatmapData = stats.rhythmHistory ? stats.rhythmHistory.filter((_, i) => i % 5 === 0 || i === stats.rhythmHistory.length - 1) : [];

  const getBadges = () => {
      const b = [];
      
      // Use analysis score if available, otherwise basic stats
      const score = analysis ? analysis.score : stats.accuracy;

      if (score >= 90) b.push('Obsidian Tier');
      else if (score >= 80) b.push('Gold Tier');
      else b.push('Symphony Initiate');
      
      if (stats.wpm > 100) b.push('Hypersonic');
      else if (stats.wpm > 80) b.push('Speed Demon');
      
      if (stats.accuracy >= 99) b.push('Perfect Flow');
      
      if (stats.maxCombo > 50) b.push('Unstoppable');
      else if (stats.maxCombo > 30) b.push('Momentum');
      
      return b;
  };

  const badges = getBadges();

  const handleShare = () => {
      const scoreVal = analysis?.score || Math.round(stats.accuracy);
      const username = "NeonDrifter"; // Mock username for now, or stats.username if available
      const shareText = `Keystroke Symphony Challenge\nUser: ${username}\nScore: ${scoreVal}\nBadges: ${badges.join(', ')}\n\nCan you beat my rhythm? https://dgf-creations.pages.dev/projects/keystroke-symphony/`;
      
      navigator.clipboard.writeText(shareText).then(() => {
          setShareState('copied');
          setTimeout(() => setShareState('idle'), 3000);
      });
  };

  return (
    <div className="min-h-screen bg-symphony-obsidian text-white flex flex-col items-center justify-center p-6 overflow-y-auto">
      <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
        
        {/* Left Col: Stats */}
        <div className="space-y-8 animate-float">
          <div className="bg-symphony-charcoal border border-white/10 rounded-3xl p-8 relative overflow-hidden">
             <div className="absolute top-0 right-0 p-4 opacity-10">
                 <Star size={120} />
             </div>
             
             <h2 className="text-3xl font-bold font-sans mb-6">Performance</h2>
             
             <div className="grid grid-cols-2 gap-8">
                 <div>
                     <p className="text-gray-500 font-mono text-sm uppercase tracking-wider">Flow Rate</p>
                     <div className="flex items-baseline gap-2">
                         <p className="text-5xl font-bold text-cyber-blue mt-2">{stats.wpm}</p>
                         {stats.targetWpm && <span className="text-sm text-gray-500">/ {stats.targetWpm}</span>}
                     </div>
                     <p className="text-sm text-gray-400">Words Per Minute</p>
                 </div>
                 <div>
                     <p className="text-gray-500 font-mono text-sm uppercase tracking-wider">Precision</p>
                     <p className="text-5xl font-bold text-cyber-red mt-2">{stats.accuracy}%</p>
                     <p className="text-sm text-gray-400">Accuracy</p>
                 </div>
             </div>
             
             <div className="h-48 mt-8 -ml-4">
               <ResponsiveContainer width="100%" height="100%">
                 <RadialBarChart innerRadius="60%" outerRadius="100%" data={chartData} startAngle={90} endAngle={-270}>
                    <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
                   <RadialBar background dataKey="value" cornerRadius={10} />
                 </RadialBarChart>
               </ResponsiveContainer>
             </div>
          </div>
          
           {/* Feature: Neural Rhythm Heatmap */}
           <div className="bg-symphony-charcoal border border-white/10 rounded-3xl p-6">
               <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-4 font-mono uppercase tracking-wider">
                   <Activity size={16} className="text-symphony-amber" /> Neural Rhythm Heatmap
               </h3>
               <div className="h-40 w-full">
                   <ResponsiveContainer width="100%" height="100%">
                       <AreaChart data={heatmapData}>
                           <defs>
                               <linearGradient id="colorWpm" x1="0" y1="0" x2="0" y2="1">
                                   <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.8}/>
                                   <stop offset="95%" stopColor="#F59E0B" stopOpacity={0}/>
                               </linearGradient>
                           </defs>
                           <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                           <Tooltip 
                                contentStyle={{backgroundColor: '#111', border: '1px solid #333'}}
                                itemStyle={{color: '#F59E0B'}}
                                labelStyle={{display: 'none'}}
                           />
                           <Area type="monotone" dataKey="wpm" stroke="#F59E0B" fillOpacity={1} fill="url(#colorWpm)" />
                       </AreaChart>
                   </ResponsiveContainer>
               </div>
           </div>
        </div>

        {/* Right Col: AI Analysis */}
        <div className="flex flex-col justify-center space-y-6">
            {!analysis ? (
                <div className="h-64 flex items-center justify-center bg-symphony-charcoal/30 rounded-3xl border border-white/5 animate-pulse">
                    <p className="text-gray-400 font-mono">The Conductor is reviewing your score...</p>
                </div>
            ) : (
                <div className="bg-gradient-to-br from-symphony-charcoal to-[#1a1a1a] border border-white/10 rounded-3xl p-8 shadow-2xl transform transition-all duration-500 hover:scale-[1.02]">
                    <div className="flex items-center justify-between mb-4">
                        <span className="bg-symphony-amber/10 text-symphony-amber px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border border-symphony-amber/20">
                            Maestro's Verdict
                        </span>
                        <span className="text-4xl font-bold text-white">{analysis.score}</span>
                    </div>
                    <h3 className="text-2xl font-serif text-white mb-4 italic">"{analysis.title}"</h3>
                    <p className="text-gray-300 leading-relaxed font-sans text-lg border-l-2 border-cyber-blue pl-4 mb-6">
                        {analysis.critique}
                    </p>
                    
                    {/* Badges Section */}
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-xs font-mono uppercase text-gray-500 tracking-widest">
                            <Trophy size={14} /> Badges Earned
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {badges.map(badge => (
                                <span key={badge} className="px-3 py-1 rounded-full bg-white/5 border border-symphony-amber/30 text-symphony-amber text-xs font-bold uppercase shadow-[0_0_10px_rgba(245,158,11,0.2)]">
                                    {badge}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            <div className="flex flex-col sm:flex-row gap-4">
                <button 
                    onClick={onRestart}
                    className="flex-1 bg-white text-black font-bold py-4 rounded-xl hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
                >
                    <RefreshCw size={20} />
                    Retry or Next session
                </button>
                <button 
                    onClick={handleShare}
                    className={`flex-1 border rounded-xl transition-all flex items-center justify-center gap-2 font-bold ${shareState === 'copied' ? 'bg-green-500/20 border-green-500 text-green-500' : 'bg-white/5 border-white/10 text-white hover:bg-white/10'}`}
                >
                    {shareState === 'copied' ? <Check size={20} /> : <Share2 size={20} />}
                    {shareState === 'copied' ? 'Link Copied!' : 'Share Result'}
                </button>
            </div>
        </div>

      </div>
    </div>
  );
};

export default Results;