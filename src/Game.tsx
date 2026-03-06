import { useEffect, useMemo, useRef, useState } from "react";

type Pos = { x: number; y: number };
type Status = "playing" | "dead";

const W = 10;
const H = 14;
const CELL = 34;

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function makeFloor(fill = true) {
  return Array.from({ length: H }, () => Array.from({ length: W }, () => fill));
}

function makeMarks() {
  return Array.from({ length: H }, () => Array.from({ length: W }, () => false));
}

export default function Game() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const startX = Math.floor(W / 2);
  const startY = H - 2;

  const [status, setStatus] = useState<Status>("playing");
  const [floor, setFloor] = useState<boolean[][]>(() => makeFloor(true));
  const [marks, setMarks] = useState<boolean[][]>(() => makeMarks());
  const [player, setPlayer] = useState<Pos>(() => ({ x: startX, y: startY }));

  const width = useMemo(() => W * CELL, []);
  const height = useMemo(() => H * CELL, []);

  // Game over si el jugador pisa vacío
  useEffect(() => {
    if (status !== "playing") return;

    const under = floor[player.y]?.[player.x] === true;
    if (!under) setStatus("dead");
  }, [floor, player, status]);

  // Render canvas
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;

    let raf = 0;

    const tileFill = "#111827";
    const emptyFill = "#f3f4f6";
    const playerFill = "#22c55e";

    const draw = () => {
      ctx.clearRect(0, 0, c.width, c.height);

      // tablero
      ctx.lineWidth = 1;
      ctx.strokeStyle = "#cfcfcf";

      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const px = x * CELL;
          const py = y * CELL;

          // fondo celda (para que se note el vacío)
          ctx.fillStyle = floor[y][x] ? tileFill : emptyFill;
          ctx.fillRect(px + 1, py + 1, CELL - 2, CELL - 2);

          // borde
          ctx.strokeRect(px + 0.5, py + 0.5, CELL - 1, CELL - 1);

          // marca (mina) en el suelo
          if (marks[y][x] && floor[y][x]) {
            ctx.fillStyle = "#fbbf24";
            ctx.beginPath();
            ctx.arc(px + CELL / 2, py + CELL / 2, CELL * 0.12, 0, Math.PI * 2);
            ctx.fill();
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
  }, [floor, marks, player]);

  // Controles
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const k = e.key.toLowerCase();

      if (status === "dead") {
        if (k === "r") {
          setFloor(makeFloor(true));
          setMarks(makeMarks());
          setPlayer({ x: startX, y: startY });
          setStatus("playing");
        }
        return;
      }

      if (k === "arrowleft" || k === "a")
        setPlayer((p) => ({ ...p, x: clamp(p.x - 1, 0, W - 1) }));
      if (k === "arrowright" || k === "d")
        setPlayer((p) => ({ ...p, x: clamp(p.x + 1, 0, W - 1) }));
      if (k === "arrowup" || k === "w")
        setPlayer((p) => ({ ...p, y: clamp(p.y - 1, 0, H - 1) }));
      if (k === "arrowdown" || k === "s")
        setPlayer((p) => ({ ...p, y: clamp(p.y + 1, 0, H - 1) }));

      // Clásico IQ: marca/desmarca bajo el jugador
      if (k === " ") {
        setMarks((m) => {
          const copy = m.map((row) => row.slice());
          copy[player.y][player.x] = !copy[player.y][player.x];
          return copy;
        });
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [status, player, startX, startY]);

  return (
    <div style={{ userSelect: "none", fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ margin: "8px 0" }}>Blockrunner (IQ-style)</h1>
      <canvas ref={canvasRef} width={width} height={height} />

      <div style={{ marginTop: 8 }}>
        Controles: Flechas/WASD (mover) · Space (marcar bajo el jugador) · R (reiniciar)
        {status === "dead" && <span style={{ marginLeft: 12 }}>— GAME OVER</span>}
      </div>
    </div>
  );
}