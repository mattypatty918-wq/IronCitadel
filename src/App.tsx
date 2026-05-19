import { useState, useEffect, useRef, useCallback } from 'react';

interface Tower {
  id: number;
  x: number;
  y: number;
  type: number;
  lastFired: number;
}

interface Enemy {
  id: number;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  pathIndex: number;
  speed: number;
}

interface Projectile {
  id: number;
  x: number;
  y: number;
  targetId: number;
  damage: number;
}

interface Wave {
  enemyCount: number;
  hp: number;
  speed: number;
  reward: number;
}

const TILE = 40;
const COLS = 20;
const ROWS = 12;

const WAVE_DATA: Wave[] = [
  { enemyCount: 5, hp: 30, speed: 1, reward: 10 },
  { enemyCount: 8, hp: 50, speed: 1.2, reward: 15 },
  { enemyCount: 12, hp: 80, speed: 1.4, reward: 20 },
  { enemyCount: 15, hp: 120, speed: 1.6, reward: 25 },
  { enemyCount: 20, hp: 180, speed: 1.8, reward: 30 },
  { enemyCount: 25, hp: 250, speed: 2, reward: 40 },
  { enemyCount: 30, hp: 350, speed: 2.2, reward: 50 },
];

const PATH: [number, number][] = [
  [0,5],[1,5],[2,5],[3,5],[4,5],[5,5],[6,5],[6,4],[6,3],[6,2],
  [7,2],[8,2],[9,2],[10,2],[10,3],[10,4],[10,5],[10,6],[10,7],
  [10,8],[11,8],[12,8],[13,8],[14,8],[14,7],[14,6],[14,5],[15,5],
  [16,5],[17,5],[18,5],[19,5],
];

const TOWER_COSTS = [50, 100, 150];
const TOWER_DAMAGE = [10, 25, 50];
const TOWER_RANGE = [80, 100, 120];

