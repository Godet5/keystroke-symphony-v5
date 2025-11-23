import React, { useEffect, useRef } from 'react';
import { Particle } from '../types';

interface VisualizerProps {
  active: boolean;
  trigger: number; 
  cursorPosition: { x: number, y: number } | null;
  theme: string;
  intensity: number;
  onCanvasRef?: (canvas: HTMLCanvasElement) => void;
}

const Visualizer: React.FC<VisualizerProps> = ({ active, trigger, cursorPosition, theme, intensity, onCanvasRef }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const frameRef = useRef<number>(0);

  const getThemeColors = (themeStr: string): string[] => {
    // Obsidian & Amber Palette with Cyber Accents
    return ['#F59E0B', '#FCD34D', '#D97706', '#FFFFFF', '#00f3ff'];
  };

  // Expose ref
  useEffect(() => {
      if (canvasRef.current && onCanvasRef) {
          onCanvasRef(canvasRef.current);
      }
  }, [onCanvasRef]);

  useEffect(() => {
    if (!cursorPosition) return;
    
    const palette = getThemeColors(theme);
    // More particles for higher intensity
    const baseCount = 5; 
    const count = Math.floor(baseCount * Math.max(1, intensity));
    
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      // Explosion velocity influenced by intensity
      const speed = (Math.random() * 3 + 2) * Math.sqrt(intensity); 
      
      const color = palette[Math.floor(Math.random() * palette.length)];

      particlesRef.current.push({
        id: Math.random(),
        x: cursorPosition.x,
        y: cursorPosition.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1.0, // Start at full opacity
        color: color,
        size: (Math.random() * 4 + 2) * intensity
      });
    }
  }, [trigger, cursorPosition, theme, intensity]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', resize);
    resize();

    const animate = () => {
      const w = canvas.width;
      const h = canvas.height;

      // 1. Clear Screen with specific fade for trail effect
      // Higher intensity = slower fade (longer trails)
      const fadeAlpha = Math.max(0.1, 0.25 - (intensity * 0.05));
      ctx.fillStyle = `rgba(5, 5, 5, ${fadeAlpha})`;
      ctx.fillRect(0, 0, w, h);

      // 2. Draw Moving Grid (Cyberpunk Feel)
      const time = Date.now() / 1000;
      const gridSize = 60;
      const offset = (time * 20) % gridSize;
      
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.03)'; // Very faint amber
      
      // Vertical lines
      for(let x = 0; x < w; x += gridSize) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, h);
          ctx.stroke();
      }
      // Horizontal moving lines
      for(let y = offset; y < h; y += gridSize) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(w, y);
          ctx.stroke();
      }

      // 3. Update & Draw Particles
      // We'll use a double loop for connections (optimization: limit check distance)
      const particles = particlesRef.current;
      
      // Update Physics
      particles.forEach((p, index) => {
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.015; 
        p.size *= 0.97;
        p.vx *= 0.95; // Drag
        p.vy *= 0.95; // Drag

        if (p.life <= 0) {
          particles.splice(index, 1);
        }
      });

      // Draw Connections
      ctx.lineWidth = 0.5;
      for (let i = 0; i < particles.length; i++) {
          const p1 = particles[i];
          for (let j = i + 1; j < particles.length; j++) {
              const p2 = particles[j];
              const dx = p1.x - p2.x;
              const dy = p1.y - p2.y;
              const dist = Math.sqrt(dx*dx + dy*dy);
              
              if (dist < 100) {
                  const alpha = (1 - dist / 100) * Math.min(p1.life, p2.life);
                  ctx.strokeStyle = `rgba(245, 158, 11, ${alpha})`;
                  ctx.beginPath();
                  ctx.moveTo(p1.x, p1.y);
                  ctx.lineTo(p2.x, p2.y);
                  ctx.stroke();
              }
          }
      }

      // Draw Particles with Glow
      particles.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        
        // Neon Glow Effect
        ctx.shadowBlur = 15 * intensity;
        ctx.shadowColor = p.color;
        
        ctx.globalAlpha = p.life;
        ctx.fill();
        
        // Reset shadow for next operations
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
      });

      frameRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(frameRef.current);
    };
  }, [active, theme, intensity]);

  return (
    <canvas 
      ref={canvasRef} 
      className="fixed inset-0 pointer-events-none z-0"
    />
  );
};

export default Visualizer;