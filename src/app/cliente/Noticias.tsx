"use client";

import React, { useEffect, useRef } from "react";
import "./Noticias/Noticias.scss";

const MENSAJE = "Anticipamos un saludo especial a quienes hacen posible nuestro crecimiento día con día";

interface Heart {
  x: number;
  y: number;
  s: number;
  v: number;
  o: number;
  r: number;
  vr: number;
  c: string;
  swing: number; // Nuevo: Para el balanceo lateral
  swingSpeed: number;
}

function TrainMini() {
  return (
    <div className="trainMini-scaleWrapper">
      <div className="trainMini-locomotive">
        <div className="trainMini-chimney">
          <div className="trainMini-smoke s1" />
          <div className="trainMini-smoke s2" />
        </div>
        <div className="trainMini-engineBody" />
        <div className="trainMini-engineFront" />
        <div className="trainMini-wheelsContainer">
          <div className="trainMini-wheel w1" />
          <div className="trainMini-wheel w2" />
          <div className="trainMini-joint" />
        </div>
      </div>
    </div>
  );
}

export default function Noticias() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true }) as CanvasRenderingContext2D;
    if (!ctx) return;

    const heartPath = new Path2D(
      'M0 2.5 C 1.25 -2.5, 5 -1.25, 0 5 C -5 -1.25, -1.25 -2.5, 0 2.5'
    );

    let hearts: Heart[] = [];
    let animationId: number;

    const init = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);

      const count = Math.min(Math.floor(rect.width / 60), 20);
      // Paleta de colores más elegante (Rosas pastel y corales)
      const colors = ['#ff8080', '#ff0000', '#d30000', '#FFB1C1'];

      hearts = Array.from({ length: count }, () => ({
        x: Math.random() * rect.width,
        y: Math.random() * rect.height,
        s: Math.random() * 12 + 8,
        v: Math.random() * 0.4 + 0.2,
        o: Math.random() * 0.5 + 0.3,
        r: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.01,
        c: colors[Math.floor(Math.random() * colors.length)],
        swing: Math.random() * Math.PI * 2,
        swingSpeed: Math.random() * 0.02 + 0.01
      }));
    };

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;

      for (const heart of hearts) {
        heart.y += heart.v;
        heart.r += heart.vr;
        heart.swing += heart.swingSpeed;
        
        // Aplicamos un ligero movimiento en X para que no caiga recto
        const currentX = heart.x + Math.sin(heart.swing) * 15;

        if (heart.y > h + 20) {
          heart.y = -20;
          heart.x = Math.random() * w;
        }

        ctx.save();
        ctx.translate(currentX, heart.y);
        ctx.rotate(heart.r);
        ctx.scale(heart.s / 5, heart.s / 5);

        // --- MEJORA DE DISEÑO: Gradiente y Sombra ---
        // Sombra (Glow)
        ctx.shadowBlur = 15;
        ctx.shadowColor = heart.c;
        
        // Gradiente radial para efecto de volumen
        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, 5);
        grad.addColorStop(0, '#FFFFFF'); // Centro brillante
        grad.addColorStop(0.4, heart.c); // Color base
        grad.addColorStop(1, heart.c);

        ctx.fillStyle = grad;
        ctx.globalAlpha = heart.o;
        ctx.fill(heartPath);
        ctx.restore();
      }
      animationId = requestAnimationFrame(render);
    };

    const handleResize = () => init();
    window.addEventListener('resize', handleResize, { passive: true });
    init();
    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <div className="newsBar" style={{ position: 'relative', overflow: 'hidden', background: 'linear-gradient(90deg, #fff5f5 0%, #ffffff 50%, #fff5f5 100%)' }}>
      <canvas 
        ref={canvasRef}
        style={{ 
          position: 'absolute', 
          top: 0, 
          left: 0, 
          width: '100%', 
          height: '100%', 
          pointerEvents: 'none', 
          zIndex: 2,
          transform: 'translateZ(0)',
          opacity:0.3
        }}
      />

      <div className="newsBar-track" style={{ position: 'relative', zIndex: 1 }}>
        <div className="newsBar-strip">
          <TrainMini />
          <div className="newsCar">
            <span className="newsCar-label">INFO</span>
            <span className="newsCar-text">{MENSAJE}</span>
          </div>
        </div>

        <div className="newsBar-strip">
          <TrainMini />
          <div className="newsCar">
            <span className="newsCar-label">INFO</span>
            <span className="newsCar-text">{MENSAJE}</span>
          </div>
        </div>
      </div>
      <div className="shineLabel"></div>
    </div>
  );
}