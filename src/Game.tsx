import { useEffect, useMemo, useRef, useState } from "react";

type Pos = { x: number; y: number };

const W = 10;     // columnas
const H = 14;     // filas
const CELL = 34;  // tamaño visual

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

  const [grid] = useState<boolean[][]>(() => makeGrid(true));
  const [marked, setMarked] = useState<boolean[][]>(() => makeMarks());

  const [player, setPlayer] = useState<Pos>(() => ({
    x: Math.floor(W / 2),
    y: H - 2,
  }));

  const width = useMemo(() => W * CELL, []);
  const height = useMemo(() => H * CELL, []);

  // Render loop (canvas)
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;

    let raf = 0;

    const draw = () => {
      ctx.clearRect(0, 0, c.width, c.height);

      // estilos
      ctx.lineWidth = 1;
      ctx.strokeStyle = "#cfcfcf";
      const cubeFill = "#111827";
      const playerFill = "#22c55e";

      // tablero
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const px = x * CELL;
          const py = y * CELL;

          ctx.strokeRect(px + 0.5, py + 0.5, CELL - 1, CELL - 1);

          if (grid[y][x]) {
            ctx.fillStyle = cubeFill;
            ctx.fillRect(px + 2, py + 2, CELL - 4, CELL - 4);
          }

          // overlay marcado
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

            // restaurar
            ctx.strokeStyle = "#cfcfcf";
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

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [grid, marked, player]);

  // Controles (depende de player para que Space marque la celda correcta)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;

      const k = e.key.toLowerCase();

      if (k === "arrowleft" || k === "a") setPlayer((p) => ({ ...p, x: clamp(p.x - 1, 0, W - 1) }));
      if (k === "arrowright" || k === "d") setPlayer((p) => ({ ...p, x: clamp(p.x + 1, 0, W - 1) }));
      if (k === "arrowup" || k === "w") setPlayer((p) => ({ ...p, y: clamp(p.y - 1, 0, H - 1) }));
      if (k === "arrowdown" || k === "s") setPlayer((p) => ({ ...p, y: clamp(p.y + 1, 0, H - 1) }));

      // marcar con Space
      if (k === " ") {
        setMarked((m) => {
          const copy = m.map((row) => row.slice());
          copy[player.y][player.x] = !copy[player.y][player.x];
          return copy;
        });
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [player]);

  return (
    <div style={{ userSelect: "none", fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ margin: "8px 0" }}>Blockrunner</h1>
      <canvas ref={canvasRef} width={width} height={height} />
      <div style={{ marginTop: 8 }}>Controles: Flechas/WASD · Space = marcar</div>
    </div>
  );
}