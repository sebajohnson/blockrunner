import { useEffect, useMemo, useRef, useState } from "react";

type Pos = { x: number; y: number };
type Status = "playing" | "dead";

const W = 10;
const H = 14;
const CELL = 34;

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function makeGrid(fill = true) {
  return Array.from({ length: H }, () => Array.from({ length: W }, () => fill));
}

function makeMarks() {
  return Array.from({ length: H }, () => Array.from({ length: W }, () => false));
}

export default function Game() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [status, setStatus] = useState<Status>("playing");
  const [tick, setTick] = useState(0);
  const [speedMs, setSpeedMs] = useState(650);

  const [dangerTicks, setDangerTicks] = useState(0);

  const [grid, setGrid] = useState<boolean[][]>(() => makeGrid(true));
  const [marked, setMarked] = useState<boolean[][]>(() => makeMarks());
  const [player, setPlayer] = useState<Pos>(() => ({
    x: Math.floor(W / 2),
    y: H - 2,
  }));

  // ref para leer player actual dentro del interval (evita closures viejos)
  const playerRef = useRef(player);
  useEffect(() => {
    playerRef.current = player;
  }, [player]);

  const width = useMemo(() => W * CELL, []);
  const height = useMemo(() => H * CELL, []);

  // dificultad: acelera cada 10 ticks
  useEffect(() => {
    if (status !== "playing") return;
    if (tick > 0 && tick % 10 === 0) {
      setSpeedMs((s) => Math.max(200, Math.floor(s * 0.92)));
    }
  }, [tick, status]);

  // Regla: si se sale o no hay cubo bajo el jugador => dead
  useEffect(() => {
    if (status !== "playing") return;

    if (player.y < 0 || player.y >= H) {
      setStatus("dead");
      return;
    }

    const under = grid[player.y]?.[player.x] === true;
    if (!under) setStatus("dead");
  }, [grid, player, status]);

  // Regla: si estás demasiado abajo 2 ticks seguidos => dead
  useEffect(() => {
    if (status !== "playing") return;
    if (dangerTicks >= 2) setStatus("dead");
  }, [dangerTicks, status]);

  // Tick loop: el mundo avanza, pero NO empuja al jugador
  useEffect(() => {
    if (status !== "playing") return;

    const id = window.setInterval(() => {
      setTick((t) => t + 1);

      // mueve el mundo: nueva fila arriba, cae la última
      setGrid((g) => {
        const newTop = Array.from({ length: W }, () => true);
        return [newTop, ...g.slice(0, H - 1)];
      });

      // mueve las marcas igual (para no desincronizar)
      setMarked((m) => {
        const newTop = Array.from({ length: W }, () => false);
        return [newTop, ...m.slice(0, H - 1)];
      });

      // zona de peligro: últimas 2 filas
      const dangerZoneStart = H - 2;
      setDangerTicks((d) => (playerRef.current.y >= dangerZoneStart ? d + 1 : 0));
    }, speedMs);

    return () => window.clearInterval(id);
  }, [status, speedMs]);

  // Render loop (canvas)
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

          if (grid[y][x]) {
            ctx.fillStyle = cubeFill;
            ctx.fillRect(px + 2, py + 2, CELL - 4, CELL - 4);
          }

          if (marked[y][x]) {
            ctx.globalAlpha = 0.35;
            ctx.fillStyle = "#60a5fa";
            ctx.fillRect(px + 2, py + 2, CELL - 4, CELL - 4);
            ctx.globalAlpha = 1;

            ctx.strokeStyle = "#93c5fd";
            ctx.beginPath();
            ctx.moveTo(px + 6, py + 6);
            ctx.lineTo(px + CELL - 6, py + CELL - 6);
            ctx.moveTo(px + CELL - 6, py + 6);
            ctx.lineTo(px + 6, py + CELL - 6);
            ctx.stroke();

            ctx.strokeStyle = "#cfcfcf";
          }
        }
      }

      const ppx = player.x * CELL;
      const ppy = player.y * CELL;

      ctx.fillStyle = playerFill;
      ctx.beginPath();
      ctx.arc(ppx + CELL / 2, ppy + CELL / 2, CELL * 0.28, 0, Math.PI * 2);
      ctx.fill();

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [grid, marked, player]);

  // Controles
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;

      const k = e.key.toLowerCase();

      if (status === "dead") {
        if (k === "r") {
          setGrid(makeGrid(true));
          setMarked(makeMarks());
          setPlayer({ x: Math.floor(W / 2), y: H - 2 });
          setStatus("playing");
          setTick(0);
          setSpeedMs(650);
          setDangerTicks(0);
        }
        return;
      }

      if (k === "arrowleft" || k === "a") setPlayer((p) => ({ ...p, x: clamp(p.x - 1, 0, W - 1) }));
      if (k === "arrowright" || k === "d") setPlayer((p) => ({ ...p, x: clamp(p.x + 1, 0, W - 1) }));
      if (k === "arrowup" || k === "w") setPlayer((p) => ({ ...p, y: clamp(p.y - 1, 0, H - 1) }));
      if (k === "arrowdown" || k === "s") setPlayer((p) => ({ ...p, y: clamp(p.y + 1, 0, H - 1) }));

      if (k === " ") {
        setMarked((m) => {
          const copy = m.map((row) => row.slice());
          copy[player.y][player.x] = !copy[player.y][player.x];
          return copy;
        });
      }

      if (k === "enter") {
        setGrid((g) =>
          g.map((row, y) => row.map((cell, x) => (marked[y][x] ? false : cell)))
        );
        setMarked(makeMarks());
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [player, marked, status]);

  return (
    <div style={{ userSelect: "none", fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ margin: "8px 0" }}>Blockrunner</h1>
      <canvas ref={canvasRef} width={width} height={height} />

      <div style={{ marginTop: 8 }}>
        Controles: Flechas/WASD · Space = marcar · Enter = detonar · R = reiniciar
        {status === "dead" && <span style={{ marginLeft: 12 }}>— GAME OVER</span>}
      </div>

      <div style={{ marginTop: 6, opacity: 0.8 }}>
        Tick: {tick} · Speed: {speedMs}ms · Danger: {dangerTicks}/2
      </div>
    </div>
  );
}