import { SoundProfile, ScaleType, MusicalStyle } from '../types';

class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  
  // Effects Bus
  private reverbNode: ConvolverNode | null = null;
  private delayNode: DelayNode | null = null;
  private delayFeedback: GainNode | null = null;
  
  private dryNode: GainNode | null = null;
  private wetNode: GainNode | null = null; // Sends to Reverb
  private delaySendNode: GainNode | null = null; // Sends to Delay

  // Input/Output
  private micNode: MediaStreamAudioSourceNode | null = null;
  private micGain: GainNode | null = null;
  private destNode: MediaStreamAudioDestinationNode | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  
  private isHarmonizerActive: boolean = false;
  private currentScale: ScaleType = 'pentatonic';
  private adrenalineLevel: number = 0;

  // Polyphony Management
  private activeVoices: Set<{ 
    oscillators: OscillatorNode[], 
    gain: GainNode, 
    filter: BiquadFilterNode,
    panner: StereoPannerNode,
    startTime: number,
    freq: number 
  }> = new Set();
  
  // Reduced from 48/64 to 30 to ensure stability at high WPM
  private readonly MAX_POLYPHONY = 30; 
  private curveCache: Map<number, Float32Array> = new Map();

  private currentProfile: SoundProfile = {
    oscillatorType: 'sine',
    attack: 0.05,
    decay: 0.2,
    sustain: 0.2,
    release: 1.5,
    filterFreq: 1200,
    filterQ: 1,
    distortion: 0,
    reverbMix: 0.4,
    detune: 5,
    tremolo: 0
  };

  private readonly rootFreq = 130.81; // C3

  private scaleIntervals: Record<ScaleType, number[]> = {
    pentatonic: [0, 2, 4, 7, 9],
    major: [0, 2, 4, 5, 7, 9, 11],
    minor: [0, 2, 3, 5, 7, 8, 10],
    blues: [0, 3, 5, 6, 7, 10],
    chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
  };

  constructor() {}

  public async start() {
    if (!this.ctx) {
        this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)({
          latencyHint: 'interactive',
          sampleRate: 44100
        });
        await this.initAudioChain();
    }
    if (this.ctx.state === 'suspended') {
        try {
            await this.ctx.resume();
        } catch (e) {
            console.error("Audio resume failed", e);
        }
    }
  }

  private async initAudioChain() {
    if (!this.ctx) return;

    this.destNode = this.ctx.createMediaStreamDestination();

    // Transparent Limiter / Compressor
    this.compressor = this.ctx.createDynamicsCompressor();
    // Relaxed threshold to prevent aggressive ducking during chords
    this.compressor.threshold.setValueAtTime(-15, this.ctx.currentTime); 
    this.compressor.knee.setValueAtTime(30, this.ctx.currentTime);
    this.compressor.ratio.setValueAtTime(3, this.ctx.currentTime);
    this.compressor.attack.setValueAtTime(0.005, this.ctx.currentTime);
    this.compressor.release.setValueAtTime(0.25, this.ctx.currentTime);

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.5; // Optimized level

    this.dryNode = this.ctx.createGain();
    this.wetNode = this.ctx.createGain();
    this.delaySendNode = this.ctx.createGain();
    
    await this.setupReverb();
    this.setupDelay();

    if (this.masterGain && this.dryNode && this.wetNode && this.delaySendNode && this.reverbNode && this.delayNode && this.compressor && this.destNode) {
      // Routing
      this.masterGain.connect(this.dryNode);
      this.masterGain.connect(this.wetNode);
      this.masterGain.connect(this.delaySendNode);

      this.dryNode.connect(this.compressor);

      this.wetNode.connect(this.reverbNode);
      this.reverbNode.connect(this.compressor);

      // Feedback delay loop
      this.delaySendNode.connect(this.delayNode);
      this.delayNode.connect(this.compressor); // Send delay out to mix

      this.compressor.connect(this.ctx.destination);
      this.compressor.connect(this.destNode);
    }
    this.updateMix();
  }

  private async setupReverb() {
    if (!this.ctx) return;
    this.reverbNode = this.ctx.createConvolver();
    
    // Optimized Impulse Response
    const duration = 2.5;
    const decay = 2.0;
    const rate = this.ctx.sampleRate;
    const length = rate * duration;
    const impulse = this.ctx.createBuffer(2, length, rate);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);

    for (let i = 0; i < length; i++) {
      const n = i / length;
      const amp = Math.pow(1 - n, decay); 
      left[i] = (Math.random() * 2 - 1) * amp;
      right[i] = (Math.random() * 2 - 1) * amp;
    }

    this.reverbNode.buffer = impulse;
  }

  private setupDelay() {
      if (!this.ctx) return;
      this.delayNode = this.ctx.createDelay(4.0);
      this.delayFeedback = this.ctx.createGain();
      
      this.delayNode.delayTime.value = 0.375; 
      this.delayFeedback.gain.value = 0.3;

      this.delayNode.connect(this.delayFeedback);
      this.delayFeedback.connect(this.delayNode);
  }

  private updateMix() {
      if (!this.dryNode || !this.wetNode || !this.delaySendNode || !this.ctx) return;
      
      const p = this.currentProfile;
      const reverbAmount = Math.min(0.8, p.reverbMix); 
      const delayAmount = reverbAmount * 0.4;
      
      const t = this.ctx.currentTime;
      // Smooth transitions
      this.dryNode.gain.setTargetAtTime(1 - (reverbAmount * 0.5), t, 0.1);
      this.wetNode.gain.setTargetAtTime(reverbAmount, t, 0.1);
      this.delaySendNode.gain.setTargetAtTime(delayAmount, t, 0.1);
  }

  private makeDistortionCurve(amount: number): Float32Array {
    if (amount === 0) return new Float32Array(2);
    const cacheKey = Math.round(amount * 100);
    if (this.curveCache.has(cacheKey)) return this.curveCache.get(cacheKey)!;

    const k = typeof amount === 'number' ? amount : 50;
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    const deg = Math.PI / 180;
    
    for (let i = 0; i < n_samples; ++i) {
      const x = i * 2 / n_samples - 1;
      curve[i] = (3 + k) * x * 20 * deg / (Math.PI + k * Math.abs(x));
    }
    
    this.curveCache.set(cacheKey, curve);
    return curve;
  }

  // --- STYLES & PROFILES ---
  public getStyleProfile(style: MusicalStyle): SoundProfile {
      switch (style) {
          case 'Happy':
              return {
                  oscillatorType: 'square',
                  attack: 0.02, decay: 0.1, sustain: 0.2, release: 0.4,
                  filterFreq: 2800, filterQ: 0.5, distortion: 0, reverbMix: 0.25, detune: 4
              };
          case 'Sad':
              return {
                  oscillatorType: 'triangle',
                  attack: 0.1, decay: 0.4, sustain: 0.5, release: 2.5,
                  filterFreq: 600, filterQ: 0, distortion: 0.05, reverbMix: 0.7, detune: 6
              };
          case 'Soulful':
              return {
                  oscillatorType: 'sine',
                  attack: 0.04, decay: 0.3, sustain: 0.4, release: 1.0,
                  filterFreq: 1200, filterQ: 0.5, distortion: 0.1, reverbMix: 0.45, tremolo: 5
              };
          case 'Chaos':
              return {
                  oscillatorType: 'sawtooth',
                  attack: 0.01, decay: 0.1, sustain: 0.4, release: 0.5,
                  filterFreq: 1000, filterQ: 2, distortion: 0.35, reverbMix: 0.3, detune: 40
              };
          case 'Neon Jazz':
               return {
                  oscillatorType: 'square',
                  attack: 0.02, decay: 0.2, sustain: 0.4, release: 1.2,
                  filterFreq: 2200, filterQ: 0.6, distortion: 0.04, reverbMix: 0.35, detune: 6
              };
          case 'Glitch Hop':
               return {
                  oscillatorType: 'sawtooth',
                  attack: 0.01, decay: 0.15, sustain: 0.1, release: 0.2,
                  filterFreq: 5000, filterQ: 1.5, distortion: 0.3, reverbMix: 0.2, detune: 15
              };
          case 'Cyber Classical':
               return {
                  oscillatorType: 'triangle',
                  attack: 0.04, decay: 1.0, sustain: 0.3, release: 2.0,
                  filterFreq: 1800, filterQ: 1, distortion: 0.05, reverbMix: 0.6, detune: 2
              };
          default: // Dreamy
              return {
                  oscillatorType: 'sine',
                  attack: 0.05, decay: 0.3, sustain: 0.3, release: 1.2,
                  filterFreq: 1200, filterQ: 0.8, distortion: 0.02, reverbMix: 0.5, detune: 3
              };
      }
  }

  public setProfile(p: SoundProfile) {
      this.currentProfile = p;
      this.updateMix();
  }

  public setScale(s: ScaleType) {
      this.currentScale = s;
  }

  public setHarmonizer(active: boolean) {
      this.isHarmonizerActive = active;
  }

  public setAdrenaline(level: number) {
      this.adrenalineLevel = level;
  }

  public updateParam(key: keyof SoundProfile, value: any) {
      (this.currentProfile as any)[key] = value;
      if (key === 'reverbMix') this.updateMix();
  }

  // --- CORE AUDIO GENERATION ---
  public playMetronomeTick(accent: boolean = false) {
    if (!this.ctx || !this.masterGain) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    
    const t = this.ctx.currentTime + 0.04; // Slightly increased lookahead
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'sine';
    const startFreq = accent ? 1500 : 1000;
    const endFreq = accent ? 800 : 500;

    osc.frequency.setValueAtTime(startFreq, t);
    osc.frequency.exponentialRampToValueAtTime(endFreq, t + 0.05);
    
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.3, t + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    
    osc.connect(gain);
    gain.connect(this.masterGain);
    
    osc.start(t);
    osc.stop(t + 0.1);
  }

  public playKey(char: string) {
      if (!this.ctx) {
          this.start(); // Try to start if not exists
          return;
      }
      
      // Robust resume for browser autoplay policy
      if (this.ctx.state === 'suspended') {
          this.ctx.resume().catch(e => console.error(e));
      }
      
      if (!this.masterGain) return;

      const charCode = char.charCodeAt(0);
      const intervals = this.scaleIntervals[this.currentScale];
      const noteIndex = charCode % (intervals.length * 2); 
      // Octave range 3-5
      const octave = Math.floor(noteIndex / intervals.length) + 3; 
      const interval = intervals[noteIndex % intervals.length];
      
      const freq = this.rootFreq * Math.pow(2, (interval / 12) + (octave - 3));
      
      // Calculate Pan based on pitch (Low = Left, High = Right)
      const pan = Math.max(-0.8, Math.min(0.8, (noteIndex - intervals.length) / intervals.length));

      this.triggerNote(freq, 1.0, pan);

      if (this.isHarmonizerActive) {
          // Precise scheduling for harmonizer - delay by 80ms
          this.triggerNote(freq * 1.5, 0.4, pan * 0.5, 0.08); 
      }
  }

  public playError() {
      if (!this.ctx) return;
      if (this.ctx.state === 'suspended') this.ctx.resume();
      this.triggerNote(55, 0.6, 0); // Low A1
      this.triggerNote(59, 0.6, 0, 0.05); // Diminished interval
  }

  private triggerNote(freq: number, velocity: number = 1.0, pan: number = 0, delay: number = 0) {
      if (!this.ctx || !this.masterGain) return;

      const now = this.ctx.currentTime;
      // Increased safety buffer to 40ms to prevent glitches during main thread blocks
      const t = Math.max(now, now + delay + 0.04);
      
      const p = this.currentProfile;

      // 1. Intelligent Voice Allocation (Self-Stealing)
      // If we are playing the SAME note, steal the old voice to prevent phasing and buildup.
      for (const v of this.activeVoices) {
          if (Math.abs(v.freq - freq) < 1.0) { // Approx same frequency
              // Very fast fade for re-trigger
              this.killVoice(v, t, 0.04); 
          }
      }

      // 2. Polyphony Limiting
      if (this.activeVoices.size >= this.MAX_POLYPHONY) {
          const iter = this.activeVoices.values();
          let oldest = iter.next().value;
          for (const voice of iter) {
              if (voice.startTime < oldest.startTime) oldest = voice;
          }
          if (oldest) {
              this.killVoice(oldest, t, 0.1); 
          }
      }

      // 3. Node Creation
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();
      const panner = this.ctx.createStereoPanner();
      const distortion = p.distortion > 0 ? this.ctx.createWaveShaper() : null;

      // 4. Oscillator Config
      osc1.type = p.oscillatorType as OscillatorType;
      osc1.frequency.setValueAtTime(freq, t);
      osc1.detune.setValueAtTime(p.detune || 0, t);

      osc2.type = p.oscillatorType === 'sine' ? 'triangle' : 'sine'; 
      if (p.oscillatorType === 'square' || p.oscillatorType === 'sawtooth') {
          osc2.type = 'triangle'; // Smoother sub for harsh leads
      }
      
      osc2.frequency.setValueAtTime(freq, t);
      osc2.detune.setValueAtTime(-(p.detune || 0), t);

      // Volume compensation - Significantly reduced for Sawtooth/Square to prevent compressor slamming
      let typeVolume = 1.0;
      if (p.oscillatorType === 'square') typeVolume = 0.35; 
      if (p.oscillatorType === 'sawtooth') typeVolume = 0.3;

      // 5. Filter Config
      filter.type = p.oscillatorType === 'sawtooth' && p.distortion > 0.3 ? 'lowpass' : 'lowpass';
      // Adjust filter based on adrenaline, but cap it to avoid ear fatigue
      const baseFreq = Math.min(12000, p.filterFreq + (this.adrenalineLevel * 500));
      filter.frequency.setValueAtTime(baseFreq, t);
      filter.Q.setValueAtTime(p.filterQ, t);
      
      // Filter Envelope
      if (filter.type === 'lowpass') {
        filter.frequency.linearRampToValueAtTime(baseFreq + 1000, t + p.attack);
        filter.frequency.exponentialRampToValueAtTime(Math.max(100, baseFreq), t + p.attack + p.decay + p.release);
      }

      // 6. Distortion Config
      if (distortion && p.distortion > 0) {
          distortion.curve = this.makeDistortionCurve(p.distortion * 50);
          distortion.oversample = '2x';
      }

      // 7. Routing
      osc1.connect(filter);
      osc2.connect(filter);
      
      if (distortion) {
          filter.connect(distortion);
          distortion.connect(gain);
      } else {
          filter.connect(gain);
      }

      gain.connect(panner);
      panner.connect(this.masterGain);

      // 8. Panning
      panner.pan.value = pan;

      // 9. Amplitude Envelope (ADSR)
      const attackTime = Math.max(0.01, p.attack); 
      const peakGain = velocity * 0.5 * typeVolume;
      const sustainGain = Math.max(0.001, p.sustain * peakGain);
      
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(peakGain, t + attackTime);
      gain.gain.exponentialRampToValueAtTime(sustainGain, t + attackTime + p.decay);
      
      const releaseStart = t + attackTime + p.decay;
      const releaseEnd = releaseStart + p.release;
      
      // RELEASE
      gain.gain.setValueAtTime(sustainGain, releaseStart);
      gain.gain.exponentialRampToValueAtTime(0.001, releaseEnd);
      
      // Use setTargetAtTime for the final silence to ensure it reaches 0 smoothly
      gain.gain.setTargetAtTime(0, releaseEnd, 0.05);

      // Start/Stop
      osc1.start(t);
      osc2.start(t);
      // Stop oscillators after gain is completely zero + buffer
      osc1.stop(releaseEnd + 0.2); 
      osc2.stop(releaseEnd + 0.2);

      const voice = { oscillators: [osc1, osc2], gain, filter, panner, startTime: t, freq };
      this.activeVoices.add(voice);

      osc1.onended = () => {
          this.activeVoices.delete(voice);
          try {
              // Aggressive Disconnection to prevent Memory Leaks
              gain.disconnect();
              panner.disconnect();
              filter.disconnect();
              osc1.disconnect();
              osc2.disconnect();
              if (distortion) distortion.disconnect();
          } catch(e) {}
      };
  }

  private killVoice(voice: { oscillators: OscillatorNode[], gain: GainNode }, t: number, fadeDuration: number = 0.1) {
      try {
        voice.gain.gain.cancelScheduledValues(t);
        // CRITICAL FIX: Use setTargetAtTime instead of linearRamp. 
        // linearRamp requires a known start value. Accessing .value on the main thread 
        // returns the base value, causing pops during ADSR envelopes. 
        // setTargetAtTime smoothly decays from *wherever* the gain currently is.
        voice.gain.gain.setTargetAtTime(0, t, fadeDuration * 0.3); // Time constant approx 1/3 of duration
        
        voice.oscillators.forEach(osc => {
             try { osc.stop(t + fadeDuration + 0.05); } catch(e){}
        });
        
        // We remove from the set immediately so we can spawn new notes, 
        // but the audio nodes persist in the graph until onended fires.
        this.activeVoices.delete(voice as any);
      } catch(e) {}
  }
  
  // Microphone and Recording methods
  public async enableMicrophone(enabled: boolean) {
      if (!this.ctx) await this.start();
      if (!this.ctx) return;

      if (enabled) {
          try {
              const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
              this.micNode = this.ctx.createMediaStreamSource(stream);
              this.micGain = this.ctx.createGain();
              this.micGain.gain.value = 0.8; 
              
              this.micNode.connect(this.micGain);
              
              if (this.wetNode) this.micGain.connect(this.wetNode); 
              if (this.delaySendNode) this.micGain.connect(this.delaySendNode);
          } catch (e) {
              console.error("Mic error", e);
          }
      } else {
          if (this.micNode) {
              this.micNode.disconnect();
              this.micNode = null;
          }
      }
  }

  public startRecording(canvasStream: MediaStream) {
     if (!this.destNode || !this.ctx) return;
     if (this.mediaRecorder && this.mediaRecorder.state === 'recording') return;
     this.recordedChunks = [];
     const audioTrack = this.destNode.stream.getAudioTracks()[0];
     const combinedStream = new MediaStream([...canvasStream.getTracks(), audioTrack]);
     const options = MediaRecorder.isTypeSupported('video/webm; codecs=vp9') 
        ? { mimeType: 'video/webm; codecs=vp9' } 
        : { mimeType: 'video/webm' };
     try {
          this.mediaRecorder = new MediaRecorder(combinedStream, options);
          this.mediaRecorder.ondataavailable = (e) => {
              if (e.data.size > 0) this.recordedChunks.push(e.data);
          };
          this.mediaRecorder.start();
      } catch (e) {
          console.error("Recording failed to start", e);
      }
  }

  public async stopRecording(): Promise<Blob> {
      return new Promise((resolve) => {
          if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
              return resolve(new Blob(this.recordedChunks, { type: 'video/webm' }));
          }
          this.mediaRecorder.onstop = () => {
              const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
              this.recordedChunks = [];
              resolve(blob);
          };
          this.mediaRecorder.stop();
      });
  }
}

export const audioEngine = new AudioEngine();