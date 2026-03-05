import { useEffect, useMemo, useRef, useState } from "react";

type Pos = { x: number; y: number };
type Status = "playing" | "dead";
type Cell = 0 | 1 | 2;

const W = 10;
const H = 14;
const CELL = 34;

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function makeGrid(fill: Cell = 1) {
  return Array.from({ length: H }, () => Array.from({ length: W }, () => fill as Cell));
}

function makeMarks() {
  return Array.from({ length: H }, () => Array.from({ length: W }, () => false));
}

function makeRow(tick: number, playerX: number): Cell[] {
  const holes = tick < 20 ? 1 : tick < 50 ? 2 : 3;
  const threats = tick < 20 ? 1 : tick < 50 ? 2 : 3;

  const row: Cell[] = Array.from({ length: W }, () => 1);
  const safe = new Set([playerX, playerX - 1, playerX + 1].filter((x) => x >= 0 && x < W));

  let placedH = 0, guard = 0;
  while (placedH < holes && guard++ < 200) {
    const x = Math.floor(Math.random() * W);
    if (safe.has(x)) continue;
    if (row[x] === 0) continue;
    row[x] = 0;
    placedH++;
  }

  let placedT = 0; guard = 0;
  while (placedT < threats && guard++ < 200) {
    const x = Math.floor(Math.random() * W);
    if (safe.has(x)) continue;
    if (row[x] !== 1) continue;
    row[x] = 2;
    placedT++;
  }

  if (row[playerX] === 0) row[playerX] = 1;
  return row;
}

