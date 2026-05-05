/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState, memo, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Camera, RefreshCcw, Hand, AlertCircle, Shield, Zap, Palette, ArrowRight, ArrowLeft, Info, X } from 'lucide-react';

import { themes, Theme } from './themes';


// Game Constants
const PLAYER_RADIUS = 15;
const ENEMY_BASE_RADIUS = 12;
const SPAWN_INTERVAL_MIN = 800;
const SPAWN_INTERVAL_MAX = 1800;
const DODGE_SMOOTHING_FACTOR = 0.45;
const MAZE_SMOOTHING_FACTOR = 0.12; 
const DODGE_SENSITIVITY = 1.3;
const MAZE_SENSITIVITY = 0.12; // Decreased sensitivity for smoother maze play
const POINTS_PER_LEVEL = 300; 

interface GameObject {
  x: number;
  y: number;
  radius: number;
  speed: number;
  type?: 'enemy' | 'homing' | 'shield' | 'slow' | 'point' | 'emp';
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

interface PlayerProfile {
  credits: number;
  unlockedThemes: string[];
  upgrades: {
    duration: number;
    empRadius: number;
    magnet: number;
  }
}

const defaultProfile: PlayerProfile = {
  credits: 0,
  unlockedThemes: ['terminal'],
  upgrades: {
    duration: 0,
    empRadius: 0,
    magnet: 0,
  }
};

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const webcamCanvasRef = useRef<HTMLCanvasElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<'loading' | 'menu' | 'playing' | 'gameover' | 'shop'>('loading');
  const [profile, setProfile] = useState<PlayerProfile>(() => {
    const saved = localStorage.getItem('neuralProfile');
    return saved ? JSON.parse(saved) : defaultProfile;
  });

  const saveProfile = (newProfile: PlayerProfile) => {
    setProfile(newProfile);
    localStorage.setItem('neuralProfile', JSON.stringify(newProfile));
  };
  const profileRef = useRef(profile);
  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  const [gameMode, setGameMode] = useState<'dodge' | 'maze'>('dodge');
  const gameModeRef = useRef<'dodge' | 'maze'>('dodge');
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [combo, setCombo] = useState(0);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [highScore, setHighScore] = useState(0);
  const [showTutorial, setShowTutorial] = useState(false);
  const [isHit, setIsHit] = useState(false);
  const [activePowerUp, setActivePowerUp] = useState<string | null>(null);
  const activePowerUpRef = useRef<string | null>(null);
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
        
        const oldW = dimensionsRef.current.width;
        const oldH = dimensionsRef.current.height;
        
        // On mobile, the height can bounce due to the address bar. 
        // We only update if width changes or height changes significantly.
        if (oldW > 0 && oldH > 0) {
            const diffW = Math.abs(width - oldW);
            const diffH = Math.abs(height - oldH);
            if (diffW < 10 && diffH < 150) {
                return; // Ignore small height changes (typical mobile browser bar)
            }
        }

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
          const palmCenter = landmarks[9];
          const currentWidth = dimensionsRef.current.width;
          const currentHeight = dimensionsRef.current.height;

          // Detect Hand Size (Too Close Warning)
          const wristP = landmarks[0];
          const middleMCP = landmarks[9];
          const handSize = Math.hypot(wristP.x - middleMCP.x, wristP.y - middleMCP.y);
          setIsTooClose(handSize > 0.35);

          // Mirror X
          const rawX = (1 - palmCenter.x);
          const rawY = palmCenter.y;
          
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

          // Fist is strictly 0 fingers extended
          const isFist = fingersExtended === 0;
          
          // Track transition from fist to open to provide a grace period
          if (isFist) {
             (window as any).WAS_FIST = true;
          } else if ((window as any).WAS_FIST) {
             (window as any).WAS_FIST = false;
             (window as any).LAST_FIST_RELEASE = Date.now();
          }

