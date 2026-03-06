import { useEffect, useMemo, useRef, useState } from "react";

type Pos = { x: number; y: number };
type Status = "playing" | "dead";
type CubeType = "normal" | "green" | "black";

type Cube = {
  id: number;
  x: number;     // columna
  y: number;     // posición continua en filas (0..H)
  type: CubeType;
  alive: boolean;
};

const W = 10;
const H = 14;
const CELL = 34;

const TICK_MS = 120;        // frecuencia de simulación
const CUBE_SPEED = 0.08;    // filas por tick (ajusta feel)
const SPAWN_EVERY = 8;      // ticks entre spawns (ajusta dificultad)

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function makeFloor(fill = true) {
  return Array.from({ length: H }, () => Array.from({ length: W }, () => fill));
}

function makeMarks() {
  return Array.from({ length: H }, () => Array.from({ length: W }, () => false));
}

function randCubeType(): CubeType {
  // por ahora: mayoría normales, pocos verdes/negros
  const r = Math.random();
  if (r < 0.10) return "green";
  if (r < 0.15) return "black";
  return "normal";
}

export default function Game() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const startX = Math.floor(W / 2);
  const startY = H - 2;

  const [status, setStatus] = useState<Status>("playing");
  const [floor, setFloor] = useState<boolean[][]>(() => makeFloor(true));
  const [marks, setMarks] = useState<boolean[][]>(() => makeMarks());
  const [player, setPlayer] = useState<Pos>(() => ({ x: startX, y: startY }));

  const [cubes, setCubes] = useState<Cube[]>([]);
  const [tick, setTick] = useState(0);

  const nextIdRef = useRef(1);

  const width = useMemo(() => W * CELL, []);
  const height = useMemo(() => H * CELL, []);

  // Game over si el jugador pisa vacío
  useEffect(() => {
    if (status !== "playing") return;
    const under = floor[player.y]?.[player.x] === true;
    if (!under) setStatus("dead");
  }, [floor, player, status]);

  // Loop de simulación: spawn + mover cubos + colisión con marcas
  useEffect(() => {
    if (status !== "playing") return;

    const id = window.setInterval(() => {
      setTick((t) => t + 1);

      // spawn
      setCubes((prev) => {
        const t = tick + 1;
        if (t % SPAWN_EVERY !== 0) return prev;

        const x = Math.floor(Math.random() * W);
        const cube: Cube = {
          id: nextIdRef.current++,
          x,
          y: -0.8, // entra desde arriba
          type: randCubeType(),
          alive: true,
        };
        return [...prev, cube];
      });

      // mover y resolver colisiones
      setCubes((prev) => {
        const next: Cube[] = [];

        for (const c of prev) {
          if (!c.alive) continue;

          const ny = c.y + CUBE_SPEED;

          // si se va por el borde trasero -> cae (por ahora solo lo removemos)
          if (ny >= H) continue;

          // celda bajo el cubo (cuando entra en fila >=0)
          const cy = Math.floor(ny);
          const cx = c.x;

          let destroyed = false;

          if (cy >= 0 && cy < H) {
            // si hay marca y hay suelo en esa celda, destruye cubo y consume marca
            if (marks[cy]?.[cx] && floor[cy]?.[cx]) {
              destroyed = true;

              // consume la marca
              setMarks((m) => {
                const copy = m.map((row) => row.slice());
                copy[cy][cx] = false;
                return copy;
              });

              // efectos por tipo: los hacemos en Commit 16/17
            }
          }

          if (!destroyed) next.push({ ...c, y: ny });
        }

        return next;
      });
    }, TICK_MS);

    return () => window.clearInterval(id);
  }, [status, tick, marks, floor]);

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

    const cubeColor = (t: CubeType) => {
      if (t === "green") return "#22c55e";
      if (t === "black") return "#111111";
      return "#6b7280"; // normal gris
    };

    const draw = () => {
      ctx.clearRect(0, 0, c.width, c.height);

      // suelo + marcas
      ctx.lineWidth = 1;
      ctx.strokeStyle = "#cfcfcf";

      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const px = x * CELL;
          const py = y * CELL;

          ctx.fillStyle = floor[y][x] ? tileFill : emptyFill;
          ctx.fillRect(px + 1, py + 1, CELL - 2, CELL - 2);

          ctx.strokeRect(px + 0.5, py + 0.5, CELL - 1, CELL - 1);

          if (marks[y][x] && floor[y][x]) {
            ctx.fillStyle = "#fbbf24";
            ctx.beginPath();
            ctx.arc(px + CELL / 2, py + CELL / 2, CELL * 0.12, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      // cubos rodando
      for (const cube of cubes) {
        const px = cube.x * CELL;
        const py = cube.y * CELL; // y continua

        ctx.fillStyle = cubeColor(cube.type);
        ctx.fillRect(px + 5, py + 5, CELL - 10, CELL - 10);
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
  }, [floor, marks, player, cubes]);

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
          setCubes([]);
          setTick(0);
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

      // marcar bajo el jugador
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

      <div style={{ marginTop: 6, opacity: 0.85 }}>
        Cubes: {cubes.length} · Tick: {tick}
      </div>
    </div>
  );
}
