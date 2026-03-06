import { useEffect, useMemo, useRef, useState } from "react";

type Pos = { x: number; y: number };
type Status = "playing" | "dead";
type CubeType = "normal" | "green" | "black";

type Cube = {
    id: number;
    x: number;
    y: number; // continuo
    type: CubeType;
};

type Mark = 0 | 1 | 2; // 0 none, 1 marked, 2 armed (detona cuando cubo pasa)

const W = 10;
const H = 14;
const CELL = 34;

const TICK_MS = 120;
const CUBE_SPEED = 0.08;
const SPAWN_EVERY = 8;

function clamp(n: number, a: number, b: number) {
    return Math.max(a, Math.min(b, n));
}

function makeFloor(fill = true) {
    return Array.from({ length: H }, () => Array.from({ length: W }, () => fill));
}

function makeMarks(): Mark[][] {
    return Array.from({ length: H }, () => Array.from({ length: W }, () => 0 as Mark));
}

function randCubeType(): CubeType {
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
    const [marks, setMarks] = useState<Mark[][]>(() => makeMarks());
    const [player, setPlayer] = useState<Pos>(() => ({ x: startX, y: startY }));

    const [cubes, setCubes] = useState<Cube[]>([]);
    const [tick, setTick] = useState(0);

    const nextIdRef = useRef(1);

    // refs para evitar closures en el interval
    const marksRef = useRef(marks);
    const floorRef = useRef(floor);
    const playerRef = useRef(player);
    const cubesRef = useRef(cubes);

    useEffect(() => { marksRef.current = marks; }, [marks]);
    useEffect(() => { floorRef.current = floor; }, [floor]);
    useEffect(() => { playerRef.current = player; }, [player]);
    useEffect(() => { cubesRef.current = cubes; }, [cubes]);

    const width = useMemo(() => W * CELL, []);
    const height = useMemo(() => H * CELL, []);

    // Game over si el jugador pisa vacío
    useEffect(() => {
        if (status !== "playing") return;
        const under = floor[player.y]?.[player.x] === true;
        if (!under) setStatus("dead");
    }, [floor, player, status]);

    // Loop de simulación (interval estable)
    useEffect(() => {
        if (status !== "playing") return;

        const id = window.setInterval(() => {
            setTick((t) => {
                const nextT = t + 1;

                if (nextT % SPAWN_EVERY === 0) {
                    setCubes((prev) => [
                        ...prev,
                        {
                            id: nextIdRef.current++,
                            x: Math.floor(Math.random() * W),
                            y: -0.8,
                            type: randCubeType(),
                        },
                    ]);
                }

                return nextT;
            });

            // mover + colisiones con ARMED
            setCubes((prev) => {
                const next: Cube[] = [];

                for (const c of prev) {
                    const ny = c.y + CUBE_SPEED;

                    if (ny >= H) continue;

                    const cy = Math.floor(ny);
                    const cx = c.x;

                    if (cy >= 0 && cy < H) {
                        const hasFloor = floorRef.current[cy]?.[cx] === true;
                        const mark = marksRef.current[cy]?.[cx] ?? 0;

                        if (hasFloor && mark === 2) {
                            setMarks((m) => {
                                const copy = m.map((row) => row.slice()) as Mark[][];
                                copy[cy][cx] = 0;
                                return copy;
                            });
                            continue;
                        }
                    }

                    next.push({ ...c, y: ny });
                }

                return next;
            });
        }, TICK_MS);

        return () => window.clearInterval(id);
    }, [status]);

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
            return "#6b7280";
        };

        const draw = () => {
            ctx.clearRect(0, 0, c.width, c.height);

            ctx.lineWidth = 1;
            ctx.strokeStyle = "#cfcfcf";

            for (let y = 0; y < H; y++) {
                for (let x = 0; x < W; x++) {
                    const px = x * CELL;
                    const py = y * CELL;

                    ctx.fillStyle = floor[y][x] ? tileFill : emptyFill;
                    ctx.fillRect(px + 1, py + 1, CELL - 2, CELL - 2);

                    ctx.strokeRect(px + 0.5, py + 0.5, CELL - 1, CELL - 1);

                    const mark = marks[y][x];
                    if (mark !== 0 && floor[y][x]) {
                        // marked = azul, armed = rojo (solo visual)
                        ctx.fillStyle = mark === 1 ? "#60a5fa" : "#ef4444";
                        ctx.beginPath();
                        ctx.arc(px + CELL / 2, py + CELL / 2, CELL * 0.12, 0, Math.PI * 2);
                        ctx.fill();
                    }
                }
            }

            for (const cube of cubes) {
                const px = cube.x * CELL;
                const py = cube.y * CELL;
                ctx.fillStyle = cubeColor(cube.type);
                ctx.fillRect(px + 5, py + 5, CELL - 10, CELL - 10);
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
    }, [floor, marks, player, cubes]);

    // Helper: hay cubo encima del jugador?
    function cubeOnCell(px: number, py: number): Cube | null {
        for (const c of cubesRef.current) {
            if (c.x !== px) continue;

            // centro del cubo en coordenadas de grilla
            const cubeCenterY = c.y + 0.5;
            const cellCenterY = py + 0.5;

            // si el centro está "cerca", lo consideramos encima
            if (Math.abs(cubeCenterY - cellCenterY) < 0.35) return c;
        }
        return null;
    }

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

            if (k === " ") {
                const px = playerRef.current.x;
                const py = playerRef.current.y;

                // si hay cubo encima y el punto está marked -> armed
                const onTop = cubeOnCell(px, py);
                setMarks((m) => {
                    const copy = m.map((row) => row.slice()) as Mark[][];
                    const cur = copy[py][px];

                    if (!floorRef.current[py]?.[px]) return copy;

                    if (onTop) {
                        if (cur === 1) {
                            // consumir marca de inmediato
                            copy[py][px] = 0;

                            // eliminar cubo inmediatamente
                            setCubes((prev) => prev.filter((c) => c.id !== onTop.id));
                        }
                        return copy;
                    }

                    // marcar/desmarcar normal
                    copy[py][px] = cur === 0 ? 1 : 0;
                    return copy;
                });
            }
        };

        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [status, startX, startY]);

    return (
        <div style={{ userSelect: "none", fontFamily: "system-ui, sans-serif" }}>
            <h1 style={{ margin: "8px 0" }}>Blockrunner (IQ-style)</h1>
            <canvas ref={canvasRef} width={width} height={height} />

            <div style={{ marginTop: 8 }}>
                Controles: Flechas/WASD (mover) · Space (marcar / activar bajo el cubo) · R (reiniciar)
                {status === "dead" && <span style={{ marginLeft: 12 }}>— GAME OVER</span>}
            </div>

            <div style={{ marginTop: 6, opacity: 0.85 }}>
                Cubes: {cubes.length} · Tick: {tick}
            </div>
        </div>
    );
}