import { useEffect, useMemo, useRef, useState } from "react";

type Pos = { x: number; y: number };
type Status = "playing" | "dead";
type Cell = 0 | 1 | 2; // 0 vacío (no lo generamos), 1 normal, 2 amenaza
type Dir = "up" | "down" | "left" | "right";

const W = 10;
const H = 14;
const CELL = 34;
const RANGE = 8; 

function clamp(n: number, a: number, b: number) {
    return Math.max(a, Math.min(b, n));
}

function makeGrid(fill: Cell = 1) {
    return Array.from({ length: H }, () => Array.from({ length: W }, () => fill as Cell));
}

function makeMarks() {
    return Array.from({ length: H }, () => Array.from({ length: W }, () => false));
}

// Genera solo normales + amenazas (sin huecos)
function makeRow(tick: number, playerX: number): Cell[] {
    const threats = tick < 20 ? 1 : tick < 50 ? 2 : 3;
    const row: Cell[] = Array.from({ length: W }, () => 1);

    const safe = new Set([playerX, playerX - 1, playerX + 1].filter((x) => x >= 0 && x < W));

    let placedT = 0;
    let guard = 0;

    while (placedT < threats && guard++ < 200) {
        const x = Math.floor(Math.random() * W);
        if (safe.has(x)) continue;
        if (row[x] !== 1) continue;
        row[x] = 2;
        placedT++;
    }

    return row;
}

function step(dir: Dir): Pos {
    if (dir === "up") return { x: 0, y: -1 };
    if (dir === "down") return { x: 0, y: 1 };
    if (dir === "left") return { x: -1, y: 0 };
    return { x: 1, y: 0 };
}

// Busca la amenaza más cercana en línea recta desde el jugador (hasta RANGE)
function findThreatTarget(grid: Cell[][], player: Pos, facing: Dir): Pos | null {
    const d = step(facing);
    for (let i = 1; i <= RANGE; i++) {
        const x = player.x + d.x * i;
        const y = player.y + d.y * i;
        if (x < 0 || x >= W || y < 0 || y >= H) break;
        if ((grid[y]?.[x] ?? 0) === 2) return { x, y };
    }
    return null;
}

export default function Game() {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const [bottomThreatTicks, setBottomThreatTicks] = useState(0);

    const startX = Math.floor(W / 2);
    const startY = H - 2;

    const [status, setStatus] = useState<Status>("playing");
    const [tick, setTick] = useState(0);
    const [speedMs, setSpeedMs] = useState(900);

    const [score, setScore] = useState(0);
    const [lastClear, setLastClear] = useState(0);

    const [grid, setGrid] = useState<Cell[][]>(() => makeGrid(1));
    const [marked, setMarked] = useState<boolean[][]>(() => makeMarks());

    const [player, setPlayer] = useState<Pos>(() => ({ x: startX, y: startY }));
    const [facing, setFacing] = useState<Dir>("up");

    const playerRef = useRef(player);
    useEffect(() => {
        playerRef.current = player;
    }, [player]);

    const width = useMemo(() => W * CELL, []);
    const height = useMemo(() => H * CELL, []);

    // Dificultad: acelera cada 10 ticks
    useEffect(() => {
        if (status !== "playing") return;
        if (tick > 0 && tick % 15 === 0) {
            setSpeedMs((s) => Math.max(260, Math.floor(s * 0.95)));
        }
    }, [tick, status]);

    // Muerte: caer (por si existiera vacío)
    useEffect(() => {
        if (status !== "playing") return;

        const bottomHasThreat = grid[H - 1]?.some((c) => c === 2) ?? false;
        setBottomThreatTicks((t) => (bottomHasThreat ? t + 1 : 0));
    }, [grid, status]);

    useEffect(() => {
        if (status !== "playing") return;
        if (bottomThreatTicks >= 2) setStatus("dead");
    }, [bottomThreatTicks, status]);


    // Tick loop: avanza mundo (sin empujar jugador)
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

                return nextTick;
            });
        }, speedMs);

        return () => window.clearInterval(id);
    }, [status, speedMs]);

    // Render canvas
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

            // Target highlight (amenaza más cercana al frente)
            const target = findThreatTarget(grid, player, facing);
            if (target) {
                const tx = target.x * CELL;
                const ty = target.y * CELL;
                ctx.strokeStyle = "#fbbf24";
                ctx.lineWidth = 3;
                ctx.strokeRect(tx + 2, ty + 2, CELL - 4, CELL - 4);
                ctx.strokeStyle = "#cfcfcf";
                ctx.lineWidth = 1;
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
    }, [grid, marked, player, facing]);

    // Controles
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.repeat) return;
            const k = e.key.toLowerCase();

            if (status === "dead") {
                if (k === "r") {
                    setGrid(makeGrid(1));
                    setMarked(makeMarks());
                    setPlayer({ x: startX, y: startY });
                    setBottomThreatTicks(0);
                    setFacing("up");
                    setStatus("playing");
                    setTick(0);
                    setSpeedMs(900);
                    setScore(0);
                    setLastClear(0);

                }
                return;
            }

            // mover jugador + set facing
            if (k === "arrowleft" || k === "a") {
                setFacing("left");
                setPlayer((p) => ({ ...p, x: clamp(p.x - 1, 0, W - 1) }));
            }
            if (k === "arrowright" || k === "d") {
                setFacing("right");
                setPlayer((p) => ({ ...p, x: clamp(p.x + 1, 0, W - 1) }));
            }
            if (k === "arrowup" || k === "w") {
                setFacing("up");
                setPlayer((p) => ({ ...p, y: clamp(p.y - 1, 0, H - 1) }));
            }
            if (k === "arrowdown" || k === "s") {
                setFacing("down");
                setPlayer((p) => ({ ...p, y: clamp(p.y + 1, 0, H - 1) }));
            }

            // Space: marcar/desmarcar la amenaza "target" (al frente)
            if (k === " ") {
                const target = findThreatTarget(grid, player, facing);
                if (!target) return;

                const cx = target.x;
                const cy = target.y;

                let removed = 0;

                setGrid((g) =>
                    g.map((row, y) =>
                        row.map((cell, x) => {
                            const in3x3 = Math.abs(x - cx) <= 1 && Math.abs(y - cy) <= 1;
                            if (!in3x3) return cell;
                            if (cell === 2) {
                                removed++;
                                return 1; // desactiva
                            }
                            return cell;
                        })
                    )
                );

                setLastClear(removed);
                setScore((s) => {
                    const base = removed * 100;
                    const bonus = removed >= 2 ? (removed - 1) * 50 : 0;
                    const penalty = removed === 0 ? 25 : 0;
                    return Math.max(0, s + base + bonus - penalty);
                });
            }


        };

        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [status, grid, player, facing, startX, startY]);

    return (
        <div style={{ userSelect: "none", fontFamily: "system-ui, sans-serif" }}>
            <h1 style={{ margin: "8px 0" }}>Blockrunner</h1>
            <canvas ref={canvasRef} width={width} height={height} />

            <div style={{ marginTop: 8 }}>
                Controles: Flechas/WASD (mover) · Space (detonar 3×3 en target) · R (reiniciar)
                {status === "dead" && <span style={{ marginLeft: 12 }}>— GAME OVER</span>}
            </div>

            <div style={{ marginTop: 6, opacity: 0.85 }}>
                Tick: {tick} · Speed: {speedMs}ms · Score: {score} · Last clear: {lastClear}
              
            </div>
        </div>
    );
}