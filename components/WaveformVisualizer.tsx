import React, { useRef, useEffect } from 'react';

interface WaveformVisualizerProps {
  analyserNode: AnalyserNode | null;
  className?: string;
}

const WaveformVisualizer: React.FC<WaveformVisualizerProps> = ({ analyserNode, className = '' }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!analyserNode || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const canvasCtx = canvas.getContext('2d');
    if (!canvasCtx) return;

    analyserNode.fftSize = 256;
    const bufferLength = analyserNode.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    let animationFrameId: number;

    const draw = () => {
      animationFrameId = requestAnimationFrame(draw);
      
      analyserNode.getByteFrequencyData(dataArray);

      // Reset canvas by clearing the rectangle
      canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
      
      const barWidth = canvas.width / bufferLength;
      let barHeight;
      let x = 0;
      
      const barColor = 'rgba(255, 255, 255, 0.7)';

      for (let i = 0; i < bufferLength; i++) {
        barHeight = (dataArray[i] / 255) * canvas.height;
        
        canvasCtx.fillStyle = barColor;
        canvasCtx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);

        x += barWidth;
      }
    };

    draw();

    return () => {
      cancelAnimationFrame(animationFrameId);
      // Clear canvas on cleanup to ensure no artifacts are left
      const ctx = canvasRef.current?.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    };
  }, [analyserNode]);

  return <canvas ref={canvasRef} className={className} width="128" height="32" />;
};

export default WaveformVisualizer;
