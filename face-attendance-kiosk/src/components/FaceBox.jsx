import React, { useEffect, useRef } from 'react';

/**
 * Canvas overlay that draws face detection boxes on top of the video.
 *
 * @param {object} props
 * @param {object|null} props.detection - faceapi detection result
 * @param {'red'|'green'} props.color - Box color based on match state
 * @param {HTMLVideoElement} props.videoElement - The video DOM element
 * @param {number} props.width - Canvas width
 * @param {number} props.height - Canvas height
 */
export default function FaceBox({ detection, color = 'red', status, videoElement, width, height }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!detection || !videoElement) return;

    const displaySize = { width, height };
    const { x, y, width: bw, height: bh } = detection.detection.box;

    // Scale detection box to canvas size
    const scaleX = displaySize.width / videoElement.videoWidth;
    const scaleY = displaySize.height / videoElement.videoHeight;

    const sx = x * scaleX;
    const sy = y * scaleY;
    const sw = bw * scaleX;
    const sh = bh * scaleY;

    const isGreen = color === 'green';
    const boxColor = isGreen ? '#39ff78' : '#ff4040';
    const glowColor = isGreen ? 'rgba(57, 255, 120, 0.4)' : 'rgba(255, 64, 64, 0.4)';

    // Glow effect
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 16;

    // Draw corner markers (premium look instead of full rectangle)
    const cornerLen = Math.min(sw, sh) * 0.18;
    ctx.strokeStyle = boxColor;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';

    ctx.beginPath();
    // Top-left
    ctx.moveTo(sx + cornerLen, sy);
    ctx.lineTo(sx, sy);
    ctx.lineTo(sx, sy + cornerLen);
    // Top-right
    ctx.moveTo(sx + sw - cornerLen, sy);
    ctx.lineTo(sx + sw, sy);
    ctx.lineTo(sx + sw, sy + cornerLen);
    // Bottom-left
    ctx.moveTo(sx, sy + sh - cornerLen);
    ctx.lineTo(sx, sy + sh);
    ctx.lineTo(sx + cornerLen, sy + sh);
    // Bottom-right
    ctx.moveTo(sx + sw - cornerLen, sy + sh);
    ctx.lineTo(sx + sw, sy + sh);
    ctx.lineTo(sx + sw, sy + sh - cornerLen);
    ctx.stroke();

    // Center dot or Tick mark
    ctx.shadowBlur = 0;
    
    if (isGreen && status === 'checked_in') {
      const centerX = sx + sw / 2;
      const centerY = sy + sh / 2;
      const radius = Math.min(sw, sh) * 0.15;

      // Circle background
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(57, 255, 120, 0.2)';
      ctx.fill();

      // Tick mark
      ctx.beginPath();
      ctx.lineWidth = 4;
      ctx.strokeStyle = boxColor;
      ctx.moveTo(centerX - radius * 0.4, centerY);
      ctx.lineTo(centerX - radius * 0.1, centerY + radius * 0.4);
      ctx.lineTo(centerX + radius * 0.5, centerY - radius * 0.3);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(sx + sw / 2, sy + sh / 2, 3, 0, Math.PI * 2);
      ctx.fillStyle = boxColor;
      ctx.fill();
    }
  }, [detection, color, status, videoElement, width, height]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 2,
      }}
    />
  );
}