export default function Game() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const startX = Math.floor(W / 2);
  const startY = H - 2;

  const [status, setStatus] = useState<Status>("playing");
  const [tick, setTick] = useState(0);
  const [speedMs, setSpeedMs] = useState(650);
  const [dangerTicks, setDangerTicks] = useState(0);

  const [grid, setGrid] = useState<Cell[][]>(() => makeGrid(1));
  const [marked, setMarked] = useState<boolean[][]>(() => makeMarks());

  const [player, setPlayer] = useState<Pos>(() => ({ x: startX, y: startY }));
  const [cursor, setCursor] = useState<Pos>(() => ({ x: startX, y: startY }));

  const playerRef = useRef(player);
  useEffect(() => {
    playerRef.current = player;
  }, [player]);

  const width = useMemo(() => W * CELL, []);
  const height = useMemo(() => H * CELL, []);

  useEffect(() => {
    if (status !== "playing") return;
    if (tick > 0 && tick % 10 === 0) {
      setSpeedMs((s) => Math.max(200, Math.floor(s * 0.92)));
    }
  }, [tick, status]);

  useEffect(() => {
    if (status !== "playing") return;

    if (player.y < 0 || player.y >= H) {
      setStatus("dead");
      return;
    }

    const under = grid[player.y]?.[player.x] ?? 0;
    if (under === 0) setStatus("dead");
  }, [grid, player, status]);

  useEffect(() => {
    if (status !== "playing") return;
    if (dangerTicks >= 2) setStatus("dead");
  }, [dangerTicks, status]);

  useEffect(() => {
    if (status !== "playing") return;

    const id = window.setInterval(() => {
      setTick((t) => {
        const nextTick = t + 1;

        setGrid((g) => {
          const newTop = makeRow(nextTick, playerRef.current.x);
          return [newTop, ...g.slice(0, H - 1)];
        });

        setMarked((m) => {
          const newTop = Array.from({ length: W }, () => false);
          return [newTop, ...m.slice(0, H - 1)];
        });

        const dangerZoneStart = H - 2;
        setDangerTicks((d) => (playerRef.current.y >= dangerZoneStart ? d + 1 : 0));

        return nextTick;
      });
    }, speedMs);

    return () => window.clearInterval(id);
  }, [status, speedMs]);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;

    let raf = 0;

    const cubeFill = "#111827";
    const playerFill = "#22c55e";

    const draw = () => {
      ctx.clearRect(0, 0, c.width, c.height);

      ctx.lineWidth = 1;
      ctx.strokeStyle = "#cfcfcf";

      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const px = x * CELL;
          const py = y * CELL;

          ctx.strokeRect(px + 0.5, py + 0.5, CELL - 1, CELL - 1);

          const cell = grid[y][x];
          if (cell !== 0) {
            ctx.fillStyle = cell === 2 ? "#ef4444" : cubeFill;
            ctx.fillRect(px + 2, py + 2, CELL - 4, CELL - 4);
          }

          if (marked[y][x]) {
            ctx.globalAlpha = 0.35;
            ctx.fillStyle = "#60a5fa";
            ctx.fillRect(px + 2, py + 2, CELL - 4, CELL - 4);
            ctx.globalAlpha = 1;
          }
        }
      }

      // jugador
      const ppx = player.x * CELL;
      const ppy = player.y * CELL;
      ctx.fillStyle = playerFill;
      ctx.beginPath();
      ctx.arc(ppx + CELL / 2, ppy + CELL / 2, CELL * 0.28, 0, Math.PI * 2);
      ctx.fill();

      // cursor (al final para que quede arriba)
      const cpx = cursor.x * CELL;
      const cpy = cursor.y * CELL;
      ctx.strokeStyle = "#fbbf24";
      ctx.lineWidth = 3;
      ctx.strokeRect(cpx + 2, cpy + 2, CELL - 4, CELL - 4);

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [grid, marked, player, cursor]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const k = e.key.toLowerCase();

      if (status === "dead") {
        if (k === "r") {
          setGrid(makeGrid(1));
          setMarked(makeMarks());
          setPlayer({ x: startX, y: startY });
          setCursor({ x: startX, y: startY });
          setStatus("playing");
          setTick(0);
          setSpeedMs(650);
          setDangerTicks(0);
        }
        return;
      }

      // jugador
      if (k === "arrowleft" || k === "a") setPlayer((p) => ({ ...p, x: clamp(p.x - 1, 0, W - 1) }));
      if (k === "arrowright" || k === "d") setPlayer((p) => ({ ...p, x: clamp(p.x + 1, 0, W - 1) }));
      if (k === "arrowup" || k === "w") setPlayer((p) => ({ ...p, y: clamp(p.y - 1, 0, H - 1) }));
      if (k === "arrowdown" || k === "s") setPlayer((p) => ({ ...p, y: clamp(p.y + 1, 0, H - 1) }));

      // cursor (IJKL)
      if (k === "j") setCursor((p) => ({ ...p, x: clamp(p.x - 1, 0, W - 1) }));
      if (k === "l") setCursor((p) => ({ ...p, x: clamp(p.x + 1, 0, W - 1) }));
      if (k === "i") setCursor((p) => ({ ...p, y: clamp(p.y - 1, 0, H - 1) }));
      if (k === "k") setCursor((p) => ({ ...p, y: clamp(p.y + 1, 0, H - 1) }));

      // marcar amenaza en cursor
      if (k === " ") {
        const cell = grid[cursor.y]?.[cursor.x] ?? 0;
        if (cell !== 2) return;

        setMarked((m) => {
          const copy = m.map((row) => row.slice());
          copy[cursor.y][cursor.x] = !copy[cursor.y][cursor.x];
          return copy;
        });
      }

      // detonar 3x3 en cursor (elimina amenazas)
      if (k === "enter") {
        const cx = cursor.x;
        const cy = cursor.y;

        setGrid((g) =>
          g.map((row, y) =>
            row.map((cell, x) => {
              const in3x3 = Math.abs(x - cx) <= 1 && Math.abs(y - cy) <= 1;
              if (!in3x3) return cell;
              return cell === 2 ? 0 : cell;
            })
          )
        );

        setMarked(makeMarks());
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [status, grid, cursor, startX, startY]);

  return (
    <div style={{ userSelect: "none", fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ margin: "8px 0" }}>Blockrunner</h1>
      <canvas ref={canvasRef} width={width} height={height} />

      <div style={{ marginTop: 8 }}>
        Controles: Flechas/WASD (jugador) · IJKL (cursor) · Space (marcar) · Enter (detonar 3×3) · R (reiniciar)
        {status === "dead" && <span style={{ marginLeft: 12 }}>— GAME OVER</span>}
      </div>

      <div style={{ marginTop: 6, opacity: 0.8 }}>
        Tick: {tick} · Speed: {speedMs}ms · Danger: {dangerTicks}/2
      </div>
    </div>
  );
}