          // 1. Relative Position Tracking
          if (isFirstHandRef.current || isFist) {
            // Anchor hand position without moving target pointer
            lastHandPosRef.current = { x: rawX, y: rawY };
            
            if (isFirstHandRef.current && (window as any).GAME_STATE_INTERNAL === 'menu') {
                targetPosRef.current.x = currentWidth / 2;
                targetPosRef.current.y = currentHeight / 2;
            }
            
            // Only release "first hand" lock if we start tracking with an open hand
            if (!isFist) {
                isFirstHandRef.current = false;
            }
          } else {
            const dx = rawX - lastHandPosRef.current.x;
            const dy = rawY - lastHandPosRef.current.y;
            
            const sens = (window as any).GAME_STATE_INTERNAL === 'maze' ? MAZE_SENSITIVITY : DODGE_SENSITIVITY;
            const DEADZONE = 0.001; // Tiny deadzone to ignore camera jitter
            let moveDist = Math.hypot(dx, dy);
            
            if (moveDist > DEADZONE) {
                const scale = (moveDist - DEADZONE) / moveDist;
                targetPosRef.current.x += (dx * scale) * sens * currentWidth;
                targetPosRef.current.y += (dy * scale) * sens * currentHeight;
                
                targetPosRef.current.x = Math.max(0, Math.min(currentWidth, targetPosRef.current.x));
                targetPosRef.current.y = Math.max(0, Math.min(currentHeight, targetPosRef.current.y));
            }
            
            // Always update last known raw position 
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
    const walls: { x: number, y: number, w: number, h: number }[] = [];

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

    // 5. Populate Items in Maze
    enemiesRef.current = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        // Skip start cell
        if (r === 0 && c === 0) continue;
        // Skip goal cell
        if (r === rows - 1 && c === cols - 1) continue;
        
        if (Math.random() < 0.20 + (level * 0.02)) { // Scaling item chance
             const cx = offsetX + c * cellSize + cellSize / 2;
             const cy = offsetY + r * cellSize + cellSize / 2;
             let type: GameObject['type'] = 'point';
             const rand = Math.random();
             if (rand < 0.1) type = 'shield';
             else if (rand < 0.2) type = 'emp';
             else if (rand < 0.3) type = 'slow';
             
             const radius = type === 'emp' ? 8 :
                            type === 'point' ? 6 :
                            (type === 'shield' || type === 'slow') ? 10 : 8;

             enemiesRef.current.push({
                x: cx, y: cy, radius: Math.min(radius, cellSize * 0.3), type, vx: 0, vy: 0, life: 1, color: ''
             });
        }
      }
    }
  };

  const startGame = (mode: 'dodge' | 'maze') => {
    const { width, height } = dimensionsRef.current;
    const safeWidth = width || 640;
    const safeHeight = height || 480;

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
    activePowerUpRef.current = null;
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
    const dynamicMin = Math.max(150, SPAWN_INTERVAL_MIN - (levelRef.current * 40 * difficultyRef.current));
    const spawnDelayBase = Math.max(dynamicMin, (SPAWN_INTERVAL_MAX - (levelRef.current * 100)) / (difficultyRef.current * antiCamp));
    const currentSpawnDelay = Math.max(dynamicMin, spawnDelayBase - (scoreRef.current / 80));

    // Cap maximum balls so it's always winnable
    const maxBalls = Math.min(40, 8 + Math.floor(levelRef.current * 4 * difficultyRef.current));

    if (timeSinceLastSpawn > currentSpawnDelay) {
      if (enemiesRef.current.length < maxBalls) {
        // Spawn multiple at once sometimes at higher levels
        const spawnCount = Math.min(
           maxBalls - enemiesRef.current.length, 
           levelRef.current > 3 && Math.random() < (levelRef.current * 0.08) ? (Math.random() < 0.2 ? 3 : 2) : 1
        );

        for (let i = 0; i < spawnCount; i++) {
          const rand = Math.random();
          let type: GameObject['type'] = 'enemy';
          
          if (rand < 0.1) {
              const pRand = Math.random();
              if (pRand < 0.2) type = 'emp';
              else if (pRand < 0.6) type = 'shield';
              else type = 'slow';
          } else if (rand < 0.25) {
              type = 'point';
          } else if (rand < 0.35 && levelRef.current > 1) {
              type = 'homing';
          }

          const radius = type === 'emp' ? 16 :
                         type === 'point' ? 10 :
                         type === 'homing' ? 12 :
                         (type === 'shield' || type === 'slow') ? 15 :
                         ENEMY_BASE_RADIUS + Math.random() * (levelRef.current * 2);

          let x = Math.random() * (safeWidth - radius * 2) + radius;
          
          // Enemies have a high chance of spawning on the side where the player currently is
          if ((type === 'enemy' || type === 'homing') && Math.random() < 0.7) {
              const spread = 150 + (Math.random() * 100); 
              const offset = (Math.random() - 0.5) * spread;
              x = Math.max(radius, Math.min(safeWidth - radius, playerPosRef.current.x + offset));
          }
          
          const baseSpeed = (1.5 + (levelRef.current * 0.4) + Math.random() * 1.5) * difficultyRef.current * antiCamp;
          const heightFactor = safeHeight / 600; 

          let speedMult = 1;
          if (type === 'homing') speedMult = 0.6;
          if (type === 'point') speedMult = 1.3;
          if (type === 'shield' || type === 'slow' || type === 'emp') speedMult = 0.8;

          enemiesRef.current.push({
            x,
            y: -radius - (Math.random() * 50 * i), // stagger Y if spawning multiple
            radius,
            speed: baseSpeed * heightFactor * speedMult,
            type
          });
        }
      }
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
            activePowerUpRef.current = null;
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
        playerPosRef.current.x += (targetPosRef.current.x - playerPosRef.current.x) * DODGE_SMOOTHING_FACTOR;
        playerPosRef.current.y += (targetPosRef.current.y - playerPosRef.current.y) * DODGE_SMOOTHING_FACTOR;
    }

    playerPosRef.current.x = Math.max(PLAYER_RADIUS, Math.min(safeWidth - PLAYER_RADIUS, playerPosRef.current.x));
    playerPosRef.current.y = Math.max(PLAYER_RADIUS, Math.min(safeHeight - PLAYER_RADIUS, playerPosRef.current.y));

    // 4. Update Enemies, Powerups, and Collisions
    if (!isFrozen) {
        spawnEnemy(time);
    }
    
    let activeEmp = false;
    let gameOver = false;

    enemiesRef.current = enemiesRef.current.filter((obj) => {
      let speedMult = 1;
      if (activePowerUpRef.current === 'slow') speedMult = 0.5;
      
      // Magnet Effect for 'point' and 'emp'
      if ((obj.type === 'point' || obj.type === 'emp' || obj.type === 'shield' || obj.type === 'slow') && profileRef.current.upgrades.magnet > 0) {
          const mRadius = 150 + profileRef.current.upgrades.magnet * 50;
          const dxm = playerPosRef.current.x - obj.x;
          const dym = playerPosRef.current.y - obj.y;
          const distm = Math.sqrt(dxm * dxm + dym * dym);
          if (distm < mRadius) {
              obj.x += (dxm / distm) * 6;
              obj.y += (dym / distm) * 6;
          }
      }

      if (obj.type === 'homing') {
          const dxp = playerPosRef.current.x - obj.x;
          const ext = Math.min(2 * speedMult, Math.abs(dxp) * 0.05);
          obj.x += Math.sign(dxp) * ext;
      }
      
      obj.y += obj.speed * speedMult;

      const dx = obj.x - playerPosRef.current.x;
      const dy = obj.y - playerPosRef.current.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Collision Check
      if (distance < obj.radius + PLAYER_RADIUS) {
        if (obj.type === 'enemy' || obj.type === 'homing') {
            if (activePowerUpRef.current === 'shield') {
                createParticles(obj.x, obj.y, '#3b82f6', 15);
                setActivePowerUp(null); // Shield consumed
                activePowerUpRef.current = null;
                powerUpTimerRef.current = 0;
                return false; // Enemy destroyed
            } else {
                gameOver = true;
            }
        } else if (obj.type === 'point') {
            createParticles(obj.x, obj.y, '#10b981', 10);
            scoreRef.current += 100;
            comboRef.current = Math.min(50, comboRef.current + 2);
            return false;
        } else if (obj.type === 'emp') {
            createParticles(obj.x, obj.y, '#a855f7', 20);
            activeEmp = true;
            return false;
        } else {
            // Pick up power-up shield/slow
            setActivePowerUp(obj.type!);
            activePowerUpRef.current = obj.type!;
            powerUpTimerRef.current = 5000 + (profileRef.current.upgrades.duration * 1000); 
            createParticles(obj.x, obj.y, obj.type === 'shield' ? '#3b82f6' : '#facc15', 12);
            return false;
        }
      }

      // Grazing System (Close Call)
      if ((obj.type === 'enemy' || obj.type === 'homing') && distance < (obj.radius + PLAYER_RADIUS) + 30) {
          comboRef.current = Math.min(50, comboRef.current + 0.1);
      } else {
          comboRef.current = Math.max(0, comboRef.current - 0.05);
      }

      return obj.y < safeHeight + obj.radius;
    });

    if (activeEmp) {
       const empX = playerPosRef.current.x;
       const empY = playerPosRef.current.y;
       
       enemiesRef.current.forEach(e => {
          if (e.type === 'enemy' || e.type === 'homing') {
             createParticles(e.x, e.y, activeThemeRef.current.enemyColor, 5);
             scoreRef.current += 20; 
          }
       });
       
       enemiesRef.current = enemiesRef.current.filter(e => e.type !== 'enemy' && e.type !== 'homing');
       const extRad = 1.0 + (profileRef.current.upgrades.empRadius * 0.2);
       (window as any).EMP_EFFECT = { r: 50, x: empX, y: empY, maxR: safeWidth * extRad };
    }

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
      } else if (obj.type === 'homing') {
          ctx.fillStyle = '#ef4444'; // Bright Red
          ctx.shadowColor = '#ef4444';
      } else if (obj.type === 'shield') {
          ctx.fillStyle = theme.shieldColor;
          ctx.shadowColor = theme.shieldColor;
      } else if (obj.type === 'slow') {
          ctx.fillStyle = theme.speedColor;
          ctx.shadowColor = theme.speedColor;
      } else if (obj.type === 'point') {
          ctx.fillStyle = '#10b981'; // Green
          ctx.shadowColor = '#10b981';
      } else if (obj.type === 'emp') {
          ctx.fillStyle = '#a855f7'; // Purple
          ctx.shadowColor = '#a855f7';
      }
      
      ctx.beginPath();
      if (obj.type === 'point' || obj.type === 'emp') {
          // Draw diamond
          ctx.moveTo(obj.x, obj.y - obj.radius);
          ctx.lineTo(obj.x + obj.radius, obj.y);
          ctx.lineTo(obj.x, obj.y + obj.radius);
          ctx.lineTo(obj.x - obj.radius, obj.y);
          ctx.closePath();
      } else {
          ctx.arc(obj.x, obj.y, obj.radius, 0, Math.PI * 2);
      }
      ctx.fill();
    });

    // Draw EMP Effect
    if ((window as any).EMP_EFFECT) {
       const emp = (window as any).EMP_EFFECT;
       ctx.beginPath();
       ctx.arc(emp.x, emp.y, emp.r, 0, Math.PI * 2);
       ctx.strokeStyle = `rgba(168, 85, 247, ${ Math.max(0, 1 - emp.r/emp.maxR) })`;
       ctx.lineWidth = 15;
       ctx.shadowBlur = 20;
       ctx.shadowColor = '#a855f7';
       ctx.stroke();
       ctx.shadowBlur = 0;
       
       emp.r += 30; // speed of expansion
       if (emp.r > emp.maxR) {
           (window as any).EMP_EFFECT = null;
       }
    }

    // Draw Player
    ctx.fillStyle = theme.playerColor;
    ctx.shadowBlur = 15;
    ctx.shadowColor = theme.playerShadow;
    
    // Shield Visual
    if (activePowerUpRef.current === 'shield') {
        ctx.strokeStyle = theme.shieldColor;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(playerPosRef.current.x, playerPosRef.current.y, PLAYER_RADIUS + 5, 0, Math.PI * 2);
        ctx.stroke();
    }

    ctx.beginPath();
    ctx.arc(playerPosRef.current.x, playerPosRef.current.y, PLAYER_RADIUS, 0, Math.PI * 2);
    ctx.fill();

    // Visibility Ring
    ctx.shadowBlur = 0;
    ctx.strokeStyle = activeThemeRef.current.id === 'terminal' || activeThemeRef.current.id === 'midnight' ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 2;
    ctx.stroke();

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
    const currentScore = scoreRef.current;

    const nextLevel = Math.floor(currentScore / (POINTS_PER_LEVEL * 10)) + 1;
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
        playerPosRef.current.x += (targetPosRef.current.x - playerPosRef.current.x) * MAZE_SMOOTHING_FACTOR;
        playerPosRef.current.y += (targetPosRef.current.y - playerPosRef.current.y) * MAZE_SMOOTHING_FACTOR;
    }
    
    // Bounds check
    playerPosRef.current.x = Math.max(mazePlayerRadiusRef.current, Math.min(safeWidth - mazePlayerRadiusRef.current, playerPosRef.current.x));
    playerPosRef.current.y = Math.max(mazePlayerRadiusRef.current, Math.min(safeHeight - mazePlayerRadiusRef.current, playerPosRef.current.y));

    // 1.5 Update Power-ups & Items
    if (powerUpTimerRef.current > 0) {
        powerUpTimerRef.current -= 16.6; 
        if (powerUpTimerRef.current <= 0) {
            setActivePowerUp(null);
            activePowerUpRef.current = null;
        }
    }

    let activeEmp = false;
    enemiesRef.current = enemiesRef.current.filter((obj) => {
        // Magnet effect
        if ((obj.type === 'point' || obj.type === 'emp' || obj.type === 'shield' || obj.type === 'slow') && profileRef.current.upgrades.magnet > 0) {
            const mRadius = 150 + profileRef.current.upgrades.magnet * 50;
            const dxm = playerPosRef.current.x - obj.x;
            const dym = playerPosRef.current.y - obj.y;
            const distm = Math.sqrt(dxm * dxm + dym * dym);
            if (distm < mRadius) {
               // Move slightly towards player
               obj.x += (dxm / distm) * 2;
               obj.y += (dym / distm) * 2;
            }
        }

        const dx = playerPosRef.current.x - obj.x;
        const dy = playerPosRef.current.y - obj.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < obj.radius + mazePlayerRadiusRef.current) {
            if (obj.type === 'point') {
                createParticles(obj.x, obj.y, '#10b981', 10);
                scoreRef.current += 100;
                return false;
            } else if (obj.type === 'emp') {
                createParticles(obj.x, obj.y, '#a855f7', 20);
                activeEmp = true;
                return false;
            } else if (obj.type === 'shield' || obj.type === 'slow') {
                setActivePowerUp(obj.type!);
                activePowerUpRef.current = obj.type!;
                powerUpTimerRef.current = 5000 + (profileRef.current.upgrades.duration * 1000);
                createParticles(obj.x, obj.y, obj.type === 'shield' ? '#3b82f6' : '#facc15', 12);
                return false;
            }
            return false;
        }
        return true;
    });

    if (activeEmp) {
        const empX = playerPosRef.current.x;
        const empY = playerPosRef.current.y;
        const extRad = 100 + (profileRef.current.upgrades.empRadius * 50);
        (window as any).EMP_EFFECT = { r: 10, x: empX, y: empY, maxR: extRad };
        scoreRef.current += 200;

        // Break walls near EMP
        mazeWallsRef.current = mazeWallsRef.current.filter(wall => {
           const closestX = Math.max(wall.x, Math.min(empX, wall.x + wall.w));
           const closestY = Math.max(wall.y, Math.min(empY, wall.y + wall.h));
           const dx = empX - closestX;
           const dy = empY - closestY;
           const distance = Math.sqrt(dx * dx + dy * dy);
           if (distance < extRad) {
               createParticles(closestX, closestY, '#a855f7', 3);
               return false; // Remove wall
           }
           return true;
        });
    }

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
            if (activePowerUpRef.current === 'shield') {
               createParticles(playerPosRef.current.x, playerPosRef.current.y, '#3b82f6', 15);
               setActivePowerUp(null);
               activePowerUpRef.current = null;
               powerUpTimerRef.current = 0;
               // Destroy the wall to prevent getting stuck
               mazeWallsRef.current = mazeWallsRef.current.filter(w => w !== wall);
               break; 
            } else {
               gameOver = true;
               break;
            }
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
    
    // Draw Objects (Items)
    enemiesRef.current.forEach(obj => {
      ctx.shadowBlur = 10;
      if (obj.type === 'shield') {
          ctx.fillStyle = theme.shieldColor;
          ctx.shadowColor = theme.shieldColor;
      } else if (obj.type === 'slow') {
          ctx.fillStyle = theme.speedColor;
          ctx.shadowColor = theme.speedColor;
      } else if (obj.type === 'point') {
          ctx.fillStyle = '#10b981'; // Green
          ctx.shadowColor = '#10b981';
      } else if (obj.type === 'emp') {
          ctx.fillStyle = '#a855f7'; // Purple
          ctx.shadowColor = '#a855f7';
      }

      ctx.beginPath();
      if (obj.type === 'emp' || obj.type === 'point') {
          // Inner core
          ctx.arc(obj.x, obj.y, obj.radius * 0.5, 0, Math.PI * 2);
          ctx.fill();
          // Outer ring
          ctx.beginPath();
          ctx.arc(obj.x, obj.y, obj.radius, 0, Math.PI * 2);
          ctx.strokeStyle = ctx.fillStyle;
          ctx.lineWidth = 2;
          ctx.stroke();
      } else {
          ctx.arc(obj.x, obj.y, obj.radius, 0, Math.PI * 2);
          ctx.fill();
      }
    });

    // Draw EMP Effect
    if ((window as any).EMP_EFFECT) {
       const emp = (window as any).EMP_EFFECT;
       ctx.beginPath();
       ctx.arc(emp.x, emp.y, emp.r, 0, Math.PI * 2);
       ctx.strokeStyle = `rgba(168, 85, 247, ${ Math.max(0, 1 - emp.r/emp.maxR) })`;
       ctx.lineWidth = 15;
       ctx.shadowBlur = 20;
       ctx.shadowColor = '#a855f7';
       ctx.stroke();
       ctx.shadowBlur = 0;
       
       emp.r += 30; // speed of expansion
       if (emp.r > emp.maxR) {
           (window as any).EMP_EFFECT = null;
       }
    }

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
    
    // Shield Visual
    if (activePowerUpRef.current === 'shield') {
        ctx.strokeStyle = theme.shieldColor;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(playerPosRef.current.x, playerPosRef.current.y, mazePlayerRadiusRef.current + 5, 0, Math.PI * 2);
        ctx.stroke();
    }

    // Add white/black ring based on theme to ensure visibility
    ctx.shadowBlur = 0;
    ctx.strokeStyle = theme.id === 'terminal' || theme.id === 'midnight' ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(playerPosRef.current.x, playerPosRef.current.y, mazePlayerRadiusRef.current, 0, Math.PI * 2);
    ctx.stroke();
    
    if (isFrozen) {
        ctx.fillStyle = "white";
        ctx.font = "bold 24px monospace";
        ctx.textAlign = "center";
        const timeLeft = Math.ceil(((window as any).LEVEL_TRANSITION_UNTIL - performance.now()) / 1000);
        ctx.fillText(`SYSTEM STANDBY: ${timeLeft}s`, safeWidth / 2, safeHeight / 2 - 40);
        ctx.font = "12px monospace";
        ctx.fillText("Syncing neural pathways...", safeWidth / 2, safeHeight / 2 - 20);
    }

    // Removed passive score
    if (gameOver) {
        handleGameOver();
    } else {
        requestRef.current = requestAnimationFrame(mazeLoop);
    }
  };

  const handleGameOver = () => {
    setIsHit(true);
    // Snapshot values for the gameover screen
    const finalScore = scoreRef.current;
    
    // Add to user credits
    setProfile(prev => {
        const p = { ...prev, credits: prev.credits + finalScore };
        localStorage.setItem('neuralProfile', JSON.stringify(p));
        return p;
    });

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
            const s = scoreRef.current.toString().padStart(5, '0');
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
    <div className={`fixed inset-0 w-full h-full overscroll-none touch-none ${activeTheme.uiBgClass} ${activeTheme.uiTextClass} font-mono flex flex-col items-center justify-center p-2 md:p-4 overflow-hidden select-none transition-colors duration-200 ${isHit ? 'hit-flash' : ''}`}>
      
      {/* Theme Selector (Only in Menu) */}
      {gameState === 'menu' && (
        <div className="absolute top-4 right-4 md:top-6 md:right-6 z-50 flex items-center gap-2 md:gap-4 scale-90 md:scale-100 origin-top-right">
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
             <span className={`text-[9px] md:text-[10px] uppercase font-bold tracking-[0.2em] w-20 md:w-24 text-center ${activeTheme.uiTextClass}`}>{activeTheme.name}</span>
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
      {(gameState === 'menu' || gameState === 'shop' || gameState === 'gameover' || gameState === 'loading') && scriptsReady && (
        <div 
          ref={cursorRef}
          className="fixed pointer-events-none z-[1000] transition-none"
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



      <div className="relative z-10 w-full max-w-5xl flex-1 flex flex-col items-center p-2 md:p-6 overflow-hidden">
        {/* UI: HUD Elements - Fixed height container to prevent layout shifting */}
        <div className="w-full h-20 md:h-24 flex items-center justify-center shrink-0">
          <AnimatePresence>
            {gameState === 'playing' && (
              <motion.div 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="w-full flex justify-between items-center px-4 md:px-0"
              >
                
                {/* Left: Info Accents (Desktop only) */}
                <div className="hidden md:block w-1/3">
                  <div className={`text-[9px] uppercase tracking-[0.3em] ${activeTheme.uiTextDimClass} opacity-50`}>
                    Link_Stability: 100%<br />
                    Packet_Loss: 0.00%
                  </div>
                </div>

                {/* Center: Score & Telemetry - Dominant HUD */}
                <div className="flex flex-col items-center w-full md:w-1/3 shrink-0">
                  <div className={`text-[9px] md:text-[10px] uppercase tracking-[0.4em] ${activeTheme.uiTextDimClass} mb-1 drop-shadow-md`}>Neural_Telemetry</div>
                  <div className="flex items-baseline gap-3 bg-black/40 backdrop-blur-sm px-6 py-2 rounded-xl border border-white/5 shadow-2xl">
                    <div ref={hudScoreRef} className={`text-4xl md:text-5xl font-black italic tracking-tighter ${activeTheme.uiTextClass} drop-shadow-md`}>
                      00000
                    </div>
                    <div className="flex flex-col items-start justify-center">
                      <div ref={hudLvlRef} className={`text-[10px] font-bold ${activeTheme.uiTextClass} bg-black/60 px-2 py-0.5 rounded-sm mb-1`}>LVL 1</div>
                      <div ref={hudComboRef} className="text-yellow-400 text-[10px] md:text-xs font-black italic transition-opacity duration-200 opacity-0 bg-black/60 px-2 rounded-sm drop-shadow-lg">
                          x1.0
                      </div>
                    </div>
                  </div>
                  {/* Mobile Level shortcut */}
                  <div ref={mHudLvlRef} className="md:hidden mt-1 text-[8px] font-bold uppercase tracking-widest opacity-50">L1</div>
                </div>

                {/* Right: Status & Efficiency */}
                <div className="w-1/3 text-right hidden md:flex flex-col items-end">
                  <div className={`text-[10px] uppercase tracking-[0.4em] ${activeTheme.uiTextDimClass} mb-2`}>System_Efficiency</div>
                  <div className="flex items-center gap-3 justify-end">
                     {activePowerUp && (
                        <motion.div 
                          key={activePowerUp}
                          initial={{ scale: 0.8 }}
                          animate={{ scale: [1, 1.1, 1] }}
                          transition={{ repeat: Infinity }}
                          className={`px-3 py-1 text-[10px] font-bold uppercase tracking-widest border ${activePowerUp === 'shield' ? 'border-blue-500 text-blue-400' : 'border-yellow-500 text-yellow-400'} rounded-sm bg-black/60`}
                        >
                          {activePowerUp}_Active
                        </motion.div>
                     )}
                    <div className={`w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]`}></div>
                    <div className={`text-xs uppercase tracking-[0.2em] font-medium ${activeTheme.uiTextDimClass}`}>
                      Live_Feed
                    </div>
                  </div>
                </div>

                {/* Mobile Specific Refs (mapped but hidden to keep ref logic working) */}
                <div className="hidden">
                   <div ref={mHudScoreRef}></div>
                   <div ref={mHudComboRef}></div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Game Container Wrapper - responsive aspect ratio */}
        <div className="relative w-full flex-1 flex items-center justify-center min-h-0 z-20 px-2 lg:px-8">
          <div 
            ref={containerRef} 
            className={`relative bg-black/20 border ${activeTheme.uiBorderClass} shadow-[0_0_100px_rgba(255,255,255,0.03)] flex flex-col w-full max-h-full min-h-0 min-w-0 flex-shrink overflow-hidden`}
            style={{
               aspectRatio: '16/10',
            }}
          >
          <div className={`absolute -top-1 md:-top-6 left-0 text-[8px] md:text-[9px] uppercase tracking-widest ${activeTheme.uiTextDimClass} flex items-center gap-2 px-2 md:px-0`}>
            <span className={`w-1 h-1 ${gameState === 'playing' ? 'bg-green-400' : 'bg-white/20'} rounded-full animate-ping`} />
            Coord_Stream_SYNC
          </div>

          <div className={`absolute -top-1 md:-top-6 right-0 text-[8px] md:text-[9px] uppercase tracking-widest ${activeTheme.uiTextDimClass} hidden sm:block`}>
            Bitrate: {(Math.random() * 5 + 15).toFixed(1)} Mbps
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
                className={`fixed inset-0 ${activeTheme.uiBgClass} flex flex-col items-center justify-center gap-6 z-[100] p-6`}
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
                className={`fixed inset-0 w-full h-[100dvh] ${activeTheme.uiBgClass} backdrop-blur-md z-[100] overflow-y-auto overflow-x-hidden`}
              >
                <div className="min-h-full flex flex-col items-center justify-center p-4 pt-16 pb-8 md:p-8">
                  <div className="w-full max-w-2xl space-y-6 md:space-y-12">
                   <div className="space-y-2 text-center">
                    <div className={`text-[9px] md:text-[10px] ${activeTheme.uiTextDimClass} uppercase tracking-[0.6em] mb-4`}>Core_System_Selection</div>
                    <h2 className={`text-2xl md:text-5xl font-light tracking-[0.3em] uppercase ${activeTheme.uiTextClass}`}>Interface Menu</h2>
                    <div className={`h-[1px] w-12 ${activeTheme.uiTextClass} opacity-20 mx-auto`} />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                    {/* Dodge Mode Option */}
                    <div 
                      onClick={() => startGame('dodge')}
                      onMouseEnter={() => {
                        setHoveredButton('dodge');
                        setSelectedMenuItem(0);
                      }}
                      onMouseLeave={() => setHoveredButton(null)}
                      className={`relative p-5 md:p-8 border transition-all duration-300 cursor-pointer flex flex-col gap-3 md:gap-4 ${hoveredButton === 'dodge' ? `${activeTheme.uiAccentClass} scale-100 md:scale-105 shadow-[0_0_30px_rgba(255,255,255,0.1)]` : `bg-black/20 ${activeTheme.uiTextDimClass} ${activeTheme.uiBorderClass} hover:border-white/30`}`}
                    >
                      <div className="text-[10px] uppercase tracking-[0.4em] font-black flex justify-between">
                        <span>Mode_01</span>
                        <span className={`text-[8px] md:text-[9px] px-1.5 py-0.5 rounded ml-2 ${activeTheme.uiTextClass} bg-white/10`}>1 FINGER</span>
                      </div>
                      <h3 className="text-xl md:text-2xl font-black italic tracking-tighter uppercase">Neural Dodge</h3>
                      <p className={`text-[9px] md:text-[10px] uppercase leading-relaxed tracking-wider opacity-80`}>
                        High-speed evasion test. Avoid fragments and optimize reflex sync.
                      </p>
                      {hoveredButton === 'dodge' && (
                        <motion.div layoutId="select-indicator" className={`absolute -top-3 -right-3 w-6 h-6 ${activeTheme.uiBorderClass} bg-white hidden md:flex items-center justify-center`}>
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
                      className={`relative p-5 md:p-8 border transition-all duration-300 cursor-pointer flex flex-col gap-3 md:gap-4 ${hoveredButton === 'maze' ? `${activeTheme.uiAccentClass} scale-100 md:scale-105 shadow-[0_0_30px_rgba(255,255,255,0.1)]` : `bg-black/20 ${activeTheme.uiTextDimClass} ${activeTheme.uiBorderClass} hover:border-white/30`}`}
                    >
                      <div className="text-[10px] uppercase tracking-[0.4em] font-black flex justify-between">
                        <span>Mode_02</span>
                        <span className={`text-[8px] md:text-[9px] px-1.5 py-0.5 rounded ml-2 ${activeTheme.uiTextClass} bg-white/10`}>2 FINGERS</span>
                      </div>
                      <h3 className="text-xl md:text-2xl font-black italic tracking-tighter uppercase">Maze Crawler</h3>
                      <p className={`text-[9px] md:text-[10px] uppercase leading-relaxed tracking-wider opacity-80`}>
                        Precision navigation task. Negotiate corridors to reach the exit port.
                      </p>
                      {hoveredButton === 'maze' && (
                        <motion.div layoutId="select-indicator" className={`absolute -top-3 -right-3 w-6 h-6 ${activeTheme.uiBorderClass} bg-white hidden md:flex items-center justify-center`}>
                          <div className={`w-1.5 h-1.5 ${activeTheme.uiBgClass} rounded-full`} />
                        </motion.div>
                      )}
                    </div>
                  </div>

                  <div className={`flex flex-col items-center gap-2 pt-4 border-t ${activeTheme.uiBorderClass}`}>
                     <div className={`text-[8px] uppercase tracking-[0.4em] font-black ${activeTheme.uiTextDimClass}`}>Difficulty_Level_Select</div>
                     <div className="flex flex-wrap justify-center gap-2 md:gap-4">
                        <button onClick={() => { setSelectedDifficulty('easy'); (window as any).SELECTED_DIFFICULTY = 'easy'; }} className={`text-[10px] md:text-[11px] font-black uppercase tracking-widest px-3 py-1.5 md:py-1 rounded transition-colors ${selectedDifficulty === 'easy' ? 'bg-white text-black shadow-[0_0_15px_white]' : 'text-white/30 border border-white/10 hover:text-white/80'}`}>EASY</button>
                        <button onClick={() => { setSelectedDifficulty('normal'); (window as any).SELECTED_DIFFICULTY = 'normal'; }} className={`text-[10px] md:text-[11px] font-black uppercase tracking-widest px-3 py-1.5 md:py-1 rounded transition-colors ${selectedDifficulty === 'normal' ? 'bg-white text-black shadow-[0_0_15px_white]' : 'text-white/30 border border-white/10 hover:text-white/80'}`}>NORMAL</button>
                        <button onClick={() => { setSelectedDifficulty('hard'); (window as any).SELECTED_DIFFICULTY = 'hard'; }} className={`text-[10px] md:text-[11px] font-black uppercase tracking-widest px-3 py-1.5 md:py-1 rounded transition-colors ${selectedDifficulty === 'hard' ? 'bg-white text-black shadow-[0_0_15px_white]' : 'text-white/30 border border-white/10 hover:text-white/80'}`}>HARD</button>
                     </div>
                  </div>
                  
                  {/* Neural Shop & Credits */}
                  <div className={`flex justify-between items-center w-full pt-4 border-t ${activeTheme.uiBorderClass}`}>
                     <div className="flex flex-col">
                        <div className={`text-[8px] uppercase tracking-[0.4em] font-black ${activeTheme.uiTextDimClass}`}>Neural_Fragments</div>
                        <div className={`text-xl font-mono ${activeTheme.uiTextClass}`}>{profile.credits}</div>
                     </div>
                     <button
                        onClick={() => setGameState('shop')}
                        className={`px-4 py-2 border ${activeTheme.uiBorderClass} ${activeTheme.uiTextDimClass} hover:text-white hover:bg-white/10 transition-colors text-[9px] md:text-[10px] uppercase tracking-widest`}
                     >
                        Black Market / Upgrades
                     </button>
                  </div>

                  <div className="flex flex-col items-center gap-4 md:gap-6 pt-4">
                    <div className="flex items-center gap-3">
                      <Hand size={14} className={activeTheme.uiTextDimClass} />
                      <span className={`text-[9px] md:text-[10px] uppercase tracking-[0.5em] ${activeTheme.uiTextDimClass}`}>CLICK MODE TO START</span>
                    </div>

                    <button
                      onClick={() => setShowTutorial(true)}
                      className={`flex items-center gap-2 px-4 py-2 border ${activeTheme.uiBorderClass} ${activeTheme.uiTextDimClass} hover:text-white transition-colors text-[9px] md:text-[10px] uppercase tracking-widest mt-2`}
                    >
                      <Info size={14} />
                      System_Tutorial
                    </button>
                  </div>
                 </div>
                </div>
              </motion.div>
            )}

            {gameState === 'shop' && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className={`fixed inset-0 w-full h-[100dvh] ${activeTheme.uiBgClass} backdrop-blur-md z-[100] overflow-y-auto overflow-x-hidden`}
              >
                <div className="min-h-full flex flex-col items-center justify-center p-4 pt-16 pb-8 md:p-8">
                  <div className="w-full max-w-3xl space-y-6 md:space-y-12 bg-black/40 border border-white/10 p-6 md:p-10 shadow-2xl relative">
                    <button 
                      onClick={() => setGameState('menu')}
                      className="absolute top-4 left-4 flex items-center gap-2 text-[9px] uppercase tracking-widest hover:text-white transition-colors opacity-70"
                    >
                      <ArrowLeft size={14} /> Back to Menu
                    </button>
                    
                    <div className="text-center">
                      <div className={`text-[9px] md:text-[10px] ${activeTheme.uiTextDimClass} uppercase tracking-[0.6em] mb-4`}>Black Market</div>
                      <h2 className={`text-2xl md:text-5xl font-light tracking-[0.3em] uppercase ${activeTheme.uiTextClass}`}>System Upgrades</h2>
                      <div className={`h-[1px] w-12 ${activeTheme.uiTextClass} opacity-20 mx-auto mt-4`} />
                    </div>

                    <div className="flex justify-between items-center bg-white/5 p-4 border border-white/10">
                       <span className="text-xs uppercase tracking-widest opacity-80">Available Fragments</span>
                       <span className="text-xl font-mono text-green-400 font-bold">{profile.credits}</span>
                    </div>

                    <div className="space-y-4">
                       {[
                         { id: 'duration', name: 'Power Duration', desc: 'Increases the active time of Shield and Slow power-ups.', icon: <Zap size={20}/>, lvl: profile.upgrades.duration },
                         { id: 'empRadius', name: 'EMP Yield', desc: 'Expands the destructive radius of EMP pick-ups.', icon: <AlertCircle size={20} />, lvl: profile.upgrades.empRadius },
                         { id: 'magnet', name: 'Data Magnet', desc: 'Attracts nearby data points and power-ups automatically.', icon: <RefreshCcw size={20} />, lvl: profile.upgrades.magnet },
                       ].map((upg) => {
                          const cost = Math.floor(5000 * Math.pow(3, upg.lvl));
                          const isMax = upg.lvl >= 5;
                          const canBuy = !isMax && profile.credits >= cost;
                          return (
                            <div key={upg.id} className="flex flex-col md:flex-row items-start md:items-center justify-between bg-white/5 border border-white/5 p-4 hover:border-white/20 transition-colors gap-4">
                               <div className="flex items-center gap-4">
                                  <div className="w-10 h-10 bg-white/10 flex items-center justify-center text-white/70">
                                      {upg.icon}
                                  </div>
                                  <div>
                                     <div className="flex justify-between w-full md:w-auto items-center md:items-end gap-3 mb-1">
                                        <span className="font-bold uppercase tracking-wider text-sm">{upg.name}</span>
                                        <span className="text-[10px] font-mono text-white/50 tracking-widest">LVL {upg.lvl}/5</span>
                                     </div>
                                     <p className="text-[10px] text-white/50 leading-relaxed md:max-w-sm">{upg.desc}</p>
                                  </div>
                               </div>
                               <button 
                                 onClick={() => {
                                   if (canBuy) {
                                      const p = { ...profile, credits: profile.credits - cost };
                                      p.upgrades = { ...p.upgrades, [upg.id as keyof typeof p.upgrades]: upg.lvl + 1 };
                                      saveProfile(p);
                                   }
                                 }}
                                 disabled={!canBuy}
                                 className={`px-4 py-2 text-xs uppercase tracking-widest font-black transition-all ${isMax ? 'opacity-30 text-white cursor-not-allowed border border-white/20' : canBuy ? 'bg-white text-black hover:bg-white/80 shadow-[0_0_15px_rgba(255,255,255,0.4)]' : 'border border-red-500/30 text-red-400 opacity-50 cursor-not-allowed'}`}
                               >
                                 {isMax ? 'MAXED' : canBuy ? `UPGRADE [${cost}]` : `NEED ${cost-profile.credits} MORE`}
                               </button>
                            </div>
                          );
                       })}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {showTutorial && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className={`fixed inset-0 w-full h-[100dvh] bg-black/90 backdrop-blur-xl z-[200] flex items-center justify-center p-4`}
              >
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 20 }}
                  transition={{ type: "spring", damping: 25, stiffness: 300 }}
                  className={`relative w-full max-w-3xl max-h-[90vh] overflow-y-auto border bg-black/80 p-6 md:p-10 shadow-[0_0_50px_rgba(255,255,255,0.05)] border-white/20`}
                >
                  <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-20">
                     <div className="w-full h-[2px] bg-white absolute top-0 left-0 animate-[scan_3s_linear_infinite]" />
                     <div className="w-full h-full bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:20px_20px]" />
                  </div>
                  <button 
                    onClick={() => setShowTutorial(false)}
                    className="absolute top-4 right-4 text-white/50 hover:text-white transition-colors z-10"
                  >
                    <X size={24} />
                  </button>

                  <h2 className="text-2xl md:text-4xl font-light tracking-[0.3em] uppercase text-white mb-8 text-center border-b border-white/20 pb-6 relative">
                    <span className="animate-pulse shadow-white drop-shadow-md">System Protocol</span>
                  </h2>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 relative z-10">
                    {/* Controls */}
                    <div className="space-y-6">
                      <h3 className="text-white text-sm tracking-[0.4em] uppercase border-l-2 border-white pl-3">Gesture Controls</h3>
                      
                      <div className="space-y-4">
                        <div className="flex gap-4 items-start bg-white/5 p-4 rounded-lg">
                          <Hand size={24} className="text-blue-400 mt-1 shrink-0" />
                          <div>
                            <div className="text-white font-bold uppercase tracking-wider mb-1">Open Hand 🖐️</div>
                            <div className="text-white/60 text-sm leading-relaxed">
                              Move your cursor or player character around the arena by pointing your open palm. Tracked by the green biometric dot.
                            </div>
                          </div>
                        </div>

                        <div className="flex gap-4 items-start bg-white/5 p-4 rounded-lg">
                          <Hand size={24} className="text-red-400 mt-1 shrink-0 bg-red-400/20 rounded-full" />
                          <div>
                            <div className="text-white font-bold uppercase tracking-wider mb-1">Make a Fist ✊</div>
                            <div className="text-white/60 text-sm leading-relaxed">
                              Clench your hand to trigger an action (Select in Menu, Stop in Maze). Hold until the circular gauge fills.
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex gap-4 items-start bg-white/5 p-4 rounded-lg">
                          <div className="text-2xl mt-1 shrink-0">✌️</div>
                          <div>
                            <div className="text-white font-bold uppercase tracking-wider mb-1">Two Fingers</div>
                            <div className="text-white/60 text-sm leading-relaxed">
                              Required for Maze Crawler. Keep index and middle fingers up to move precisely.
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Modes & Items */}
                    <div className="space-y-6">
                      <h3 className="text-white text-sm tracking-[0.4em] uppercase border-l-2 border-white pl-3">Combat Entities</h3>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white/5 p-4 rounded-lg flex flex-col items-center text-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-red-500 shadow-[0_0_10px_red]"></div>
                          <div className="text-white text-xs font-bold uppercase">Enemy</div>
                          <div className="text-white/50 text-[10px]">Avoid at all costs</div>
                        </div>

                        <div className="bg-white/5 p-4 rounded-lg flex flex-col items-center text-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-red-500 shadow-[0_0_10px_red] animate-pulse"></div>
                          <div className="text-white text-xs font-bold uppercase">Seeker</div>
                          <div className="text-white/50 text-[10px]">Follows your movement</div>
                        </div>

                        <div className="bg-white/5 p-4 rounded-lg flex flex-col items-center text-center gap-2">
                           <div className="w-6 h-6 border-2 border-blue-400 bg-blue-400/20 rounded-full flex items-center justify-center">
                            <Shield size={12} className="text-blue-400" />
                          </div>
                          <div className="text-white text-xs font-bold uppercase">Shield</div>
                          <div className="text-white/50 text-[10px]">Blocks 1 hit</div>
                        </div>

                        <div className="bg-white/5 p-4 rounded-lg flex flex-col items-center text-center gap-2">
                          <div className="w-6 h-6 border-2 border-purple-500 shadow-[0_0_15px_purple] bg-purple-500 flex items-center justify-center rotate-45 transform">
                            <Zap size={12} className="text-white -rotate-45" />
                          </div>
                          <div className="text-white text-xs font-bold uppercase">EMP</div>
                          <div className="text-white/50 text-[10px]">Destroys all visible enemies</div>
                        </div>

                        <div className="bg-white/5 p-4 rounded-lg flex flex-col items-center text-center gap-2">
                           <div className="w-6 h-6 border-2 border-green-500 bg-green-500 flex items-center justify-center rotate-45 transform">
                          </div>
                          <div className="text-white text-xs font-bold uppercase">Data Point</div>
                          <div className="text-white/50 text-[10px]">+100 Score</div>
                        </div>
                        
                        <div className="bg-white/5 p-4 rounded-lg flex flex-col items-center text-center gap-2">
                           <div className="w-6 h-6 border-2 border-yellow-400 bg-yellow-400/20 rounded-full flex items-center justify-center">
                            <div className="text-yellow-400 text-xs font-bold">»</div>
                          </div>
                          <div className="text-white text-xs font-bold uppercase">Time Dilation</div>
                          <div className="text-white/50 text-[10px]">Slows all objects</div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-12 text-center relative z-10 w-full flex justify-center">
                     <button
                        onClick={() => setShowTutorial(false)}
                        className={`group relative overflow-hidden px-10 py-4 bg-white text-black font-black uppercase tracking-[0.4em] transition-all hover:scale-105 active:scale-95 shadow-[0_0_30px_rgba(255,255,255,0.4)] flex items-center gap-3`}
                     >
                       <span className="relative z-10">Initialize Sequence</span>
                       <ArrowRight size={18} className="relative z-10 group-hover:translate-x-1 transition-transform" />
                       <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent -translate-x-full group-hover:animate-[loading_1s_infinite] skew-x-12" />
                     </button>
                  </div>
                </motion.div>
              </motion.div>
            )}

            {gameState === 'gameover' && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className={`fixed inset-0 w-full h-[100dvh] ${activeTheme.uiBgClass} backdrop-blur-xl z-[100] border border-red-500/10 overflow-y-auto overflow-x-hidden`}
              >
                <div className="min-h-full flex flex-col items-center justify-center text-center p-4 pt-16 pb-8 md:p-8">
                  <div className="space-y-6 md:space-y-10 w-full max-w-md">
                  <div className="space-y-2 md:space-y-4 pt-4">
                    <motion.div 
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="text-red-500 text-[9px] md:text-[11px] font-black uppercase tracking-[0.6em]"
                    >
                      System_Failure
                    </motion.div>
                    <h2 className={`text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black italic tracking-tighter ${activeTheme.uiTextClass}`}>DEFEATED</h2>
                  </div>

                  <div className={`grid grid-cols-2 gap-4 md:gap-8 py-6 md:py-8 border-y ${activeTheme.uiBorderClass}`}>
                    <div className="text-left">
                      <div className={`text-[8px] md:text-[9px] uppercase tracking-widest ${activeTheme.uiTextDimClass} mb-1`}>Final_Score</div>
                      <div className="text-xl md:text-3xl font-black italic">{score}</div>
                    </div>
                    <div className="text-left">
                      <div className={`text-[8px] md:text-[9px] uppercase tracking-widest ${activeTheme.uiTextDimClass} mb-1`}>Level_Reach</div>
                      <div className="text-xl md:text-3xl font-black italic">{level}</div>
                    </div>
                    <div className="text-left">
                      <div className={`text-[8px] md:text-[9px] uppercase tracking-widest ${activeTheme.uiTextDimClass} mb-1`}>Peak_Combo</div>
                      <div className="text-xl md:text-3xl font-black italic text-yellow-400">x{(Math.floor(combo/5)+1).toFixed(1)}</div>
                    </div>
                    <div className="text-left">
                      <div className={`text-[8px] md:text-[9px] uppercase tracking-widest ${activeTheme.uiTextDimClass} mb-1`}>Global_High</div>
                      <div className="text-xl md:text-3xl font-black italic text-green-400">{highScore}</div>
                    </div>
                    <div className="col-span-2 text-center mt-2 p-3 bg-white/5 border border-white/10">
                      <div className={`text-[8px] md:text-[9px] uppercase tracking-widest ${activeTheme.uiTextDimClass} mb-1`}>Fragments Acquired</div>
                      <div className="text-2xl font-black font-mono text-white">+{score} <span className="text-[10px] text-white/50">Total: {profile.credits}</span></div>
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-3 pb-6">
                    <button 
                      onClick={() => setGameState('menu')}
                      className={`w-full py-4 border ${activeTheme.uiBorderClass} ${activeTheme.uiTextDimClass} font-black italic text-[10px] md:text-[12px] tracking-[0.5em] uppercase hover:bg-white hover:text-black transition-all ${activeTheme.uiAccentClass}`}
                    >
                      Return_To_Menu
                    </button>

                    <button 
                      onClick={() => {
                          const mode = gameModeRef.current;
                          startGame(mode);
                      }}
                      className={`flex flex-col items-center gap-2 pt-2 ${activeTheme.uiTextDimClass} cursor-pointer hover:text-white transition-colors`}
                    >
                      <div className="flex items-center gap-3">
                        <RefreshCcw size={14} className="animate-[spin_4s_linear_infinite]" />
                        <span className="text-[8px] md:text-[10px] uppercase tracking-[0.3em] md:tracking-[0.4em]">Clench Fist to Restart {gameMode.toUpperCase()}</span>
                      </div>
                    </button>
                  </div>
                  
                  {fistProgress > 0 && (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="mt-2 flex flex-col items-center gap-2"
                    >
                      <div className="w-full h-1 bg-red-900/30 rounded-full overflow-hidden">
                        <motion.div 
                          className="h-full bg-red-500"
                          style={{ width: `${fistProgress}%` }}
                        />
                      </div>
                      <div className="text-[8px] md:text-[9px] uppercase tracking-[0.3em] text-red-500 font-black animate-pulse">Confirming Reboot</div>
                    </motion.div>
                  )}
                 </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        </div>

        {/* WebCam Feed */}
        <div className="fixed bottom-4 right-4 md:bottom-8 md:right-8 w-24 h-18 sm:w-24 sm:h-18 md:w-32 md:h-24 border border-white/10 overflow-hidden z-[90] bg-black shadow-lg shadow-black/50 block">
           <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            muted
            className="absolute inset-0 w-full h-full object-cover scale-x-[-1] opacity-60 grayscale"
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
