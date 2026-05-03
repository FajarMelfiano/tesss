/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Camera, RefreshCcw, Hand, AlertCircle } from 'lucide-react';

// Game Constants
const CANVAS_WIDTH = 640;
const CANVAS_HEIGHT = 480;
const PLAYER_RADIUS = 15;
const ENEMY_BASE_RADIUS = 12;
const SPAWN_INTERVAL_MIN = 700;
const SPAWN_INTERVAL_MAX = 1000;
const SMOOTHING_FACTOR = 0.25; // Lower = smoother but slower response

interface GameObject {
  x: number;
  y: number;
  radius: number;
  speed: number;
}

export default function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<'loading' | 'start' | 'playing' | 'gameover'>('loading');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [isHit, setIsHit] = useState(false);

  // Game state refs for the loop (avoiding closure issues and re-renders)
  const playerPosRef = useRef({ x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 });
  const targetPosRef = useRef({ x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 });
  const enemiesRef = useRef<GameObject[]>([]);
  const lastSpawnTimeRef = useRef(0);
  const scoreRef = useRef(0);
  const requestRef = useRef<number>(0);
  const handsRef = useRef<any>(null);

  useEffect(() => {
    // Initialize MediaPipe Hands
    // @ts-ignore
    if (!window.Hands || !window.Camera) {
      console.error('MediaPipe libraries not loaded');
      return;
    }

    // @ts-ignore
    const hands = new window.Hands({
      locateFile: (file: string) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
      }
    });

    hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    });

    hands.onResults((results: any) => {
      if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const landmarks = results.multiHandLandmarks[0];
        // Index Finger Tip is landmark 8
        const indexTip = landmarks[8];
        
        // Map normalized coordinates (0-1) to canvas dimensions
        // Flip X because camera is mirrored
        targetPosRef.current = {
          x: (1 - indexTip.x) * CANVAS_WIDTH,
          y: indexTip.y * CANVAS_HEIGHT
        };
      }
    });

    handsRef.current = hands;

    if (videoRef.current) {
      // @ts-ignore
      const camera = new window.Camera(videoRef.current, {
        onFrame: async () => {
          await hands.send({ image: videoRef.current! });
        },
        width: 640,
        height: 480
      });
      camera.start().then(() => {
        setGameState('start');
      });
    }

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      if (handsRef.current) handsRef.current.close();
    };
  }, []);

  const startGame = () => {
    enemiesRef.current = [];
    scoreRef.current = 0;
    setScore(0);
    setIsHit(false);
    lastSpawnTimeRef.current = performance.now();
    playerPosRef.current = { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 };
    setGameState('playing');
    requestRef.current = requestAnimationFrame(gameLoop);
  };

  const spawnEnemy = (currentTime: number) => {
    const timeSinceLastSpawn = currentTime - lastSpawnTimeRef.current;
    // Dynamic difficulty: Spawn faster and enemies move faster as score increases
    const currentSpawnDelay = Math.max(
      400,
      SPAWN_INTERVAL_MAX - (scoreRef.current / 10)
    );

    if (timeSinceLastSpawn > currentSpawnDelay) {
      const radius = ENEMY_BASE_RADIUS + Math.random() * 10;
      const x = Math.random() * (CANVAS_WIDTH - radius * 2) + radius;
      const speed = 3 + Math.random() * 2 + (scoreRef.current / 200);

      enemiesRef.current.push({
        x,
        y: -radius,
        radius,
        speed
      });
      lastSpawnTimeRef.current = currentTime;
    }
  };

  const gameLoop = (currentTime: number) => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;

    // 1. Update Player Position (Smoothing)
    playerPosRef.current.x += (targetPosRef.current.x - playerPosRef.current.x) * SMOOTHING_FACTOR;
    playerPosRef.current.y += (targetPosRef.current.y - playerPosRef.current.y) * SMOOTHING_FACTOR;

    // Bound player to canvas
    playerPosRef.current.x = Math.max(PLAYER_RADIUS, Math.min(CANVAS_WIDTH - PLAYER_RADIUS, playerPosRef.current.x));
    playerPosRef.current.y = Math.max(PLAYER_RADIUS, Math.min(CANVAS_HEIGHT - PLAYER_RADIUS, playerPosRef.current.y));

    // 2. Update Enemies & Check Collisions
    spawnEnemy(currentTime);
    
    let gameOver = false;
    enemiesRef.current = enemiesRef.current.filter((enemy) => {
      enemy.y += enemy.speed;

      // Collision Check (Circle vs Circle)
      const dx = enemy.x - playerPosRef.current.x;
      const dy = enemy.y - playerPosRef.current.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < enemy.radius + PLAYER_RADIUS) {
        gameOver = true;
      }

      // Remove enemies that fall off screen
      return enemy.y < CANVAS_HEIGHT + enemy.radius;
    });

    // 3. Clear & Render
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    // Draw trail-like background or subtle scanlines (optional visual)
    ctx.fillStyle = 'rgba(0, 0, 0, 1)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw Grid (Minimalist touch)
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 1;
    for (let i = 0; i < CANVAS_WIDTH; i += 40) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, CANVAS_HEIGHT); ctx.stroke();
    }
    for (let i = 0; i < CANVAS_HEIGHT; i += 40) {
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(CANVAS_WIDTH, i); ctx.stroke();
    }

    // Draw Enemies
    ctx.fillStyle = '#ff4d4d';
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#ff4d4d';
    enemiesRef.current.forEach(enemy => {
      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
      ctx.fill();
    });

    // Draw Player (Indicator of hand position)
    ctx.fillStyle = '#ffffff';
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#ffffff';
    ctx.beginPath();
    ctx.arc(playerPosRef.current.x, playerPosRef.current.y, PLAYER_RADIUS, 0, Math.PI * 2);
    ctx.fill();

    // Reset shadow for text
    ctx.shadowBlur = 0;

    // Update Score
    scoreRef.current += 1;
    setScore(Math.floor(scoreRef.current / 10));

    if (gameOver) {
      handleGameOver();
    } else {
      requestRef.current = requestAnimationFrame(gameLoop);
    }
  };

  const handleGameOver = () => {
    setIsHit(true);
    setTimeout(() => {
      setGameState('gameover');
      setHighScore(prev => Math.max(prev, Math.floor(scoreRef.current / 10)));
    }, 300);
  };

  return (
    <div className={`min-h-screen bg-[#050505] text-[#e0e0e0] font-mono flex flex-col items-center justify-center p-4 overflow-hidden select-none transition-colors duration-200 ${isHit ? 'hit-flash' : ''}`}>
      
      {/* HUD: Score and Stats */}
      <div className="fixed top-10 left-10 z-20 hidden md:block">
        <div className="text-[10px] uppercase tracking-[0.4em] text-white/30 mb-1">Current Session</div>
        <div className="text-6xl font-light tracking-tighter">
          {score.toString().padStart(4, '0')}
        </div>
      </div>

      <div className="fixed top-10 right-10 z-20 text-right hidden md:block">
        <div className="text-[10px] uppercase tracking-[0.4em] text-white/30 mb-1">Status</div>
        <div className="flex items-center gap-2 justify-end">
          <div className={`w-2 h-2 rounded-full ${gameState === 'playing' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-red-500 animate-pulse'} `}></div>
          <div className="text-xs uppercase tracking-widest">
            {gameState === 'playing' ? 'Tracking Active' : 'System Standby'}
          </div>
        </div>
      </div>

      {/* Mobile HUD (Fallback) */}
      <div className="md:hidden w-full flex justify-between items-start mb-8 max-w-[640px] px-2">
        <div>
          <div className="text-[8px] uppercase tracking-widest text-white/30 mb-1">Score</div>
          <div className="text-4xl font-light">{score.toString().padStart(4, '0')}</div>
        </div>
        <div className="text-right">
          <div className="text-[8px] uppercase tracking-widest text-white/30 mb-1">Status</div>
          <div className="text-[10px] uppercase tracking-widest">Active</div>
        </div>
      </div>

      <div className="relative z-10 w-full max-w-4xl flex flex-col items-center">
        {/* Game Container */}
        <div className="relative p-1 bg-white/5 border border-white/5 shadow-[0_0_100px_rgba(255,255,255,0.03)]">
          <div className="absolute -top-6 left-0 text-[9px] uppercase tracking-widest text-white/30 flex items-center gap-2">
            <span className="w-1 h-1 bg-white/20 rounded-full animate-ping" />
            Index_Finger_Coord_Stream
          </div>

          {/* WebCam Feed (Stylized thumbnail) */}
          <div className="absolute -bottom-6 right-0 w-32 h-24 border border-white/10 overflow-hidden z-20 bg-black mt-2">
             <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              className="w-full h-full object-cover scale-x-[-1] opacity-50 grayscale"
            />
            <div className="absolute bottom-1 left-1 bg-black/60 px-1 text-[7px] uppercase tracking-tighter text-white/50">
              Input_Feed
            </div>
            <div className="absolute top-0 right-0 w-full h-[1px] bg-white/10 animate-[scan_3s_linear_infinite]" />
          </div>

          {/* Game Canvas */}
          <canvas 
            ref={canvasRef} 
            width={CANVAS_WIDTH} 
            height={CANVAS_HEIGHT}
            className="bg-[#0a0a0a] block cursor-none transition-shadow duration-500"
          />

          {/* UI Overlays */}
          <AnimatePresence>
            {gameState === 'loading' && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-[#050505] flex flex-col items-center justify-center gap-4 z-50"
              >
                <div className="w-12 h-[1px] bg-white/20 relative overflow-hidden">
                  <div className="absolute inset-0 bg-white animate-[loading_1.5s_infinite]" />
                </div>
                <p className="font-mono text-white/30 text-[9px] uppercase tracking-[0.3em]">Initializing Link...</p>
              </motion.div>
            )}

            {(gameState === 'start' || gameState === 'gameover') && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center text-center p-8 z-40"
              >
                <motion.div 
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  className="space-y-8"
                >
                  <div className="space-y-2">
                    <h2 className="text-4xl font-light tracking-[0.3em] uppercase text-white">
                      {gameState === 'gameover' ? 'System Failure' : 'Nerve Control'}
                    </h2>
                    <div className="h-[1px] w-12 bg-white/20 mx-auto" />
                    <p className="text-[10px] text-white/40 max-w-xs mx-auto leading-relaxed uppercase tracking-widest pt-2">
                      {gameState === 'gameover' 
                        ? `Terminal impact detected. Final Score: ${score}`
                        : "Avoid the red fragments using your index finger. Precision is survival."
                      }
                    </p>
                  </div>
                  
                  {gameState === 'gameover' && (
                    <div className="text-[10px] uppercase tracking-widest text-[#ff4d4d] mb-4">
                      High Score: {highScore.toString().padStart(4, '0')}
                    </div>
                  )}

                  <button 
                    onClick={startGame}
                    className="px-10 py-4 border border-white/20 hover:bg-white hover:text-black transition-all text-[10px] tracking-[0.5em] uppercase font-bold"
                  >
                    {gameState === 'gameover' ? 'Re-Initialize' : 'Initialize Link'}
                  </button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Visual Accents / Tech Logs */}
        <div className="mt-16 w-full flex justify-between items-end px-2 opacity-40">
          <div className="text-[10px] text-white/20 leading-loose uppercase tracking-[0.2em] font-light">
            [X_RES] 640px<br />
            [Y_RES] 480px<br />
            [INPUT] GESTURE_V1
          </div>
          
          <div className="flex flex-col items-end">
            <div className="text-[9px] text-white/30 tracking-widest uppercase italic mb-1">System_Stable</div>
            <div className="w-48 h-[1px] bg-white/10 relative">
              <motion.div 
                className="absolute top-0 left-0 h-full bg-white/30"
                animate={{ width: ['0%', '100%'] }}
                transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
              />
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="mt-12 flex gap-12 border-t border-white/5 pt-8 opacity-20 hover:opacity-100 transition-opacity duration-500">
           <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-white" />
            <span className="text-[9px] uppercase tracking-widest">Biometric_Node</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-[#ff4d4d]" />
            <span className="text-[9px] uppercase tracking-widest">Foreign_Fragment</span>
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes scan {
          from { transform: translateY(-100%); }
          to { transform: translateY(300%); }
        }
        @keyframes loading {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}} />
    </div>
  );
}