export default function TowerDefense101() {
  const [gold, setGold] = useState(150);
  const [lives, setLives] = useState(20);
  const [wave, setWave] = useState(0);
  const [score, setScore] = useState(0);
  const [towers, setTowers] = useState<Tower[]>([]);
  const [enemies, setEnemies] = useState<Enemy[]>([]);
  const [projectiles, setProjectiles] = useState<Projectile[]>([]);
  const [selected, setSelected] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);
  const [started, setStarted] = useState(false);
  const [placing, setPlacing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const enemiesRef = useRef(enemies);
  const towersRef = useRef(towers);
  const projectilesRef = useRef(projectiles);
  const gameOverRef = useRef(gameOver);

  enemiesRef.current = enemies;
  towersRef.current = towers;
  projectilesRef.current = projectiles;
  gameOverRef.current = gameOver;

  const isOnPath = useCallback((col: number, row: number) => {
    return PATH.some(([pcol, prow]) => pcol === col && prow === row);
  }, []);

  const spawnEnemy = useCallback((waveData: Wave, id: number) => {
    const start = PATH[0];
    setEnemies(prev => [...prev, {
      id,
      x: start[0] * TILE + TILE/2,
      y: start[1] * TILE + TILE/2,
      hp: waveData.hp,
      maxHp: waveData.hp,
      pathIndex: 0,
      speed: waveData.speed,
    }]);
  }, []);

  const startWave = useCallback(() => {
    if (wave >= WAVE_DATA.length) return;
    const data = WAVE_DATA[wave];
    let spawned = 0;
    const interval = setInterval(() => {
      if (spawned >= data.enemyCount) {
        clearInterval(interval);
        return;
      }
      spawnEnemy(data, Date.now() + spawned);
      spawned++;
    }, 800);
  }, [wave, spawnEnemy]);

  useEffect(() => {
    if (!started || gameOver || won) return;
    if (enemies.length === 0 && wave < WAVE_DATA.length) {
      const timer = setTimeout(startWave, 500);
      return () => clearTimeout(timer);
    }
    if (enemies.length === 0 && wave >= WAVE_DATA.length && wave > 0) {
      setWon(true);
    }
  }, [started, enemies.length, wave, gameOver, won, startWave]);

  useEffect(() => {
    if (!started || gameOver || won) return;
    const id = setInterval(() => {
      const now = Date.now();
      const currentEnemies = enemiesRef.current;
      const currentTowers = towersRef.current;
      const newProjectiles: Projectile[] = [];
      const updatedEnemies: Enemy[] = [];

      currentEnemies.forEach(enemy => {
        let { x, y, pathIndex, hp } = enemy;
        const target = PATH[pathIndex + 1];
        if (!target) {
          setLives(l => {
            const n = l - 1;
            if (n <= 0) setGameOver(true);
            return n;
          });
          return;
        }
        const tx = target[0] * TILE + TILE/2;
        const ty = target[1] * TILE + TILE/2;
        const dx = tx - x;
        const dy = ty - y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        const move = enemy.speed * 1.5;
        if (dist <= move) {
          x = tx;
          y = ty;
          pathIndex++;
        } else {
          x += (dx/dist) * move;
          y += (dy/dist) * move;
        }
        updatedEnemies.push({ ...enemy, x, y, pathIndex });
      });

      currentTowers.forEach(tower => {
        const range = TOWER_RANGE[tower.type];
        const target = currentEnemies.find(e => {
          const dx = e.x - tower.x;
          const dy = e.y - tower.y;
          return Math.sqrt(dx*dx + dy*dy) <= range && e.hp > 0;
        });
        if (target && now - tower.lastFired > 500) {
          newProjectiles.push({
            id: now + tower.id,
            x: tower.x,
            y: tower.y,
            targetId: target.id,
            damage: TOWER_DAMAGE[tower.type],
          });
          tower.lastFired = now;
        }
      });

      setEnemies(updatedEnemies);
      setProjectiles(prev => [...prev, ...newProjectiles]);
    }, 16);
    return () => clearInterval(id);
  }, [started, gameOver, won]);

  useEffect(() => {
    if (projectiles.length === 0) return;
    const id = setInterval(() => {
      const currentProjectiles = projectilesRef.current;
      const currentEnemies = enemiesRef.current;
      const hit: number[] = [];

      currentProjectiles.forEach(p => {
        const target = currentEnemies.find(e => e.id === p.targetId);
        if (!target) return;
        const dx = p.x - target.x;
        const dy = p.y - target.y;
        if (Math.sqrt(dx*dx+dy*dy) < 20) {
          hit.push(p.id);
          const newHp = target.hp - p.damage;
          if (newHp <= 0) {
            setGold(g => g + WAVE_DATA[wave]?.reward || 10);
            setScore(s => s + 10);
            setEnemies(prev => prev.filter(e => e.id !== target.id));
          } else {
            setEnemies(prev => prev.map(e => e.id === target.id ? { ...e, hp: newHp } : e));
          }
        } else {
          const dx2 = target.x - p.x;
          const dy2 = target.y - p.y;
          const dist = Math.sqrt(dx2*dx2+dy2*dy2);
          p.x += (dx2/dist) * 8;
          p.y += (dy2/dist) * 8;
        }
      });
      setProjectiles(prev => prev.filter(p => !hit.includes(p.id) && p.x > 0 && p.x < COLS*TILE && p.y > 0 && p.y < ROWS*TILE));
    }, 16);
    return () => clearInterval(id);
  }, [projectiles.length, wave]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let c = 0; c < COLS; c++) {
      for (let r = 0; r < ROWS; r++) {
        const onPath = isOnPath(c, r);
        ctx.fillStyle = onPath ? '#8B7355' : '#2d5a27';
        ctx.fillRect(c * TILE, r * TILE, TILE, TILE);
        if (!onPath) {
          ctx.fillStyle = '#3d7a37';
          ctx.fillRect(c * TILE + 2, r * TILE + 2, TILE - 4, TILE - 4);
        }
      }
    }

    const pathCoords = PATH.map(([c,r]) => ({x: c*TILE+TILE/2, y: r*TILE+TILE/2}));
    ctx.strokeStyle = '#A08060';
    ctx.lineWidth = TILE * 0.7;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(pathCoords[0].x, pathCoords[0].y);
    pathCoords.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.stroke();

    towers.forEach(tower => {
      const colors = ['#4a90d9','#9b59b6','#e74c3c'];
      ctx.fillStyle = colors[tower.type];
      ctx.beginPath();
      ctx.arc(tower.x, tower.y, 14, 0, Math.PI*2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(['1','2','3'][tower.type], tower.x, tower.y);
    });

    enemies.forEach(enemy => {
      ctx.fillStyle = '#c0392b';
      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y, 10, 0, Math.PI*2);
      ctx.fill();
      ctx.fillStyle = '#27ae60';
      ctx.fillRect(enemy.x - 12, enemy.y - 18, 24, 4);
      ctx.fillStyle = '#e74c3c';
      ctx.fillRect(enemy.x - 12, enemy.y - 18, 24 * (enemy.hp / enemy.maxHp), 4);
    });

    projectiles.forEach(p => {
      ctx.fillStyle = '#f1c40f';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, Math.PI*2);
      ctx.fill();
    });

    if (placing) {
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 2;
      ctx.setLineDash([5,5]);
      ctx.strokeRect(0, 0, COLS*TILE, ROWS*TILE);
      ctx.setLineDash([]);
    }

  }, [towers, enemies, projectiles, isOnPath, placing]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!placing || gameOver || won) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const col = Math.floor(x / TILE);
    const row = Math.floor(y / TILE);
    if (isOnPath(col, row)) return;
    if (towers.some(t => Math.abs(t.x - (col*TILE+TILE/2)) < 5 && Math.abs(t.y - (row*TILE+TILE/2)) < 5)) return;
    const cost = TOWER_COSTS[selected];
    if (gold < cost) return;
    setGold(g => g - cost);
    setTowers(prev => [...prev, {
      id: Date.now(),
      x: col*TILE + TILE/2,
      y: row*TILE + TILE/2,
      type: selected,
      lastFired: 0,
    }]);
  };

  const restart = () => {
    setGold(150); setLives(20); setWave(0); setScore(0);
    setTowers([]); setEnemies([]); setProjectiles([]);
    setGameOver(false); setWon(false); setStarted(false); setPlacing(false);
  };

  if (!started) {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-4">
        <h1 className="text-4xl font-bold text-white mb-6">🏰 Tower Defense 101</h1>
        <p className="text-gray-300 text-center max-w-md mb-6">Build towers to stop waves of enemies. Click to place towers, earn gold for kills, survive all 7 waves to win!</p>
        <button onClick={() => { setStarted(true); }} className="px-8 py-4 bg-blue-600 text-white text-xl font-bold rounded-lg hover:bg-blue-700">START GAME</button>
      </div>
    );
  }

  if (gameOver) {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-4">
        <h1 className="text-4xl font-bold text-red-500 mb-4">GAME OVER</h1>
        <p className="text-white text-xl mb-2">Score: {score}</p>
        <p className="text-gray-400 mb-6">Wave {wave + 1} of {WAVE_DATA.length}</p>
        <button onClick={restart} className="px-8 py-4 bg-blue-600 text-white text-xl font-bold rounded-lg hover:bg-blue-700">TRY AGAIN</button>
      </div>
    );
  }

  if (won) {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-4">
        <h1 className="text-4xl font-bold text-green-400 mb-4">🎉 YOU WIN!</h1>
        <p className="text-white text-xl mb-2">Final Score: {score}</p>
        <p className="text-gray-400 mb-6">All 7 waves defeated!</p>
        <button onClick={restart} className="px-8 py-4 bg-blue-600 text-white text-xl font-bold rounded-lg hover:bg-blue-700">PLAY AGAIN</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center p-2">
      <div className="flex gap-6 mb-2">
        <span className="text-yellow-400 font-bold">💰 {gold}</span>
        <span className="text-red-400 font-bold">❤️ {lives}</span>
        <span className="text-blue-400 font-bold">🌊 Wave {wave+1}/{WAVE_DATA.length}</span>
        <span className="text-white font-bold">⭐ {score}</span>
      </div>
      <canvas
        ref={canvasRef}
        width={COLS * TILE}
        height={ROWS * TILE}
        onClick={handleCanvasClick}
        className="border-2 border-gray-600 rounded cursor-crosshair"
      />
      <div className="flex gap-2 mt-3">
        {TOWER_COSTS.map((cost, i) => (
          <button key={i} onClick={() => { setSelected(i); setPlacing(true); }} className={`px-4 py-2 rounded font-bold ${selected === i ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'}`}>
            Tower {i+1} — {cost}g
          </button>
        ))}
        <button onClick={() => { setPlacing(false); }} className="px-4 py-2 bg-gray-700 text-gray-300 rounded font-bold">Cancel</button>
      </div>
      <p className="text-gray-500 text-sm mt-2">{placing ? 'Click on green tiles to place tower' : 'Select a tower type first'}</p>
      {enemies.length === 0 && wave < WAVE_DATA.length && (
        <button onClick={() => { setWave(w => w+1); }} className="mt-3 px-6 py-2 bg-green-600 text-white font-bold rounded-lg">START WAVE {wave+1}</button>
      )}
    </div>
  );
}