/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, Target, Trophy, AlertTriangle, RefreshCw, Languages } from 'lucide-react';
import confetti from 'canvas-confetti';

// --- Constants ---
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const ROCKET_SPEED_MIN = 0.25;
const ROCKET_SPEED_MAX = 0.75;
const MISSILE_SPEED = 7;
const EXPLOSION_RADIUS_MAX = 40;
const EXPLOSION_GROWTH_RATE = 1.5;
const SCORE_PER_ROCKET = 20;
const WIN_SCORE = 1000;

// --- Types ---
type Language = 'en' | 'zh';

interface Point {
  x: number;
  y: number;
}

interface Entity extends Point {
  id: string;
}

interface Rocket extends Entity {
  targetX: number;
  targetY: number;
  speed: number;
  color: string;
}

interface Missile extends Entity {
  destX: number;
  destY: number;
  startX: number;
  startY: number;
}

interface Explosion extends Entity {
  radius: number;
  growing: boolean;
}

interface Battery {
  x: number;
  y: number;
  ammo: number;
  maxAmmo: number;
  destroyed: boolean;
}

interface City {
  x: number;
  y: number;
  destroyed: boolean;
}

const TRANSLATIONS = {
  en: {
    title: "Max Nova Defense",
    start: "Start Game",
    gameOver: "Game Over",
    victory: "Victory!",
    score: "Score",
    ammo: "Ammo",
    playAgain: "Play Again",
    instructions: "Click anywhere to intercept rockets. Protect your cities!",
    winCondition: "Reach 1000 points to win.",
    lossCondition: "All batteries destroyed = Game Over.",
    left: "Left",
    center: "Center",
    right: "Right",
  },
  zh: {
    title: "Max新星防御",
    start: "开始游戏",
    gameOver: "游戏结束",
    victory: "胜利！",
    score: "得分",
    ammo: "弹药",
    playAgain: "再玩一次",
    instructions: "点击屏幕发射拦截导弹。保护你的城市！",
    winCondition: "达到 1000 分即可获胜。",
    lossCondition: "所有炮台被毁 = 游戏结束。",
    left: "左侧",
    center: "中间",
    right: "右侧",
  }
};

