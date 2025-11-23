import { GoogleGenAI, Type } from "@google/genai";
import { SongConfig, AnalysisResult, TypingStats, AppMode } from '../types';

// Safely retrieve API key, handling environments where process is undefined
const getApiKey = () => {
  try {
    return (typeof process !== 'undefined' && process.env?.API_KEY) || '';
  } catch (e) {
    return '';
  }
};

const apiKey = getApiKey();
const ai = new GoogleGenAI({ apiKey });

export const generateSongConfig = async (theme: string, mode: AppMode): Promise<SongConfig> => {
  try {
    const model = 'gemini-2.5-flash';
    
    let systemInstruction = 'You are Keystroke Symphony, an AI mentor for rhythm and sound design. Your aesthetic is Obsidian (Dark) and Amber (Gold).';
    let prompt = '';
    
    if (mode === AppMode.CURRICULUM) {
        // Note: Curriculum usually uses static data, this is a fallback for dynamic generation
        prompt = `Generate a "Practice" level typing challenge based on the theme: "${theme}".
        Text should be poetic, rhythmic, and focus on flow. 
        Return JSON with text, mood, tempo, and a soundProfile.`;
    } else {
        prompt = `Create a soundscape for free improvisation based on: "${theme}".
        The user will type to create music. 
        Return JSON with mood, tempo, and a sophisticated soundProfile.`;
    }

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
        temperature: 1.1, 
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            text: { type: Type.STRING },
            mood: { type: Type.STRING },
            tempo: { type: Type.NUMBER },
            soundProfile: {
                type: Type.OBJECT,
                properties: {
                    oscillatorType: { type: Type.STRING, enum: ["sine", "square", "sawtooth", "triangle"] },
                    attack: { type: Type.NUMBER },
                    decay: { type: Type.NUMBER },
                    sustain: { type: Type.NUMBER },
                    release: { type: Type.NUMBER },
                    filterFreq: { type: Type.NUMBER },
                    filterQ: { type: Type.NUMBER },
                    distortion: { type: Type.NUMBER },
                    reverbMix: { type: Type.NUMBER },
                },
                required: ["oscillatorType", "attack", "decay", "sustain", "release", "filterFreq", "filterQ", "distortion", "reverbMix"]
            }
          },
          required: ["text", "mood", "tempo", "soundProfile"],
        },
      },
    });

    if (response.text) {
      const data = JSON.parse(response.text);
      return {
        theme,
        text: data.text || "",
        mood: data.mood,
        tempo: data.tempo,
        soundProfile: data.soundProfile
      };
    }
    throw new Error("No response text");
  } catch (error) {
    console.error("Gemini error", error);
    return {
        theme: "Offline Mode",
        text: "The connection to the ether is silent. We continue within.",
        mood: "Internal",
        tempo: 80,
        soundProfile: { oscillatorType: 'sine', attack: 0.1, decay: 0.4, sustain: 0.2, release: 0.8, filterFreq: 1000, filterQ: 1, distortion: 0, reverbMix: 0.5 }
    }
  }
};

export const analyzePerformance = async (stats: TypingStats, song: SongConfig): Promise<AnalysisResult> => {
    try {
        const model = 'gemini-2.5-flash';
        const prompt = `As a rhythmic mentor, analyze this session:
        Theme: ${song.theme}
        Stats: ${stats.wpm} WPM, ${stats.accuracy}% Accuracy.
        
        Provide a critique on their 'flow' and 'mindfulness' rather than just speed. 
        Give a 'Symphony Score' out of 100 based on consistency.`;

        const response = await ai.models.generateContent({
            model,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        title: { type: Type.STRING },
                        critique: { type: Type.STRING },
                        score: { type: Type.NUMBER }
                    },
                    required: ["title", "critique", "score"]
                }
            }
        });

        if (response.text) {
            return JSON.parse(response.text) as AnalysisResult;
        }
        throw new Error("No analysis text");
    } catch (error) {
        return {
            title: "Silent Observer",
            critique: "The mentor is silent, but your rhythm speaks for itself.",
            score: Math.round(stats.accuracy)
        };
    }
}