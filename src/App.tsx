/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState, memo, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Camera, RefreshCcw, Hand, AlertCircle, Shield, Zap, Palette, ArrowRight, ArrowLeft } from 'lucide-react';

import { themes, Theme } from './themes';


// Game Constants
const PLAYER_RADIUS = 15;
const ENEMY_BASE_RADIUS = 12;
const SPAWN_INTERVAL_MIN = 800;
const SPAWN_INTERVAL_MAX = 1800;
const SMOOTHING_FACTOR = 0.45;
const DODGE_SENSITIVITY = 1.3;
const MAZE_SENSITIVITY = 0.25; // Decreased sensitivity
const POINTS_PER_LEVEL = 300; 

interface GameObject {
  x: number;
  y: number;
  radius: number;
  speed: number;
  type?: 'enemy' | 'shield' | 'slow' | 'star';
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const webcamCanvasRef = useRef<HTMLCanvasElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<'loading' | 'menu' | 'playing' | 'gameover'>('loading');
  const [gameMode, setGameMode] = useState<'dodge' | 'maze'>('dodge');
  const gameModeRef = useRef<'dodge' | 'maze'>('dodge');
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [combo, setCombo] = useState(0);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [highScore, setHighScore] = useState(0);
  const [isHit, setIsHit] = useState(false);
  const [activePowerUp, setActivePowerUp] = useState<string | null>(null);
  const [fistProgress, setFistProgress] = useState(0); // 0 to 100
  const [fingerCount, setFingerCount] = useState(0);
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });
  const [hoveredButton, setHoveredButton] = useState<string | null>(null);
  const [selectedMenuItem, setSelectedMenuItem] = useState<number>(0); 
  const [selectedDifficulty, setSelectedDifficulty] = useState<'easy' | 'normal' | 'hard'>('normal');
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [initStatus, setInitStatus] = useState('Waiting for System...');
  const [scriptsReady, setScriptsReady] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isTooClose, setIsTooClose] = useState(false);
  const [activeThemeId, setActiveThemeId] = useState<string>(themes[0].id);

  const activeTheme = useMemo(() => themes.find(t => t.id === activeThemeId) || themes[0], [activeThemeId]);
  const activeThemeRef = useRef<Theme>(activeTheme);

  useEffect(() => {
    activeThemeRef.current = activeTheme;
  }, [activeTheme]);

  // UI Throttling Refs
  const cursorRef = useRef<HTMLDivElement>(null);
  const fingerIndicatorRef = useRef<HTMLDivElement>(null);
  const hudScoreRef = useRef<HTMLDivElement>(null);
  const hudLvlRef = useRef<HTMLDivElement>(null);
  const hudComboRef = useRef<HTMLDivElement>(null);
  const mHudScoreRef = useRef<HTMLDivElement>(null);
  const mHudLvlRef = useRef<HTMLDivElement>(null);
  const mHudComboRef = useRef<HTMLDivElement>(null);

  // Game state refs (non-reactive for performance)
  const playerPosRef = useRef({ x: 0, y: 0 });
  const targetPosRef = useRef({ x: 0, y: 0 });
  const lastHandPosRef = useRef({ x: 0.5, y: 0.5 });
  const startWaitRef = useRef(false);
  const startWaitDistRef = useRef(0);
  const isFirstHandRef = useRef(true);
  const enemiesRef = useRef<GameObject[]>([]);
  const mazeWallsRef = useRef<{x: number, y: number, w: number, h: number}[]>([]);
  const mazeGoalRef = useRef({ x: 0, y: 0, r: 30 });
  const mazePlayerRadiusRef = useRef(15);
  const particlesRef = useRef<Particle[]>([]);
  const lastSpawnTimeRef = useRef(0);
  const fistProgressRef = useRef(0);
  const lastFistTimeRef = useRef(0);
  const scoreRef = useRef(0);
  const levelRef = useRef(1);
  const comboRef = useRef(0);
  const powerUpTimerRef = useRef(0);
  const difficultyRef = useRef(1); // Dynamic difficulty multiplier
  const requestRef = useRef<number>(0);
  const handsRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);
  const dimensionsRef = useRef({ width: 0, height: 0 });

  // Handle Resize
  useEffect(() => {
    if (!containerRef.current) return;

    const updateSize = () => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        setDimensions({ width, height });
        dimensionsRef.current = { width, height };
        
        if (playerPosRef.current.x === 0 && playerPosRef.current.y === 0) {
          playerPosRef.current = { x: width / 2, y: height / 2 };
          targetPosRef.current = { x: width / 2, y: height / 2 };
        }
      }
    };

    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(containerRef.current);
    updateSize();

    return () => resizeObserver.disconnect();
  }, []);

  const cleanupHardware = async () => {
    if (requestRef.current) cancelAnimationFrame(requestRef.current);
    
    if (cameraRef.current) {
      try {
        await cameraRef.current.stop();
      } catch (e) {
        console.error("Camera stop error:", e);
      }
      cameraRef.current = null;
    }

    if (handsRef.current) {
      try {
        await handsRef.current.close();
      } catch (e) {
        console.error("Hands close error:", e);
      }
      handsRef.current = null;
    }
  };

  useEffect(() => {
    const checkScripts = setInterval(() => {
      // @ts-ignore
      if (window.Hands && window.Camera) {
        setScriptsReady(true);
        setInitStatus('Hardware Ready');
        // Reset hand tracking state when re-initialized
        isFirstHandRef.current = true;
        clearInterval(checkScripts);
      }
    }, 100);
    
    return () => {
      clearInterval(checkScripts);
      cleanupHardware();
    };
  }, []);

  const handleInitHardware = async () => {
    if (isInitializing) return;
    setIsInitializing(true);
    setInitStatus('Requesting Camera Access...');
    try {
      // Clean up existing to prevent Emscripten conflicts
      await cleanupHardware();

      // 1. First, check if browser supports mediaDevices
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Your browser does not support camera access.');
      }

      // 2. Prime the permission request
      await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      
      setInitStatus('Calibrating Biometrics...');
      // @ts-ignore
      const hands = new window.Hands({
        locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
      });

      hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 0, // Reverted to 0 for better performance/lag reduction
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
      });

      hands.onResults((results: any) => {
        // Draw to webcam canvas
        if (webcamCanvasRef.current) {
          const ctx = webcamCanvasRef.current.getContext('2d');
          if (ctx) {
             ctx.save();
             ctx.clearRect(0, 0, webcamCanvasRef.current.width, webcamCanvasRef.current.height);
             if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
               for (const landmarks of results.multiHandLandmarks) {
                  // @ts-ignore
                  if (window.drawConnectors && window.HAND_CONNECTIONS) {
                    // @ts-ignore
                    window.drawConnectors(ctx, landmarks, window.HAND_CONNECTIONS, { color: '#00FF00', lineWidth: 2 });
                  }
                  // @ts-ignore
                  if (window.drawLandmarks) {
                    // @ts-ignore
                    window.drawLandmarks(ctx, landmarks, { color: '#FF0000', lineWidth: 1, radius: 1 });
                  }
               }
             }
             ctx.restore();
          }
        }

        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
          const landmarks = results.multiHandLandmarks[0];
          
          // 1. Relative Position Tracking
          const indexTip = landmarks[8];
          const currentWidth = dimensionsRef.current.width;
          const currentHeight = dimensionsRef.current.height;

          // Detect Hand Size (Too Close Warning)
          const wristP = landmarks[0];
          const middleMCP = landmarks[9];
          const handSize = Math.hypot(wristP.x - middleMCP.x, wristP.y - middleMCP.y);
          setIsTooClose(handSize > 0.35);

          // Mirror X
          const rawX = (1 - indexTip.x);
          const rawY = indexTip.y;
          
          // 2. Fist Detection Logic (Moved up)
          const wrist = landmarks[0];
          
          // Use palm length as a reference scale (distance from wrist to middle finger MCP)
          const palmLength = Math.hypot(landmarks[9].x - wrist.x, landmarks[9].y - wrist.y);
          
          let fingersExtended = 0;
          // Index (8, 5), Middle (12, 9), Ring (16, 13), Pinky (20, 17)
          const fingerPairs = [[8, 5], [12, 9], [16, 13], [20, 17]];
          fingerPairs.forEach(([tip, mcp]) => {
            const distTipMcp = Math.hypot(landmarks[tip].x - landmarks[mcp].x, landmarks[tip].y - landmarks[mcp].y);
            // If the distance from tip to its own base (MCP) is > 70% of palm length, it's extended
            if (distTipMcp > palmLength * 0.7) {
              fingersExtended++;
            }
          });
          
          // Thumb: Tip (4) distance from Pinky MCP (17)
          const thumbTipDist = Math.hypot(landmarks[4].x - landmarks[17].x, landmarks[4].y - landmarks[17].y);
          if (thumbTipDist > palmLength * 0.9) fingersExtended++;

          setFingerCount(fingersExtended);
          if (fingerIndicatorRef.current) {
            fingerIndicatorRef.current.innerText = fingersExtended > 0 ? fingersExtended.toString() : "";
          }

          // Fist is 0 fingers extended (allow 1 frame glitches or just thumb)
          const isFist = fingersExtended <= 1;
          
          // Track transition from fist to open to provide a grace period
          if (isFist) {
             (window as any).WAS_FIST = true;
          } else if ((window as any).WAS_FIST) {
             (window as any).WAS_FIST = false;
             (window as any).LAST_FIST_RELEASE = Date.now();
          }

          // 1. Relative Position Tracking
          if (isFirstHandRef.current) {
            lastHandPosRef.current = { x: rawX, y: rawY };
            if ((window as any).GAME_STATE_INTERNAL === 'menu') {
                targetPosRef.current.x = currentWidth / 2;
                targetPosRef.current.y = currentHeight / 2;
            }
            isFirstHandRef.current = false;
          } else {
            const dx = rawX - lastHandPosRef.current.x;
            const dy = rawY - lastHandPosRef.current.y;
            
            // Allow pointer to move only if not making a fist AND completely finished unclenching
            const timeSinceRelease = Date.now() - ((window as any).LAST_FIST_RELEASE || 0);
            
            if (!isFist && timeSinceRelease > 600) {
              const sens = (window as any).GAME_STATE_INTERNAL === 'maze' ? MAZE_SENSITIVITY : DODGE_SENSITIVITY * 1.5;
              const DEADZONE = 0.002;
              let moveDist = Math.hypot(dx, dy);
              
              if (moveDist > DEADZONE) {
                  // If we are waiting for a significant movement after start/reset
                  let allowMove = true;
                  if (startWaitRef.current) {
                      startWaitDistRef.current += moveDist;
                      allowMove = false; // Absorb initial jolt
                      if (startWaitDistRef.current > 0.06) { 
                          startWaitRef.current = false;
                      }
                  }
                  
                  if (allowMove) {
                      const scale = (moveDist - DEADZONE) / moveDist;
                      targetPosRef.current.x += (dx * scale) * sens * currentWidth;
                      targetPosRef.current.y += (dy * scale) * sens * currentHeight;
                      
                      targetPosRef.current.x = Math.max(0, Math.min(currentWidth, targetPosRef.current.x));
                      targetPosRef.current.y = Math.max(0, Math.min(currentHeight, targetPosRef.current.y));
                  }
              }
            }
            
            // Always update last known raw position to avoid cursor jump on fist release
            lastHandPosRef.current = { x: rawX, y: rawY };
          }
          
          // Direct DOM update for cursor performance
          if (cursorRef.current) {
            cursorRef.current.style.transform = `translate3d(${targetPosRef.current.x}px, ${targetPosRef.current.y}px, 0) translate3d(-50%, -50%, 0)`;
          }

          // 3. Gesture Handling
          if (isFist) {
            fistProgressRef.current = Math.min(100, fistProgressRef.current + 8);
          } else {
            fistProgressRef.current = Math.max(0, fistProgressRef.current - 12);
          }
          setFistProgress(fistProgressRef.current);

          if (fistProgressRef.current === 100 && Date.now() - lastFistTimeRef.current > 1000) {
            lastFistTimeRef.current = Date.now();
            fistProgressRef.current = 0;
            setFistProgress(0);
            
            // Trigger contextual action
            const currentGameState = (window as any).GAME_STATE_INTERNAL;
            if (currentGameState === 'gameover') {
              // Restart the SAME mode on "blink" (fist gesture)
              (window as any).TRIGGER_START_MODE?.();
            } else if (currentGameState === 'loading' && (window as any).SCRIPTS_READY) {
              (window as any).TRIGGER_INIT?.();
            }
          }
          
          // Menu item selection logic via cursor position
          if ((window as any).GAME_STATE_INTERNAL === 'menu') {
            // Mouse only selection in menu now
          }
  } else {
    fistProgressRef.current = 0;
    setFistProgress(0);
    setFingerCount(0);
    isFirstHandRef.current = true; // Reset so tracking doesn't jump when hand is regained
  }
      });

      handsRef.current = hands;

      if (videoRef.current) {
        // @ts-ignore
        const camera = new window.Camera(videoRef.current, {
          onFrame: async () => {
            if (handsRef.current && videoRef.current) {
              await handsRef.current.send({ image: videoRef.current });
            }
          },
          width: 640,
          height: 480
        });
        
        cameraRef.current = camera;
        await camera.start();
        setInitStatus('Ready');
        setGameState('menu');
      }
    } catch (error: any) {
      console.error("Initialization failed:", error);
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        setInitStatus('Permission Denied. Please allow camera access in your browser settings.');
      } else {
        setInitStatus(`Error: ${error.message || 'Check Camera'}`);
      }
    } finally {
      setIsInitializing(false);
    }
  };

  const createParticles = (x: number, y: number, color: string, count = 8) => {
    for (let i = 0; i < count; i++) {
        particlesRef.current.push({
            x,
            y,
            vx: (Math.random() - 0.5) * 8,
            vy: (Math.random() - 0.5) * 8,
            life: 1,
            color
        });
    }
  };

  // Expose state for gesture detection callback
  useEffect(() => {
    (window as any).GAME_STATE_INTERNAL = gameState;
    (window as any).SCRIPTS_READY = scriptsReady;
    (window as any).TRIGGER_START_MODE = () => {
       const currentGameState = (window as any).GAME_STATE_INTERNAL;
       // If coming from gameover, use the mode they were just playing
       const mode = currentGameState === 'gameover' 
          ? gameModeRef.current 
          : ((window as any).SELECTED_MODE || 'dodge');
       startGame(mode);
    };
    (window as any).TRIGGER_MENU = () => setGameState('menu');
    (window as any).TRIGGER_INIT = handleInitHardware;
  }, [gameState, scriptsReady]);

  const generateMaze = (width: number, height: number, level: number) => {
    // 1. Setup Grid
    // Scale complexity by the selected difficulty multiplier
    const diffMult = difficultyRef.current || 1;
    let baseComplexity = 5;
    if (diffMult < 1) baseComplexity = 3; // easy
    if (diffMult > 1) baseComplexity = 8; // hard
    
    // As level goes up, complexity increases. Capped at 15
    const complexity = Math.min(15, baseComplexity + Math.floor(level * diffMult / 1.5));
    const cellSize = Math.min(width, height) / complexity;
    const cols = Math.floor(width / cellSize);
    const rows = Math.floor(height / cellSize);
    
    // Player radius scales with the cell size so it's always fair, min 4 max 12
    mazePlayerRadiusRef.current = Math.max(4, Math.min(12, cellSize * 0.25));
    
    const offsetX = (width - cols * cellSize) / 2;
    const offsetY = (height - rows * cellSize) / 2;

    const grid = Array.from({ length: rows }, () => 
      Array.from({ length: cols }, () => ({
        visited: false,
        walls: [true, true, true, true] // Top, Right, Bottom, Left
      }))
    );

    // 2. DFS Algorithm for Maze Generation
    const stack: [number, number][] = [[0, 0]];
    grid[0][0].visited = true;

    while (stack.length > 0) {
      const [r, c] = stack[stack.length - 1];
      const neighbors: [number, number, number, number][] = [];

      // Unvisited neighbors
      if (r > 0 && !grid[r - 1][c].visited) neighbors.push([r - 1, c, 0, 2]);
      if (c < cols - 1 && !grid[r][c + 1].visited) neighbors.push([r, c + 1, 1, 3]);
      if (r < rows - 1 && !grid[r + 1][c].visited) neighbors.push([r + 1, c, 2, 0]);
      if (c > 0 && !grid[r][c - 1].visited) neighbors.push([r, c - 1, 3, 1]);

      if (neighbors.length > 0) {
        const [nr, nc, currentWall, neighborWall] = neighbors[Math.floor(Math.random() * neighbors.length)];
        grid[r][c].walls[currentWall] = false;
        grid[nr][nc].walls[neighborWall] = false;
        grid[nr][nc].visited = true;
        stack.push([nr, nc]);
      } else {
        stack.pop();
      }
    }

    // 3. Convert to Physics Walls
    const wallWeight = Math.max(4, cellSize / 10);
    const walls = [];

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = offsetX + c * cellSize;
        const y = offsetY + r * cellSize;
        if (grid[r][c].walls[0]) walls.push({ x, y, w: cellSize + wallWeight, h: wallWeight }); // Top
        if (grid[r][c].walls[1]) walls.push({ x: x + cellSize, y, w: wallWeight, h: cellSize + wallWeight }); // Right
        if (grid[r][c].walls[2]) walls.push({ x, y: y + cellSize, w: cellSize + wallWeight, h: wallWeight }); // Bottom
        if (grid[r][c].walls[3]) walls.push({ x, y, w: wallWeight, h: cellSize + wallWeight }); // Left
      }
    }

    mazeWallsRef.current = walls;

    // 4. Set Start and Goal
    playerPosRef.current = { x: offsetX + cellSize / 2, y: offsetY + cellSize / 2 };
    targetPosRef.current = { ...playerPosRef.current };
    
    mazeGoalRef.current = { 
      x: offsetX + (cols - 1) * cellSize + cellSize / 2, 
      y: offsetY + (rows - 1) * cellSize + cellSize / 2, 
      r: cellSize / 4 
    };
  };

  const startGame = (mode: 'dodge' | 'maze') => {
    const { width, height } = dimensionsRef.current;
    const safeWidth = width || 640;
    const safeHeight = height || 480;

    startWaitRef.current = true;
    startWaitDistRef.current = 0;

    setGameMode(mode);
    gameModeRef.current = mode;
    (window as any).SELECTED_MODE = mode; // keep it in sync for restarts
    enemiesRef.current = [];
    particlesRef.current = [];
    scoreRef.current = 0;
    levelRef.current = 1;
    comboRef.current = 0;
    
    const diffSelected = (window as any).SELECTED_DIFFICULTY || 'normal';
    // Base difficulty multiplier logic
    if (diffSelected === 'easy') {
      difficultyRef.current = 0.5;
    } else if (diffSelected === 'hard') {
      difficultyRef.current = 1.8;
    } else {
      difficultyRef.current = 1.0;
    }

    setScore(0);
    setLevel(1);
    setCombo(0);
    setIsHit(false);
    setActivePowerUp(null);
    lastSpawnTimeRef.current = performance.now();
    
    // Give 2.5 seconds of preparation time on new start!
    (window as any).LEVEL_TRANSITION_UNTIL = performance.now() + 2500;
    
    isFirstHandRef.current = true;
    (window as any).WAS_FIST = true;
    (window as any).LAST_FIST_RELEASE = Date.now();
    
    if (mode === 'dodge') {
      const startPos = { x: safeWidth / 2, y: safeHeight / 2 };
      playerPosRef.current = { ...startPos };
      targetPosRef.current = { ...startPos };
      requestRef.current = requestAnimationFrame(gameLoop);
    } else {
      generateMaze(safeWidth, safeHeight, 1);
      requestRef.current = requestAnimationFrame(mazeLoop);
    }

    setGameState('playing');
  };

  const spawnEnemy = (currentTime: number) => {
    const { width, height } = dimensionsRef.current;
    const safeWidth = width || 640;
    const safeHeight = height || 480;

    const timeSinceLastSpawn = currentTime - lastSpawnTimeRef.current;
    const antiCamp = (window as any).antiCampMult || 1.0;
    
    // Level-based difficulty + Dynamic Factor (difficultyRef)
    // Much slower spawn at Level 1, gradually gets faster
    const spawnDelayBase = Math.max(SPAWN_INTERVAL_MIN, (SPAWN_INTERVAL_MAX - (levelRef.current * 100)) / (difficultyRef.current * antiCamp));
    const currentSpawnDelay = Math.max(SPAWN_INTERVAL_MIN - 200, spawnDelayBase - (scoreRef.current / 80));

    if (timeSinceLastSpawn > currentSpawnDelay) {
      const isPowerUp = Math.random() < 0.1; // 10% chance for power-up (slightly higher)
      const type = isPowerUp 
        ? (Math.random() < 0.5 ? 'shield' : 'slow') 
        : 'enemy';

      const radius = type === 'enemy' 
        ? ENEMY_BASE_RADIUS + Math.random() * (levelRef.current * 2)
        : 15;

      const x = Math.random() * (safeWidth - radius * 2) + radius;
      
      // Starting speed is lower (1.5) and grows slower
      const baseSpeed = (1.5 + (levelRef.current * 0.4) + Math.random() * 1.5) * difficultyRef.current * antiCamp;
      const heightFactor = safeHeight / 600; 

      enemiesRef.current.push({
        x,
        y: -radius,
        radius,
        speed: type === 'slow' ? baseSpeed * 0.5 : baseSpeed * heightFactor,
        type
      });
      lastSpawnTimeRef.current = currentTime;
    }
  };

  const gameLoop = (time: number) => {
    const ctx = canvasRef.current?.getContext('2d');
    const { width, height } = dimensionsRef.current;
    const safeWidth = width || 640;
    const safeHeight = height || 480;
    if (!ctx) return;

    // 1. Power-up timer logic
    if (powerUpTimerRef.current > 0) {
        powerUpTimerRef.current -= 16.6; // approx 1 frame
        if (powerUpTimerRef.current <= 0) {
            setActivePowerUp(null);
        }
    }

    // 2. Adaptive Difficulty System (Dynamic Logic)
    // If player is too close to center, increase intensity (anti-camping)
    const centerX = safeWidth / 2;
    const centerY = safeHeight / 2;
    const distFromCenter = Math.hypot(playerPosRef.current.x - centerX, playerPosRef.current.y - centerY);
    
    // We modify an anti-camping multiplier, not the base difficulty
    if (! (window as any).antiCampMult ) (window as any).antiCampMult = 1.0;
    
    if (distFromCenter < 100) {
        (window as any).antiCampMult = Math.min(1.5, (window as any).antiCampMult + 0.0005);
    } else {
        (window as any).antiCampMult = Math.max(1.0, (window as any).antiCampMult - 0.0002);
    }

    // Use antiCampMult in gameplay speed calculations together with difficultyRef.current

    // 3. Update Player Position
    const isFrozen = performance.now() < ((window as any).LEVEL_TRANSITION_UNTIL || 0);
    if (isFrozen) {
        targetPosRef.current.x = playerPosRef.current.x;
        targetPosRef.current.y = playerPosRef.current.y;
    } else {
        playerPosRef.current.x += (targetPosRef.current.x - playerPosRef.current.x) * SMOOTHING_FACTOR;
        playerPosRef.current.y += (targetPosRef.current.y - playerPosRef.current.y) * SMOOTHING_FACTOR;
    }

    playerPosRef.current.x = Math.max(PLAYER_RADIUS, Math.min(safeWidth - PLAYER_RADIUS, playerPosRef.current.x));
    playerPosRef.current.y = Math.max(PLAYER_RADIUS, Math.min(safeHeight - PLAYER_RADIUS, playerPosRef.current.y));

    // 4. Update Enemies, Powerups, and Collisions
    if (!isFrozen) {
        spawnEnemy(time);
    }
    
    let gameOver = false;
    enemiesRef.current = enemiesRef.current.filter((obj) => {
      let speedMult = 1;
      if (activePowerUp === 'slow') speedMult = 0.5;
      obj.y += obj.speed * speedMult;

      const dx = obj.x - playerPosRef.current.x;
      const dy = obj.y - playerPosRef.current.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Collision Check
      if (distance < obj.radius + PLAYER_RADIUS) {
        if (obj.type === 'enemy') {
            if (activePowerUp === 'shield') {
                createParticles(obj.x, obj.y, '#3b82f6', 15);
                setActivePowerUp(null); // Shield consumed
                powerUpTimerRef.current = 0;
                return false; // Enemy destroyed
            } else {
                gameOver = true;
            }
        } else {
            // Pick up power-up
            setActivePowerUp(obj.type!);
            powerUpTimerRef.current = 5000; // 5 seconds
            createParticles(obj.x, obj.y, obj.type === 'shield' ? '#3b82f6' : '#facc15', 12);
            return false;
        }
      }

      // Grazing System (Close Call)
      if (obj.type === 'enemy' && distance < (obj.radius + PLAYER_RADIUS) + 30) {
          comboRef.current = Math.min(50, comboRef.current + 0.1);
      } else {
          comboRef.current = Math.max(0, comboRef.current - 0.05);
      }

      return obj.y < safeHeight + obj.radius;
    });

    // 5. Update Particles
    particlesRef.current = particlesRef.current.filter(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.02;
        return p.life > 0;
    });

    // 6. Rendering
    const theme = activeThemeRef.current;
    ctx.clearRect(0, 0, safeWidth, safeHeight);
    ctx.fillStyle = theme.bgCanvas;
    ctx.fillRect(0, 0, safeWidth, safeHeight);

    // Draw Grid (Responsive)
    ctx.strokeStyle = theme.gridLine;
    ctx.lineWidth = 1;
    const gridSize = Math.max(40, safeWidth / 20); 
    for (let i = 0; i < safeWidth; i += gridSize) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, safeHeight); ctx.stroke();
    }
    for (let i = 0; i < safeHeight; i += gridSize) {
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(safeWidth, i); ctx.stroke();
    }

    // Draw Particles
    particlesRef.current.forEach(p => {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, 2, 2);
    });
    ctx.globalAlpha = 1;

    // Draw Objects
    enemiesRef.current.forEach(obj => {
      ctx.shadowBlur = 10;
      if (obj.type === 'enemy') {
          ctx.fillStyle = theme.enemyColor;
          ctx.shadowColor = theme.enemyColor;
      } else if (obj.type === 'shield') {
          ctx.fillStyle = theme.shieldColor;
          ctx.shadowColor = theme.shieldColor;
      } else if (obj.type === 'slow') {
          ctx.fillStyle = theme.speedColor;
          ctx.shadowColor = theme.speedColor;
      }
      
      ctx.beginPath();
      ctx.arc(obj.x, obj.y, obj.radius, 0, Math.PI * 2);
      ctx.fill();
    });

    // Draw Player
    ctx.fillStyle = theme.playerColor;
    ctx.shadowBlur = 15;
    ctx.shadowColor = theme.playerShadow;
    
    // Shield Visual
    if (activePowerUp === 'shield') {
        ctx.strokeStyle = theme.shieldColor;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(playerPosRef.current.x, playerPosRef.current.y, PLAYER_RADIUS + 5, 0, Math.PI * 2);
        ctx.stroke();
    }

    ctx.beginPath();
    ctx.arc(playerPosRef.current.x, playerPosRef.current.y, PLAYER_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    if (isFrozen) {
        ctx.fillStyle = "white";
        ctx.font = "bold 24px monospace";
        ctx.textAlign = "center";
        const timeLeft = Math.ceil(((window as any).LEVEL_TRANSITION_UNTIL - performance.now()) / 1000);
        ctx.fillText(`SYSTEM STANDBY: ${timeLeft}s`, safeWidth / 2, safeHeight / 2 - 40);
        ctx.font = "12px monospace";
        ctx.fillText("Syncing neural pathways...", safeWidth / 2, safeHeight / 2 - 20);
    }

    // Update Score Logic (Ref only for performance)
    if (!isFrozen) {
        scoreRef.current += 1 + (Math.floor(comboRef.current) / 2);
    }
    const currentScore = Math.floor(scoreRef.current / 10);

    const nextLevel = Math.floor(currentScore / POINTS_PER_LEVEL) + 1;
    if (nextLevel > levelRef.current) {
      levelRef.current = nextLevel;
      setLevel(nextLevel);
      setShowLevelUp(true);
      setTimeout(() => setShowLevelUp(false), 2000);
    }

    if (gameOver) {
      handleGameOver();
    } else {
      requestRef.current = requestAnimationFrame(gameLoop);
    }
  };

  const mazeLoop = (time: number) => {
    const ctx = canvasRef.current?.getContext('2d');
    const { width, height } = dimensionsRef.current;
    const safeWidth = width || 640;
    const safeHeight = height || 480;
    if (!ctx) return;

    // 1. Update Player Position
    const isFrozen = performance.now() < ((window as any).LEVEL_TRANSITION_UNTIL || 0);
    
    if (isFrozen) {
        targetPosRef.current.x = playerPosRef.current.x;
        targetPosRef.current.y = playerPosRef.current.y;
    } else {
        playerPosRef.current.x += (targetPosRef.current.x - playerPosRef.current.x) * SMOOTHING_FACTOR;
        playerPosRef.current.y += (targetPosRef.current.y - playerPosRef.current.y) * SMOOTHING_FACTOR;
    }
    
    // Bounds check
    playerPosRef.current.x = Math.max(mazePlayerRadiusRef.current, Math.min(safeWidth - mazePlayerRadiusRef.current, playerPosRef.current.x));
    playerPosRef.current.y = Math.max(mazePlayerRadiusRef.current, Math.min(safeHeight - mazePlayerRadiusRef.current, playerPosRef.current.y));

    // 2. Collision Detection with Maze Walls
    let gameOver = false;
    for (const wall of mazeWallsRef.current) {
        // Simple circle-rect collision
        const closestX = Math.max(wall.x, Math.min(playerPosRef.current.x, wall.x + wall.w));
        const closestY = Math.max(wall.y, Math.min(playerPosRef.current.y, wall.y + wall.h));
        const dx = playerPosRef.current.x - closestX;
        const dy = playerPosRef.current.y - closestY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < mazePlayerRadiusRef.current) {
            gameOver = true;
            break;
        }
    }

    // 3. Goal Detection
    const goalDx = playerPosRef.current.x - mazeGoalRef.current.x;
    const goalDy = playerPosRef.current.y - mazeGoalRef.current.y;
    const goalDist = Math.sqrt(goalDx * goalDx + goalDy * goalDy);
    
    if (goalDist < mazePlayerRadiusRef.current + mazeGoalRef.current.r) {
        // Level Up & New Maze
        scoreRef.current += 1000;
        levelRef.current += 1;
        setLevel(levelRef.current);
        setShowLevelUp(true);
        setTimeout(() => setShowLevelUp(false), 2000);
        generateMaze(safeWidth, safeHeight, levelRef.current);
        
        // Reset tracking vars so hand movement is smooth and requires intent
        isFirstHandRef.current = true;
        startWaitRef.current = true;
        startWaitDistRef.current = 0;
        
        // Freeze movement for 2 seconds to match level up text
        (window as any).LEVEL_TRANSITION_UNTIL = performance.now() + 2000;
        
        createParticles(mazeGoalRef.current.x, mazeGoalRef.current.y, '#4ade80', 20);
    }

    // 4. Particles
    particlesRef.current = particlesRef.current.filter(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.02;
        return p.life > 0;
    });

    // 5. Render
    const theme = activeThemeRef.current;
    ctx.clearRect(0, 0, safeWidth, safeHeight);
    ctx.fillStyle = theme.bgCanvas;
    ctx.fillRect(0, 0, safeWidth, safeHeight);

    // Draw Walls
    ctx.fillStyle = theme.mazeWallFill;
    ctx.strokeStyle = theme.mazeWallStroke;
    ctx.lineWidth = 1;
    mazeWallsRef.current.forEach(wall => {
        ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
        ctx.strokeRect(wall.x, wall.y, wall.w, wall.h);
    });

    // Draw Goal
    ctx.shadowBlur = 20;
    ctx.shadowColor = theme.mazeGoalStroke;
    ctx.fillStyle = theme.mazeGoalFill;
    ctx.strokeStyle = theme.mazeGoalStroke;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(mazeGoalRef.current.x, mazeGoalRef.current.y, mazeGoalRef.current.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Draw Pulse in goal
    const pulse = (Math.sin(time / 200) + 1) / 2;
    ctx.beginPath();
    ctx.arc(mazeGoalRef.current.x, mazeGoalRef.current.y, mazeGoalRef.current.r * pulse, 0, Math.PI * 2);
    ctx.stroke();

    // Draw Particles
    particlesRef.current.forEach(p => {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, 2, 2);
    });
    ctx.globalAlpha = 1;

    // Draw Player
    ctx.fillStyle = theme.playerColor;
    ctx.shadowBlur = 15;
    ctx.shadowColor = theme.playerShadow;
    ctx.beginPath();
    ctx.arc(playerPosRef.current.x, playerPosRef.current.y, mazePlayerRadiusRef.current, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    
    if (isFrozen) {
        ctx.fillStyle = "white";
        ctx.font = "bold 24px monospace";
        ctx.textAlign = "center";
        const timeLeft = Math.ceil(((window as any).LEVEL_TRANSITION_UNTIL - performance.now()) / 1000);
        ctx.fillText(`SYSTEM STANDBY: ${timeLeft}s`, safeWidth / 2, safeHeight / 2 - 40);
        ctx.font = "12px monospace";
        ctx.fillText("Syncing neural pathways...", safeWidth / 2, safeHeight / 2 - 20);
    }

    // Update Scores
    if (!isFrozen) {
        scoreRef.current += 1;
    }

    if (gameOver) {
        handleGameOver();
    } else {
        requestRef.current = requestAnimationFrame(mazeLoop);
    }
  };

  const handleGameOver = () => {
    setIsHit(true);
    // Snapshot values for the gameover screen
    const finalScore = Math.floor(scoreRef.current / 10);
    setScore(finalScore);
    setCombo(Math.floor(comboRef.current));
    setLevel(levelRef.current);
    
    setTimeout(() => {
      setGameState('gameover');
      setHighScore(prev => Math.max(prev, finalScore));
    }, 300);
  };

    // HUD update interval (10Hz is enough for visuals)
    useEffect(() => {
        const interval = setInterval(() => {
            const s = Math.floor(scoreRef.current / 10).toString().padStart(5, '0');
            const l = `LVL ${levelRef.current}`;
            const cVal = Math.floor(comboRef.current);
            const cStr = `x${(Math.floor(cVal/5) + 1).toFixed(1)}`;

            if (hudScoreRef.current) hudScoreRef.current.innerText = s;
            if (hudLvlRef.current) hudLvlRef.current.innerText = l;
            if (mHudScoreRef.current) mHudScoreRef.current.innerText = s.slice(-4);
            if (mHudLvlRef.current) mHudLvlRef.current.innerText = `L${levelRef.current}`;

            if (hudComboRef.current) {
                if (cVal > 5) {
                    hudComboRef.current.innerText = cStr;
                    hudComboRef.current.style.opacity = '1';
                } else {
                    hudComboRef.current.style.opacity = '0';
                }
            }

            if (mHudComboRef.current) {
                if (cVal > 10) {
                    mHudComboRef.current.innerText = `Grazing ${cStr}`;
                    mHudComboRef.current.style.opacity = '1';
                } else {
                    mHudComboRef.current.style.opacity = '0';
                }
            }
        }, 100);
        return () => clearInterval(interval);
    }, []);

  return (
    <div className={`min-h-screen ${activeTheme.uiBgClass} ${activeTheme.uiTextClass} font-mono flex flex-col items-center justify-center p-4 overflow-hidden select-none transition-colors duration-200 ${isHit ? 'hit-flash' : ''}`}>
      
      {/* Theme Selector (Only in Menu) */}
      {gameState === 'menu' && (
        <div className="absolute top-6 right-6 z-50 flex items-center gap-4">
          <button 
            onClick={() => {
              const idx = themes.findIndex(t => t.id === activeThemeId);
              const nextIdx = (idx - 1 + themes.length) % themes.length;
              setActiveThemeId(themes[nextIdx].id);
            }}
            className={`p-2 rounded-full border ${activeTheme.uiBorderClass} hover:bg-white/10 transition-colors`}
          >
            <ArrowLeft size={16} />
          </button>
          
          <div className="flex items-center gap-2">
             <Palette size={16} className={activeTheme.uiTextDimClass} />
             <span className={`text-[10px] uppercase font-bold tracking-[0.2em] w-24 text-center ${activeTheme.uiTextClass}`}>{activeTheme.name}</span>
          </div>

          <button 
            onClick={() => {
              const idx = themes.findIndex(t => t.id === activeThemeId);
              const nextIdx = (idx + 1) % themes.length;
              setActiveThemeId(themes[nextIdx].id);
            }}
            className={`p-2 rounded-full border ${activeTheme.uiBorderClass} hover:bg-white/10 transition-colors`}
          >
            <ArrowRight size={16} />
          </button>
        </div>
      )}

      {/* Virtual Cursor (Optimized) */}
      {(gameState === 'menu' || gameState === 'gameover' || gameState === 'loading') && scriptsReady && (
        <div 
          ref={cursorRef}
          className="fixed pointer-events-none z-[100] transition-none"
          style={{ willChange: 'transform' }}
        >
          {/* Finger Count Indicator */}
          <div ref={fingerIndicatorRef} className="absolute -top-8 left-1/2 -translate-x-1/2 text-white font-black text-xs bg-white/20 px-2 py-0.5 rounded backdrop-blur-sm shadow-[0_0_10px_rgba(255,255,255,0.3)]">
          </div>

          {/* Main Cursor Dot */}
          <div className="w-6 h-6 border border-white/20 rounded-full flex items-center justify-center bg-white/5 backdrop-blur-[2px]">
             <div className="w-1.5 h-1.5 bg-white rounded-full shadow-[0_0_8px_white]" />
          </div>

          {/* Fist Progress Ring */}
          {fistProgress > 0 && (
            <svg className="absolute inset-[-8px] w-[40px] h-[40px] -rotate-90">
              <circle
                cx="20"
                cy="20"
                r="18"
                fill="none"
                stroke="white"
                strokeWidth="2.5"
                strokeDasharray={`${2 * Math.PI * 18}`}
                strokeDashoffset={`${2 * Math.PI * 18 * (1 - fistProgress / 100)}`}
                className="transition-all duration-75"
              />
            </svg>
          )}

          {/* Technical Accents */}
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
            className="absolute inset-[-12px] border border-dashed border-white/5 rounded-full"
          />
        </div>
      )}

      {/* UI: Global Stats (Optimized via Direct Refs) */}
      <div className="fixed top-10 left-10 z-30 hidden md:block">
        <div className={`text-[10px] uppercase tracking-[0.4em] ${activeTheme.uiTextDimClass} mb-2`}>Neural_Telemetry</div>
        <div className="flex items-baseline gap-4">
          <div ref={hudScoreRef} className={`text-7xl font-black italic tracking-tighter ${activeTheme.uiTextClass}`}>
            00000
          </div>
          <div className="flex flex-col">
            <div ref={hudLvlRef} className={`text-xs font-bold ${activeTheme.uiTextDimClass} mb-1`}>LVL 1</div>
            <div 
                ref={hudComboRef} 
                className="text-yellow-400 text-sm font-black italic transition-opacity duration-200 opacity-0"
            >
                x1.0
            </div>
          </div>
        </div>
      </div>

      <div className="fixed top-10 right-10 z-30 text-right hidden md:block">
        <div className={`text-[10px] uppercase tracking-[0.4em] ${activeTheme.uiTextDimClass} mb-2`}>System_Efficiency</div>
        <div className="flex items-center gap-3 justify-end">
           {activePowerUp && (
              <motion.div 
                initial={{ scale: 0.8 }}
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ repeat: Infinity }}
                className={`px-3 py-1 text-[10px] font-bold uppercase tracking-widest border ${activePowerUp === 'shield' ? 'border-blue-500 text-blue-400' : 'border-yellow-500 text-yellow-400'}`}
              >
                {activePowerUp}_Active
              </motion.div>
           )}
          <div className={`w-2 h-2 rounded-full ${gameState === 'playing' ? 'bg-green-500 shadow-[0_0_12px_rgba(34,197,94,0.8)]' : 'bg-red-500 animate-pulse'} `}></div>
          <div className={`text-xs uppercase tracking-[0.2em] font-medium ${activeTheme.uiTextDimClass}`}>
            {gameState === 'playing' ? 'Live_Feed' : initStatus}
          </div>
        </div>
      </div>

      {/* Mobile HUD */}
      <div className="md:hidden w-full flex justify-between items-start mb-8 max-w-[640px] px-4">
        <div>
          <div className={`text-[10px] uppercase tracking-widest ${activeTheme.uiTextDimClass} mb-1`}>Session_Score</div>
          <div className="flex items-baseline gap-2">
            <div ref={mHudScoreRef} className={`text-5xl font-black italic tracking-tighter ${activeTheme.uiTextClass}`}>0000</div>
            <div ref={mHudLvlRef} className={`text-xs font-bold ${activeTheme.uiTextDimClass}`}>L1</div>
          </div>
          <div ref={mHudComboRef} className="text-yellow-400 text-[10px] font-black uppercase mt-1 opacity-0">Grazing x1.0</div>
        </div>
        <div className="text-right">
          <div className={`text-[10px] uppercase tracking-widest ${activeTheme.uiTextDimClass} mb-1`}>Status</div>
          <div className="flex items-center gap-2 justify-end">
            <div className={`w-1.5 h-1.5 rounded-full ${gameState === 'playing' ? 'bg-green-500' : 'bg-red-500'} `}></div>
            <div className={`text-[11px] uppercase tracking-widest font-bold ${activeTheme.uiTextClass}`}>{gameState === 'playing' ? 'Sync' : 'Idle'}</div>
          </div>
        </div>
      </div>

      <div className="relative z-10 w-full max-w-5xl h-[80vh] flex flex-col items-center">
        {/* Game Container */}
        <div ref={containerRef} className={`relative w-full h-full p-1 bg-black/20 border ${activeTheme.uiBorderClass} shadow-[0_0_100px_rgba(255,255,255,0.03)] flex-1 min-h-[300px]`}>
          <div className={`absolute -top-6 left-0 text-[9px] uppercase tracking-widest ${activeTheme.uiTextDimClass} flex items-center gap-2`}>
            <span className={`w-1 h-1 ${gameState === 'playing' ? 'bg-green-400' : 'bg-white/20'} rounded-full animate-ping`} />
            Coord_Stream_SYNC
          </div>

          {/* WebCam Feed */}
          <div className="absolute -bottom-4 right-0 w-24 h-18 sm:w-24 sm:h-18 md:w-32 md:h-24 border border-white/10 overflow-hidden z-30 bg-black translate-y-full mt-2">
             <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              muted
              className="absolute inset-0 w-full h-full object-cover scale-x-[-1] opacity-50 grayscale"
            />
            <canvas
              ref={webcamCanvasRef}
              className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"
              width={128} // Just small resolution for overlay
              height={96}
            />
            <div className="absolute bottom-1 left-1 bg-black/60 px-1 text-[7px] uppercase tracking-tighter text-white/50 z-10 pointer-events-none">
              Biometric_Ref
            </div>
          </div>

          {/* Game Canvas */}
          <div className="w-full h-full relative">
            <canvas 
              ref={canvasRef} 
              width={dimensions.width} 
              height={dimensions.height}
              className="block cursor-none w-full h-full touch-none"
              style={{ backgroundColor: activeTheme.bgCanvas }}
              onTouchMove={(e) => {
                const rect = canvasRef.current?.getBoundingClientRect();
                if (rect) {
                  targetPosRef.current = {
                    x: e.touches[0].clientX - rect.left,
                    y: e.touches[0].clientY - rect.top
                  };
                }
              }}
              onMouseMove={(e) => {
                const rect = canvasRef.current?.getBoundingClientRect();
                if (rect) {
                  targetPosRef.current = {
                    x: e.clientX - rect.left,
                    y: e.clientY - rect.top
                  };
                }
              }}
            />
          </div>

          {/* Level Up Notification */}
          <AnimatePresence>
            {showLevelUp && (
              <motion.div 
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 1.2, opacity: 0 }}
                className="absolute inset-0 z-30 flex flex-col items-center justify-center pointer-events-none"
              >
                <div className={`bg-white/10 backdrop-blur-xl border ${activeTheme.uiBorderClass} px-8 py-4`}>
                  <div className={`text-[10px] uppercase tracking-[0.5em] ${activeTheme.uiTextDimClass} mb-1`}>Warning: Intensity Increase</div>
                  <div className={`text-4xl font-black italic tracking-tighter ${activeTheme.uiTextClass}`}>LEVEL {level} REACHED</div>
                </div>
              </motion.div>
            )}
            
            {/* Too Close Warning */}
            {isTooClose && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none bg-red-500/20 backdrop-blur-sm"
              >
                <div className="text-center">
                  <div className="bg-red-500 text-white px-8 py-4 rounded font-bold text-3xl tracking-widest uppercase border-4 border-red-400 animate-pulse shadow-[0_0_50px_rgba(239,68,68,0.5)]">
                    Tangan Terlalu Dekat!
                  </div>
                  <div className="mt-4 text-xs tracking-[0.3em] font-medium text-white/80 uppercase">
                    Mundur sedikit agar area gerak lebih luas
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* UI Overlays */}
          <AnimatePresence>
            {gameState === 'loading' && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className={`absolute inset-0 ${activeTheme.uiBgClass} flex flex-col items-center justify-center gap-6 z-50 p-6`}
              >
                <div className="space-y-2 text-center mb-4">
                  <h2 className={`text-2xl font-light tracking-[0.2em] uppercase ${activeTheme.uiTextDimClass}`}>System Boot</h2>
                  <div className={`w-12 h-[1px] ${activeTheme.uiTextDimClass} opacity-20 mx-auto`} />
                </div>

                <div className="flex flex-col items-center gap-4">
                  {!scriptsReady ? (
                    <>
                      <div className={`w-12 h-[1px] ${activeTheme.uiTextClass} opacity-10 relative overflow-hidden`}>
                        <div className={`absolute inset-0 ${activeTheme.uiTextClass} animate-[loading_1.5s_infinite]`} />
                      </div>
                      <p className={`font-mono ${activeTheme.uiTextDimClass} text-[9px] uppercase tracking-[0.3em]`}>Loading Dependencies...</p>
                    </>
                  ) : (
                    <motion.button 
                      initial={{ scale: 0.95, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      onClick={handleInitHardware}
                      disabled={isInitializing}
                      className={`px-10 py-4 border transition-all text-[11px] tracking-[0.4em] uppercase font-bold flex items-center gap-3 ${isInitializing ? `opacity-50 cursor-wait bg-white/5 ${activeTheme.uiBorderClass}` : `${activeTheme.uiAccentClass} ${activeTheme.uiBorderClass}`}`}
                    >
                      {isInitializing ? (
                        <RefreshCcw size={16} className="animate-spin" />
                      ) : (
                        <Camera size={16} />
                      )}
                      {isInitializing ? 'Connecting...' : 'Sync Hardware'}
                    </motion.button>
                  )}
                  {fistProgress > 0 && (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex flex-col items-center gap-2"
                    >
                      <div className="w-48 h-1 bg-white/5 rounded-full overflow-hidden">
                        <motion.div 
                          className="h-full bg-blue-500"
                          style={{ width: `${fistProgress}%` }}
                        />
                      </div>
                      <span className="text-[8px] uppercase tracking-widest text-blue-400 font-bold">Hold Fist to Confirm</span>
                    </motion.div>
                  )}
                </div>

                <p className="font-mono text-white/20 text-[8px] uppercase tracking-[0.2em] absolute bottom-12">{initStatus}</p>
              </motion.div>
            )}

            {gameState === 'menu' && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className={`absolute inset-0 ${activeTheme.uiBgClass} backdrop-blur-md flex flex-col items-center justify-center p-8 z-40`}
              >
                <div className="w-full max-w-2xl space-y-12">
                   <div className="space-y-2 text-center">
                    <div className={`text-[10px] ${activeTheme.uiTextDimClass} uppercase tracking-[0.6em] mb-4`}>Core_System_Selection</div>
                    <h2 className={`text-4xl font-light tracking-[0.3em] uppercase ${activeTheme.uiTextClass}`}>Interface Menu</h2>
                    <div className={`h-[1px] w-12 ${activeTheme.uiTextClass} opacity-20 mx-auto`} />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Dodge Mode Option */}
                    <div 
                      onClick={() => startGame('dodge')}
                      onMouseEnter={() => {
                        setHoveredButton('dodge');
                        setSelectedMenuItem(0);
                      }}
                      onMouseLeave={() => setHoveredButton(null)}
                      className={`relative p-8 border transition-all duration-300 cursor-pointer flex flex-col gap-4 ${hoveredButton === 'dodge' ? `${activeTheme.uiAccentClass} scale-105 shadow-[0_0_50px_rgba(255,255,255,0.1)]` : `bg-black/20 ${activeTheme.uiTextDimClass} ${activeTheme.uiBorderClass} hover:border-white/30`}`}
                    >
                      <div className="text-[10px] uppercase tracking-[0.4em] font-black flex justify-between">
                        <span>Mode_01</span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded ml-2 ${activeTheme.uiTextClass} bg-white/10`}>1 FINGER</span>
                      </div>
                      <h3 className="text-2xl font-black italic tracking-tighter uppercase">Neural Dodge</h3>
                      <p className={`text-[10px] uppercase leading-relaxed tracking-wider opacity-80`}>
                        High-speed evasion test. Avoid fragments and optimize reflex sync.
                      </p>
                      {hoveredButton === 'dodge' && (
                        <motion.div layoutId="select-indicator" className={`absolute -top-3 -right-3 w-6 h-6 ${activeTheme.uiBorderClass} bg-white flex items-center justify-center`}>
                          <div className={`w-1.5 h-1.5 ${activeTheme.uiBgClass} rounded-full`} />
                        </motion.div>
                      )}
                    </div>

                    {/* Maze Mode Option */}
                    <div 
                      onClick={() => startGame('maze')}
                      onMouseEnter={() => {
                        setHoveredButton('maze');
                        setSelectedMenuItem(1);
                      }}
                      onMouseLeave={() => setHoveredButton(null)}
                      className={`relative p-8 border transition-all duration-300 cursor-pointer flex flex-col gap-4 ${hoveredButton === 'maze' ? `${activeTheme.uiAccentClass} scale-105 shadow-[0_0_50px_rgba(255,255,255,0.1)]` : `bg-black/20 ${activeTheme.uiTextDimClass} ${activeTheme.uiBorderClass} hover:border-white/30`}`}
                    >
                      <div className="text-[10px] uppercase tracking-[0.4em] font-black flex justify-between">
                        <span>Mode_02</span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded ml-2 ${activeTheme.uiTextClass} bg-white/10`}>2 FINGERS</span>
                      </div>
                      <h3 className="text-2xl font-black italic tracking-tighter uppercase">Maze Crawler</h3>
                      <p className={`text-[10px] uppercase leading-relaxed tracking-wider opacity-80`}>
                        Precision navigation task. Negotiate corridors to reach the exit port.
                      </p>
                      {hoveredButton === 'maze' && (
                        <motion.div layoutId="select-indicator" className={`absolute -top-3 -right-3 w-6 h-6 ${activeTheme.uiBorderClass} bg-white flex items-center justify-center`}>
                          <div className={`w-1.5 h-1.5 ${activeTheme.uiBgClass} rounded-full`} />
                        </motion.div>
                      )}
                    </div>
                  </div>

                  <div className={`flex flex-col items-center gap-2 pt-4 border-t ${activeTheme.uiBorderClass}`}>
                     <div className={`text-[8px] uppercase tracking-[0.4em] font-black ${activeTheme.uiTextDimClass}`}>Difficulty_Level_Select</div>
                     <div className="flex gap-4">
                        <button onClick={() => { setSelectedDifficulty('easy'); (window as any).SELECTED_DIFFICULTY = 'easy'; }} className={`text-[11px] font-black uppercase tracking-widest px-3 py-1 rounded transition-colors ${selectedDifficulty === 'easy' ? 'bg-white text-black shadow-[0_0_15px_white]' : 'text-white/30 border border-white/10 hover:text-white/80'}`}>EASY</button>
                        <button onClick={() => { setSelectedDifficulty('normal'); (window as any).SELECTED_DIFFICULTY = 'normal'; }} className={`text-[11px] font-black uppercase tracking-widest px-3 py-1 rounded transition-colors ${selectedDifficulty === 'normal' ? 'bg-white text-black shadow-[0_0_15px_white]' : 'text-white/30 border border-white/10 hover:text-white/80'}`}>NORMAL</button>
                        <button onClick={() => { setSelectedDifficulty('hard'); (window as any).SELECTED_DIFFICULTY = 'hard'; }} className={`text-[11px] font-black uppercase tracking-widest px-3 py-1 rounded transition-colors ${selectedDifficulty === 'hard' ? 'bg-white text-black shadow-[0_0_15px_white]' : 'text-white/30 border border-white/10 hover:text-white/80'}`}>HARD</button>
                     </div>
                  </div>

                  <div className="flex flex-col items-center gap-6">
                    <div className="flex items-center gap-3">
                      <Hand size={14} className={activeTheme.uiTextDimClass} />
                      <span className={`text-[10px] uppercase tracking-[0.5em] ${activeTheme.uiTextDimClass}`}>CLICK MODE TO START</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {gameState === 'gameover' && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className={`absolute inset-0 ${activeTheme.uiBgClass} backdrop-blur-xl flex flex-col items-center justify-center text-center p-8 z-50 border border-red-500/10`}
              >
                <div className="space-y-12 w-full max-w-md">
                  <div className="space-y-4">
                    <motion.div 
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="text-red-500 text-[11px] font-black uppercase tracking-[0.6em]"
                    >
                      System_Failure
                    </motion.div>
                    <h2 className={`text-7xl font-black italic tracking-tighter ${activeTheme.uiTextClass}`}>DEFEATED</h2>
                  </div>

                  <div className={`grid grid-cols-2 gap-8 py-8 border-y ${activeTheme.uiBorderClass}`}>
                    <div className="text-left">
                      <div className={`text-[9px] uppercase tracking-widest ${activeTheme.uiTextDimClass} mb-1`}>Final_Score</div>
                      <div className="text-3xl font-black italic">{score}</div>
                    </div>
                    <div className="text-left">
                      <div className={`text-[9px] uppercase tracking-widest ${activeTheme.uiTextDimClass} mb-1`}>Level_Reach</div>
                      <div className="text-3xl font-black italic">{level}</div>
                    </div>
                    <div className="text-left">
                      <div className={`text-[9px] uppercase tracking-widest ${activeTheme.uiTextDimClass} mb-1`}>Peak_Combo</div>
                      <div className="text-3xl font-black italic text-yellow-400">x{(Math.floor(combo/5)+1).toFixed(1)}</div>
                    </div>
                    <div className="text-left">
                      <div className={`text-[9px] uppercase tracking-widest ${activeTheme.uiTextDimClass} mb-1`}>Global_High</div>
                      <div className="text-3xl font-black italic text-green-400">{highScore}</div>
                    </div>
                  </div>
                  
                  <button 
                    onClick={() => setGameState('menu')}
                    className={`w-full py-5 border ${activeTheme.uiBorderClass} ${activeTheme.uiTextDimClass} font-black italic text-[12px] tracking-[0.5em] uppercase hover:bg-white hover:text-black transition-all ${activeTheme.uiAccentClass}`}
                  >
                    Return_To_Menu
                  </button>

                  <button 
                    onClick={() => {
                        const mode = gameModeRef.current;
                        startGame(mode);
                    }}
                    className={`flex flex-col items-center gap-4 ${activeTheme.uiTextDimClass} cursor-pointer hover:text-white transition-colors`}
                  >
                    <div className="flex items-center gap-3">
                      <RefreshCcw size={14} className="animate-[spin_4s_linear_infinite]" />
                      <span className="text-[10px] uppercase tracking-[0.4em]">Clench Fist or Click Here to restart {gameMode.toUpperCase()}</span>
                    </div>
                  </button>
                  
                  {fistProgress > 0 && (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="mt-4 flex flex-col items-center gap-2"
                    >
                      <div className="w-full h-1 bg-red-900/30 rounded-full overflow-hidden">
                        <motion.div 
                          className="h-full bg-red-500"
                          style={{ width: `${fistProgress}%` }}
                        />
                      </div>
                      <div className="text-[9px] uppercase tracking-[0.3em] text-red-500 font-black animate-pulse">Confirming Reboot</div>
                    </motion.div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Visual Accents / Tech Logs */}
        <div className="mt-16 w-full flex justify-between items-end px-2 opacity-40">
          <div className="text-[10px] text-white/20 leading-loose uppercase tracking-[0.2em] font-light">
            [DIMS] {dimensions.width}x{dimensions.height}<br />
            [SYNC] {initStatus === 'Ready' ? 'STABLE' : 'CALIBRATING'}
          </div>
          
          <div className="flex flex-col items-end">
            <div className="text-[9px] text-white/30 tracking-widest uppercase italic mb-1">Level_{level.toString().padStart(2, '0')}</div>
            <div className="w-48 h-[1.5px] bg-white/5 relative overflow-hidden group">
               {/* Progress to next level */}
              <motion.div 
                className="absolute top-0 left-0 h-full bg-white transition-all duration-300"
                style={{ width: `${(score % POINTS_PER_LEVEL) / (POINTS_PER_LEVEL / 100)}%` }}
              />
              {/* Secondary pulse/glow for the progress bar */}
              <motion.div 
                className="absolute top-0 left-0 h-full bg-white/40 blur-[2px]"
                animate={{ x: ['-100%', '100%'] }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                style={{ width: '40%' }}
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