export default function App() {
  const [lang, setLang] = useState<Language>('zh');
  const [gameState, setGameState] = useState<'menu' | 'playing' | 'won' | 'lost'>('menu');
  const [score, setScore] = useState(0);
  const [ammo, setAmmo] = useState({ left: 20, center: 40, right: 20 });
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(null);
  
  // Game Entities
  const rocketsRef = useRef<Rocket[]>([]);
  const missilesRef = useRef<Missile[]>([]);
  const explosionsRef = useRef<Explosion[]>([]);
  const batteriesRef = useRef<Battery[]>([
    { x: 50, y: CANVAS_HEIGHT - 20, ammo: 20, maxAmmo: 20, destroyed: false },
    { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT - 20, ammo: 40, maxAmmo: 40, destroyed: false },
    { x: CANVAS_WIDTH - 50, y: CANVAS_HEIGHT - 20, ammo: 20, maxAmmo: 20, destroyed: false },
  ]);
  const citiesRef = useRef<City[]>([
    { x: 150, y: CANVAS_HEIGHT - 15, destroyed: false },
    { x: 250, y: CANVAS_HEIGHT - 15, destroyed: false },
    { x: 350, y: CANVAS_HEIGHT - 15, destroyed: false },
    { x: 450, y: CANVAS_HEIGHT - 15, destroyed: false },
    { x: 550, y: CANVAS_HEIGHT - 15, destroyed: false },
    { x: 650, y: CANVAS_HEIGHT - 15, destroyed: false },
  ]);

  const t = TRANSLATIONS[lang];

  // --- Game Logic ---

  const spawnRocket = useCallback(() => {
    const targets = [
      ...batteriesRef.current.filter(b => !b.destroyed),
      ...citiesRef.current.filter(c => !c.destroyed)
    ];
    
    if (targets.length === 0) return;

    const target = targets[Math.floor(Math.random() * targets.length)];
    const startX = Math.random() * CANVAS_WIDTH;
    
    rocketsRef.current.push({
      id: Math.random().toString(36).substr(2, 9),
      x: startX,
      y: 0,
      targetX: target.x,
      targetY: target.y,
      speed: ROCKET_SPEED_MIN + Math.random() * (ROCKET_SPEED_MAX - ROCKET_SPEED_MIN),
      color: `hsl(${Math.random() * 60 + 0}, 100%, 50%)`, // Reddish
    });
  }, []);

  const update = useCallback(() => {
    if (gameState !== 'playing') return;

    // 1. Update Rockets
    rocketsRef.current.forEach((rocket, index) => {
      const dx = rocket.targetX - rocket.x;
      const dy = rocket.targetY - rocket.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance < 2) {
        // Hit target!
        explosionsRef.current.push({
          id: Math.random().toString(36).substr(2, 9),
          x: rocket.x,
          y: rocket.y,
          radius: 2,
          growing: true
        });
        
        // Check what was hit
        batteriesRef.current.forEach(b => {
          if (Math.abs(b.x - rocket.targetX) < 5 && Math.abs(b.y - rocket.targetY) < 5) {
            b.destroyed = true;
            b.ammo = 0;
          }
        });
        citiesRef.current.forEach(c => {
          if (Math.abs(c.x - rocket.targetX) < 5 && Math.abs(c.y - rocket.targetY) < 5) {
            c.destroyed = true;
          }
        });

        rocketsRef.current.splice(index, 1);
      } else {
        rocket.x += (dx / distance) * rocket.speed;
        rocket.y += (dy / distance) * rocket.speed;
      }
    });

    // 2. Update Missiles
    missilesRef.current.forEach((missile, index) => {
      // Heat-seeking logic: find nearest rocket
      let nearestRocket: Rocket | null = null;
      let minDist = 300; // Detection range for heat-seeking

      rocketsRef.current.forEach(r => {
        const d = Math.sqrt(Math.pow(r.x - missile.x, 2) + Math.pow(r.y - missile.y, 2));
        if (d < minDist) {
          minDist = d;
          nearestRocket = r;
        }
      });

      if (nearestRocket) {
        missile.destX = (nearestRocket as Rocket).x;
        missile.destY = (nearestRocket as Rocket).y;
      }

      const dx = missile.destX - missile.x;
      const dy = missile.destY - missile.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < MISSILE_SPEED) {
        explosionsRef.current.push({
          id: Math.random().toString(36).substr(2, 9),
          x: missile.destX,
          y: missile.destY,
          radius: 2,
          growing: true
        });
        missilesRef.current.splice(index, 1);
      } else {
        missile.x += (dx / distance) * MISSILE_SPEED;
        missile.y += (dy / distance) * MISSILE_SPEED;
      }
    });

    // 3. Update Explosions
    explosionsRef.current.forEach((exp, index) => {
      if (exp.growing) {
        exp.radius += EXPLOSION_GROWTH_RATE;
        if (exp.radius >= EXPLOSION_RADIUS_MAX) {
          exp.growing = false;
        }
      } else {
        exp.radius -= EXPLOSION_GROWTH_RATE;
        if (exp.radius <= 0) {
          explosionsRef.current.splice(index, 1);
        }
      }

      // Check collision with rockets
      rocketsRef.current.forEach((rocket, rIdx) => {
        const dx = rocket.x - exp.x;
        const dy = rocket.y - exp.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < exp.radius) {
          rocketsRef.current.splice(rIdx, 1);
          setScore(prev => prev + SCORE_PER_ROCKET);
        }
      });
    });

    // 4. Spawn Rockets
    if (Math.random() < 0.015 + (score / 10000)) {
      spawnRocket();
    }

    // 5. Check Win/Loss
    if (score >= WIN_SCORE) {
      setGameState('won');
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 }
      });
    }

    const allBatteriesDestroyed = batteriesRef.current.every(b => b.destroyed);
    if (allBatteriesDestroyed) {
      setGameState('lost');
    }

    // Update UI state for ammo
    setAmmo({
      left: batteriesRef.current[0].ammo,
      center: batteriesRef.current[1].ammo,
      right: batteriesRef.current[2].ammo
    });

  }, [gameState, score, spawnRocket]);

  const draw = useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Background
    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Ground
    ctx.fillStyle = '#222';
    ctx.fillRect(0, CANVAS_HEIGHT - 20, CANVAS_WIDTH, 20);

    // Draw Rockets
    rocketsRef.current.forEach(r => {
      ctx.beginPath();
      ctx.moveTo(r.x, r.y);
      ctx.lineTo(r.x - (r.targetX - r.x) * 0.05, r.y - (r.targetY - r.y) * 0.05);
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = r.color;
      ctx.beginPath();
      ctx.arc(r.x, r.y, 3, 0, Math.PI * 2);
      ctx.fill();
    });

    // Draw Missiles
    missilesRef.current.forEach(m => {
      ctx.beginPath();
      ctx.moveTo(m.startX, m.startY);
      ctx.lineTo(m.x, m.y);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(m.x, m.y, 2, 0, Math.PI * 2);
      ctx.fill();

      // Draw Target X
      ctx.strokeStyle = '#f00';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(m.destX - 5, m.destY - 5);
      ctx.lineTo(m.destX + 5, m.destY + 5);
      ctx.moveTo(m.destX + 5, m.destY - 5);
      ctx.lineTo(m.destX - 5, m.destY + 5);
      ctx.stroke();
    });

    // Draw Explosions
    explosionsRef.current.forEach(e => {
      const gradient = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, e.radius);
      gradient.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
      gradient.addColorStop(0.4, 'rgba(255, 200, 0, 0.7)');
      gradient.addColorStop(1, 'rgba(255, 0, 0, 0)');
      
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
      ctx.fill();
    });

    // Draw Batteries
    batteriesRef.current.forEach(b => {
      if (!b.destroyed) {
        ctx.fillStyle = '#4ade80';
        ctx.beginPath();
        ctx.moveTo(b.x - 20, b.y + 20);
        ctx.lineTo(b.x, b.y - 10);
        ctx.lineTo(b.x + 20, b.y + 20);
        ctx.fill();
        
        // Ammo bar
        const ammoPct = b.ammo / b.maxAmmo;
        ctx.fillStyle = '#333';
        ctx.fillRect(b.x - 15, b.y + 10, 30, 4);
        ctx.fillStyle = ammoPct > 0.3 ? '#4ade80' : '#ef4444';
        ctx.fillRect(b.x - 15, b.y + 10, 30 * ammoPct, 4);
      } else {
        ctx.fillStyle = '#333';
        ctx.beginPath();
        ctx.arc(b.x, b.y + 10, 15, 0, Math.PI, true);
        ctx.fill();
      }
    });

    // Draw Cities
    citiesRef.current.forEach(c => {
      if (!c.destroyed) {
        ctx.fillStyle = '#60a5fa';
        ctx.fillRect(c.x - 15, c.y - 15, 30, 15);
        ctx.fillStyle = '#1e40af';
        ctx.fillRect(c.x - 10, c.y - 10, 5, 5);
        ctx.fillRect(c.x + 5, c.y - 10, 5, 5);
      } else {
        ctx.fillStyle = '#444';
        ctx.fillRect(c.x - 15, c.y - 5, 30, 5);
      }
    });

  }, []);

  const loop = useCallback((time: number) => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        update();
        draw(ctx);
      }
    }
    requestRef.current = requestAnimationFrame(loop);
  }, [update, draw]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(loop);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [loop]);

  // --- Interaction ---

  const handleCanvasClick = (e: React.MouseEvent | React.TouchEvent) => {
    if (gameState !== 'playing') return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;

    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }

    const scaleX = CANVAS_WIDTH / rect.width;
    const scaleY = CANVAS_HEIGHT / rect.height;
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    // Find nearest battery with ammo
    let nearestBattery: Battery | null = null;
    let minDist = Infinity;

    batteriesRef.current.forEach(b => {
      if (!b.destroyed && b.ammo > 0) {
        const d = Math.abs(b.x - x);
        if (d < minDist) {
          minDist = d;
          nearestBattery = b;
        }
      }
    });

    if (nearestBattery) {
      (nearestBattery as Battery).ammo -= 1;
      missilesRef.current.push({
        id: Math.random().toString(36).substr(2, 9),
        startX: (nearestBattery as Battery).x,
        startY: (nearestBattery as Battery).y,
        x: (nearestBattery as Battery).x,
        y: (nearestBattery as Battery).y,
        destX: x,
        destY: y
      });
    }
  };

  const startGame = () => {
    setScore(0);
    setGameState('playing');
    rocketsRef.current = [];
    missilesRef.current = [];
    explosionsRef.current = [];
    batteriesRef.current = [
      { x: 50, y: CANVAS_HEIGHT - 20, ammo: 20, maxAmmo: 20, destroyed: false },
      { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT - 20, ammo: 40, maxAmmo: 40, destroyed: false },
      { x: CANVAS_WIDTH - 50, y: CANVAS_HEIGHT - 20, ammo: 20, maxAmmo: 20, destroyed: false },
    ];
    citiesRef.current = [
      { x: 150, y: CANVAS_HEIGHT - 15, destroyed: false },
      { x: 250, y: CANVAS_HEIGHT - 15, destroyed: false },
      { x: 350, y: CANVAS_HEIGHT - 15, destroyed: false },
      { x: 450, y: CANVAS_HEIGHT - 15, destroyed: false },
      { x: 550, y: CANVAS_HEIGHT - 15, destroyed: false },
      { x: 650, y: CANVAS_HEIGHT - 15, destroyed: false },
    ];
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-white font-sans selection:bg-emerald-500/30 flex flex-col items-center justify-center p-4">
      {/* Header */}
      <div className="w-full max-w-4xl flex justify-between items-center mb-4 px-2">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-500 rounded-lg shadow-lg shadow-emerald-500/20">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{t.title}</h1>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-neutral-900 px-4 py-2 rounded-full border border-white/5">
            <Trophy className="w-4 h-4 text-yellow-500" />
            <span className="font-mono text-lg font-bold">{score}</span>
          </div>
          <button 
            onClick={() => setLang(l => l === 'en' ? 'zh' : 'en')}
            className="p-2 hover:bg-white/5 rounded-full transition-colors"
          >
            <Languages className="w-5 h-5 opacity-70" />
          </button>
        </div>
      </div>

      {/* Game Area */}
      <div className="relative w-full max-w-4xl aspect-[4/3] bg-black rounded-2xl overflow-hidden shadow-2xl border border-white/10 group">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          onMouseDown={handleCanvasClick}
          onTouchStart={handleCanvasClick}
          className="w-full h-full cursor-crosshair"
        />

        {/* HUD - Ammo Display */}
        {gameState === 'playing' && (
          <div className="absolute bottom-6 left-0 right-0 px-8 flex justify-between pointer-events-none">
            <div className="flex flex-col items-center gap-1">
              <span className="text-[10px] uppercase tracking-widest opacity-50">{t.left}</span>
              <span className={`font-mono text-xl font-bold ${ammo.left === 0 ? 'text-red-500' : 'text-emerald-400'}`}>{ammo.left}</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="text-[10px] uppercase tracking-widest opacity-50">{t.center}</span>
              <span className={`font-mono text-2xl font-bold ${ammo.center === 0 ? 'text-red-500' : 'text-emerald-400'}`}>{ammo.center}</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="text-[10px] uppercase tracking-widest opacity-50">{t.right}</span>
              <span className={`font-mono text-xl font-bold ${ammo.right === 0 ? 'text-red-500' : 'text-emerald-400'}`}>{ammo.right}</span>
            </div>
          </div>
        )}

        {/* Overlays */}
        <AnimatePresence>
          {gameState !== 'playing' && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-8 text-center"
            >
              <motion.div 
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                className="max-w-md"
              >
                {gameState === 'menu' && (
                  <>
                    <h2 className="text-4xl font-black mb-4 tracking-tighter uppercase italic">{t.title}</h2>
                    <p className="text-neutral-400 mb-8 leading-relaxed">
                      {t.instructions}<br/>
                      <span className="text-emerald-500/80 text-sm">{t.winCondition}</span>
                    </p>
                    <button 
                      onClick={startGame}
                      className="group relative px-8 py-4 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-xl transition-all hover:scale-105 active:scale-95"
                    >
                      <span className="flex items-center gap-2">
                        <Target className="w-5 h-5" />
                        {t.start}
                      </span>
                    </button>
                  </>
                )}

                {gameState === 'won' && (
                  <>
                    <div className="w-20 h-20 bg-yellow-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-yellow-500/20">
                      <Trophy className="w-10 h-10 text-black" />
                    </div>
                    <h2 className="text-4xl font-black mb-2 text-yellow-500">{t.victory}</h2>
                    <p className="text-neutral-400 mb-8">{t.score}: {score}</p>
                    <button 
                      onClick={startGame}
                      className="px-8 py-4 bg-white text-black font-bold rounded-xl hover:bg-neutral-200 transition-all flex items-center gap-2 mx-auto"
                    >
                      <RefreshCw className="w-5 h-5" />
                      {t.playAgain}
                    </button>
                  </>
                )}

                {gameState === 'lost' && (
                  <>
                    <div className="w-20 h-20 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-red-500/20">
                      <AlertTriangle className="w-10 h-10 text-black" />
                    </div>
                    <h2 className="text-4xl font-black mb-2 text-red-500">{t.gameOver}</h2>
                    <p className="text-neutral-400 mb-8">{t.score}: {score}</p>
                    <button 
                      onClick={startGame}
                      className="px-8 py-4 bg-red-500 text-white font-bold rounded-xl hover:bg-red-400 transition-all flex items-center gap-2 mx-auto"
                    >
                      <RefreshCw className="w-5 h-5" />
                      {t.playAgain}
                    </button>
                  </>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer Info */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl text-sm text-neutral-500">
        <div className="bg-neutral-900/50 p-4 rounded-xl border border-white/5">
          <h3 className="text-neutral-300 font-bold mb-1 uppercase text-[10px] tracking-widest">{lang === 'en' ? 'HOW TO PLAY' : '玩法说明'}</h3>
          <p>{t.instructions}</p>
        </div>
        <div className="bg-neutral-900/50 p-4 rounded-xl border border-white/5">
          <h3 className="text-neutral-300 font-bold mb-1 uppercase text-[10px] tracking-widest">{lang === 'en' ? 'WIN CONDITION' : '胜利条件'}</h3>
          <p>{t.winCondition}</p>
        </div>
        <div className="bg-neutral-900/50 p-4 rounded-xl border border-white/5">
          <h3 className="text-neutral-300 font-bold mb-1 uppercase text-[10px] tracking-widest">{lang === 'en' ? 'LOSS CONDITION' : '失败条件'}</h3>
          <p>{t.lossCondition}</p>
        </div>
      </div>
    </div>
  );
}
