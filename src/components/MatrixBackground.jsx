import React, { useEffect, useRef } from 'react';

const hexToRgb = (hex) => {
  const bigint = parseInt(hex.slice(1), 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `${r},${g},${b}`;
};

const MatrixBackground = ({ connectionStatus }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    const getColor = (status) => {
      switch (status) {
        case 'success':
          return '#10B981'; // Emerald
        case 'error':
          return '#EF4444'; // Red
        case 'testing':
          return '#F59E0B'; // Amber
        default:
          return '#4F46E5'; // Indigo (default/idle)
      }
    };

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', resize);
    resize();

    // Characters to use in the stream (Mix of crypto and binary)
    const characters = '₿ÐΞ$01'.split('');
    const fontSize = 16;
    const columns = canvas.width / fontSize;
    const drops = Array(Math.floor(columns)).fill(1);

    let animationFrameId;
    let lastFrameTime = 0;
    const frameRate = 35; // ms per frame, roughly 30 FPS

    const draw = (currentTime) => {
      if (!lastFrameTime) lastFrameTime = currentTime;
      const elapsed = currentTime - lastFrameTime;

      if (elapsed > frameRate) {
        lastFrameTime = currentTime - (elapsed % frameRate);

        // Semi-transparent black to create the trail effect
        ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Base color from connection status
        const baseColor = getColor(connectionStatus);
        let finalFillStyle = baseColor;

        if (connectionStatus === 'testing') {
          // Create a pulsing effect for the alpha channel
          // Oscillate between 0.6 and 1.0 for the text color's alpha
          const pulseFactor = (Math.sin(currentTime * 0.005) + 1) / 2; // 0 to 1
          const minAlpha = 0.6; // Minimum alpha for pulsing text
          const maxAlpha = 1.0; // Maximum alpha for pulsing text
          const currentAlpha = minAlpha + (maxAlpha - minAlpha) * pulseFactor;

          finalFillStyle = `rgba(${hexToRgb(baseColor)}, ${currentAlpha})`;
        }

        ctx.fillStyle = finalFillStyle;
        ctx.font = `${fontSize}px monospace`;

        for (let i = 0; i < drops.length; i++) {
          const text = characters[Math.floor(Math.random() * characters.length)];
          ctx.fillText(text, i * fontSize, drops[i] * fontSize);

          // Randomly reset drop to top after it reaches bottom
          if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
            drops[i] = 0;
          }
          drops[i]++;
        }
      }
      animationFrameId = requestAnimationFrame(draw);
    };

    animationFrameId = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', resize);
    };
  }, [connectionStatus]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-[-1] pointer-events-none opacity-[0.15] dark:opacity-[0.08]"
    />
  );
};

export default MatrixBackground;
