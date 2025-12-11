import React, { useEffect, useRef } from 'react';

const Background: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Impostiamo le dimensioni iniziali
    let width = window.innerWidth;
    let height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;

    // Caratteri Matrix + $CAP
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ$CAP';
    const fontSize = 14; 
    const columns = Math.ceil(width / fontSize);
    
    // Array per la posizione delle gocce (Y)
    const drops: number[] = new Array(columns).fill(1);

    const draw = () => {
      // 1. Disegna un rettangolo nero semitrasparente su tutto il canvas
      // Questo crea l'effetto "scia" (fade out) dei caratteri precedenti
      ctx.fillStyle = 'rgba(5, 5, 5, 0.1)'; 
      ctx.fillRect(0, 0, width, height);

      // 2. Imposta il colore e il font del testo
      ctx.fillStyle = '#39ff14'; // Verde Neon Matrix
      ctx.font = `${fontSize}px monospace`;

      // 3. Cicla su ogni colonna (goccia)
      for (let i = 0; i < drops.length; i++) {
        // Scegli un carattere a caso
        const text = chars.charAt(Math.floor(Math.random() * chars.length));
        
        // Disegna il carattere
        ctx.fillText(text, i * fontSize, drops[i] * fontSize);

        // 4. Reset della goccia
        // Se la goccia è uscita dallo schermo (Y > height) E un fattore random è vero
        // la riportiamo in alto (Y = 0)
        if (drops[i] * fontSize > height && Math.random() > 0.975) {
          drops[i] = 0;
        }

        // Incrementa la coordinata Y della goccia
        drops[i]++;
      }
    };

    // Avvia il loop a 30fps (33ms)
    const interval = setInterval(draw, 33);

    // Gestione ridimensionamento finestra
    const handleResize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
    };

    window.addEventListener('resize', handleResize);

    // Pulizia quando il componente viene smontato
    return () => {
      clearInterval(interval);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <canvas 
      ref={canvasRef} 
      style={{
        position: 'fixed', // Fisso rispetto allo schermo
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 0, // Dietro al contenuto (che ha z-10) ma davanti al body
        pointerEvents: 'none', // Non blocca i click
        background: '#050505' // Colore di base se il canvas non carica subito
      }}
    />
  );
};

export default Background;