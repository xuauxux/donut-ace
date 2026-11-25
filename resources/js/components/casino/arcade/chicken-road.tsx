import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import type { LadderRound } from '@/types';

type Props = {
    round: LadderRound | null;
    open: boolean;
    busy: boolean;
    steps: number;
    chance: number;
    accent: string;
    onHop: () => void;
};

/* ---------------------------------------------------------------- geometry */

const H = 380;
const START_W = 208;
const LANE_W = 118;
const FINISH_W = 160;
const CY = H / 2;

const TRAFFIC = ['#f2c14e', '#5ec8f2', '#e2e8f0', '#7c8aa0', '#ef4444', '#22c55e', '#f97316'];

function laneX(lane: number) {
    return lane <= 0 ? START_W - 66 : START_W + (lane - 0.5) * LANE_W;
}

/** 0.99 / P(all lanes safe) — mirrors LadderGame::multiplier for road rounds. */
function laneMult(lane: number, chance: number) {
    return 0.99 / Math.pow(chance, lane);
}

/* ------------------------------------------------------------------- state */

type Particle = {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    ttl: number;
    size: number;
    colour: string;
    kind: 'feather' | 'confetti';
};

type Car = { y: number; speed: number; colour: string };

type Rag = {
    x: number;
    y: number;
    vx: number;
    vy: number;
    rot: number;
    spin: number;
    bounces: number;
};

type Sim = {
    time: number;
    cars: Car[];
    hop: { from: number; to: number; t: number } | null;
    shownStep: number;
    lostLane: number;
    rag: Rag | null;
    killer: { x: number; y: number } | null;
    /** Lane the killer car is coming down — its normal traffic is muted. */
    killerLane: number;
    parts: Particle[];
    shake: number;
    flash: number;
    confettiFor: string | null;
    /** Round the scene currently belongs to; a new id resets the yard. */
    roundId: string | null;
};

type View = {
    steps: number;
    chance: number;
    accent: string;
    step: number;
    lost: boolean;
    open: boolean;
};

/**
 * Road Hopper: a side-scrolling street, one lane per hop. Traffic runs down
 * every lane, the server decides whether the hop is safe, and a car flattens
 * the bird on a bad one. The road is drawn on a canvas; only the hop button is
 * DOM, so the board never reflows while it animates.
 */
export function ChickenRoad({ round, open, busy, steps, chance, accent, onHop }: Props) {
    /* The road is drawn at a fixed scale — the wrapper pans instead of zooming
     * out, so lanes stay readable on a phone and on a wide desktop. */
    const worldW = START_W + steps * LANE_W + FINISH_W;
    const scrollRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const viewRef = useRef<View>({
        steps,
        chance,
        accent,
        step: round?.step ?? 0,
        lost: round?.status === 'lost',
        open,
    });

    const step = round?.step ?? 0;
    const lost = round?.status === 'lost';
    const revealed = round?.revealed ?? [];
    const hit = round?.hit ?? null;

    viewRef.current = { steps, chance, accent, step, lost, open };

    const simRef = useRef<Sim>({
        time: 0,
        cars: [],
        hop: null,
        shownStep: 0,
        lostLane: -1,
        rag: null,
        killer: null,
        killerLane: -1,
        parts: [],
        shake: 0,
        flash: 0,
        confettiFor: null,
        roundId: null,
    });

    /* ------------------------------------------------ react to round changes */

    useEffect(() => {
        const sim = simRef.current;

        /* Back to the yard: clear whatever the last round left behind (carcass,
         * killer car, feathers, confetti) and snap the camera to lane 0. A hop
         * pans smoothly, so a pan started before the round ended can still be
         * running — the jump is therefore repeated on the next frame, otherwise
         * that pan finishes and drags the view to the finish line again. */
        const toYard = () => {
            sim.hop = null;
            sim.shownStep = 0;
            sim.lostLane = -1;
            sim.rag = null;
            sim.killer = null;
            sim.killerLane = -1;
            sim.parts = [];
            sim.confettiFor = null;

            const snap = () => {
                const scroller = scrollRef.current;

                if (scroller) {
                    scroller.scrollTo({ left: 0, behavior: 'auto' });
                }
            };

            snap();
            requestAnimationFrame(snap);
        };

        if (!round) {
            sim.roundId = null;
            toYard();

            return;
        }

        /* Every round starts in the yard. Keyed on the round id, so it fires
         * for a round the scene has never seen even when it is already finished
         * (or when an earlier round was still animating its last hop). */
        if (sim.roundId !== round.round_id) {
            sim.roundId = round.round_id;
            toYard();
        } else if (round.status === 'open' && round.step === 0) {
            toYard();
        }

        if (round.step > sim.shownStep) {
            sim.hop = { from: sim.shownStep, to: round.step, t: 0 };
            sim.shownStep = round.step;
        }

        if (round.status === 'lost' && sim.lostLane !== round.step) {
            sim.lostLane = round.step;
            sim.hop = null;
            sim.shownStep = round.step;
            sim.killer = { x: laneX(round.step + 1), y: -150 };
            sim.killerLane = round.step + 1;
        }

        if (round.status === 'won' && sim.confettiFor !== round.round_id) {
            sim.confettiFor = round.round_id;

            const colours = ['#22c55e', '#facc15', '#38bdf8', '#f472b6', '#ffffff'];

            for (let i = 0; i < 70; i++) {
                sim.parts.push({
                    x: laneX(round.step),
                    y: CY - 24,
                    vx: (Math.random() - 0.5) * 480,
                    vy: -Math.random() * 420 - 60,
                    life: 1.3 + Math.random(),
                    ttl: 2.6,
                    size: 4 + Math.random() * 3,
                    colour: colours[i % colours.length],
                    kind: 'confetti',
                });
            }
        }

        if (round.step > 0 || round.status === 'lost') {
            const target = round.status === 'lost' ? round.step + 1 : round.step;
            const scroller = scrollRef.current;

            if (scroller) {
                scroller.scrollTo({
                    left: Math.max(0, laneX(target) - scroller.clientWidth / 2),
                    /* A finished round snaps (a crash or the finish line must be
                     * on screen at once); live hops keep the smooth pan. */
                    behavior: round.status === 'open' ? 'smooth' : 'auto',
                });
            }
        }
    }, [round]);

    /* ------------------------------------------------------------- animation */

    useEffect(() => {
        const canvas = canvasRef.current;

        if (!canvas) {
            return;
        }

        const ctx = canvas.getContext('2d');

        if (!ctx) {
            return;
        }

        const dpr = Math.min(2.5, window.devicePixelRatio || 1);
        canvas.width = Math.round(worldW * dpr);
        canvas.height = Math.round(H * dpr);

        let frame = 0;
        let last = performance.now();

        const render = (now: number) => {
            const dt = Math.min(0.05, (now - last) / 1000);
            last = now;

            const sim = simRef.current;
            const view = viewRef.current;

            update(sim, view, dt);
            draw(ctx, sim, view, dpr, worldW, H, dpr);

            frame = requestAnimationFrame(render);
        };

        frame = requestAnimationFrame(render);

        return () => cancelAnimationFrame(frame);
    }, [worldW]);

    const nextLane = lost ? null : (round?.step ?? 0) + 1;
    const canHop = open && !busy && round !== null;

    return (
        <div className="w-full">
            <div
                className="relative overflow-hidden rounded-2xl ring-1 ring-white/10"
                style={{ background: '#0a1118' }}
            >
                <div ref={scrollRef} className="scrollbar-none overflow-x-auto">
                    <div className="relative" style={{ width: worldW, height: H }}>
                        <canvas
                            ref={canvasRef}
                            className="block"
                            style={{ width: worldW, height: H }}
                            aria-label="Road Hopper"
                        />
                    </div>
                </div>
            </div>

            {open && (
                <div className="mt-2 flex items-center gap-2">
                    <button
                        type="button"
                        onClick={onHop}
                        disabled={!canHop}
                        className={cn(
                            'flex-1 rounded-xl py-3 text-sm font-extrabold tracking-wide uppercase transition',
                            'bg-[linear-gradient(180deg,#5ce08f_0%,#2fbf6a_45%,#1c8b48_100%)] text-[#062312]',
                            'shadow-[0_12px_26px_-12px_rgba(47,191,106,0.85),inset_0_1px_0_rgba(255,255,255,0.45)]',
                            'ring-1 ring-emerald-300/30 hover:brightness-105 active:translate-y-px',
                            'disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:brightness-100',
                        )}
                    >
                        {busy ? 'Hopping…' : `Hop to lane ${nextLane ?? round?.max_steps}`}
                    </button>
                    <span className="rounded-xl bg-black/40 px-3 py-2 text-[11px] font-semibold text-dim ring-1 ring-white/10">
                        {`${round?.step ?? 0}/${round?.max_steps ?? steps} lanes · ${(round?.multiplier ?? 1).toFixed(2)}x`}
                    </span>
                </div>
            )}

            <p className="mt-2 text-center text-[11px] text-dim">
                {round
                    ? round.status === 'open'
                        ? `Lane ${round.step + 1} of ${round.max_steps} — next lane pays ${round.next_multiplier.toFixed(2)}x`
                        : round.status === 'won'
                          ? `Crossed ${round.step} lane${round.step === 1 ? '' : 's'}`
                          : 'The chicken did not make it'
                    : `Hop lane by lane · ${(chance * 100).toFixed(0)}% safe`}
            </p>

            <span className="sr-only">
                {revealed.length > 0
                    ? `Cleared lanes: ${revealed.length}`
                    : 'No lanes cleared yet'}
                {hit !== null ? `, hit in lane ${hit}` : ''}
            </span>
        </div>
    );
}

/* -------------------------------------------------------------- simulation */

function update(sim: Sim, view: View, dt: number) {
    sim.time += dt;
    sim.shake = Math.max(0, sim.shake - dt * 1.6);
    sim.flash = Math.max(0, sim.flash - dt * 2.6);

    if (sim.cars.length !== view.steps) {
        sim.cars = Array.from({ length: view.steps }, (_, i) => ({
            y: ((i * 97) % H) + 20,
            speed: (i % 2 === 0 ? 1 : -1) * (58 + ((i * 13) % 42)),
            colour: TRAFFIC[i % TRAFFIC.length],
        }));
    }

    for (const car of sim.cars) {
        car.y += car.speed * dt * 1.4;

        if (car.y > H + 110) car.y = -110;
        if (car.y < -110) car.y = H + 110;
    }

    if (sim.hop) {
        sim.hop.t += dt / 0.32;

        if (sim.hop.t >= 1) sim.hop = null;
    }

    if (sim.killer) {
        sim.killer.y += 860 * dt;

        if (!sim.rag && sim.killer.y >= CY - 20) {
            sim.rag = {
                x: sim.killer.x,
                y: CY,
                vx: (Math.random() < 0.5 ? -1 : 1) * 230,
                vy: -430,
                rot: 0,
                spin: (Math.random() < 0.5 ? -1 : 1) * 15,
                bounces: 0,
            };
            sim.flash = 0.75;
            sim.shake = 0.5;

            for (let i = 0; i < 44; i++) {
                sim.parts.push({
                    x: sim.killer.x,
                    y: CY,
                    vx: (Math.random() - 0.5) * 460,
                    vy: -Math.random() * 360 - 40,
                    life: 1.4 + Math.random(),
                    ttl: 2.4,
                    size: 3 + Math.random() * 4,
                    colour: '#f8fafc',
                    kind: 'feather',
                });
            }
        }

        if (sim.killer.y > H + 180) sim.killer = null;
    }

    if (sim.rag) {
        const rag = sim.rag;

        rag.x += rag.vx * dt;
        rag.y += rag.vy * dt;
        rag.vy += 1500 * dt;
        rag.rot += rag.spin * dt;

        if (rag.y >= H - 26 && rag.vy > 0) {
            rag.y = H - 26;

            if (rag.bounces < 1) {
                rag.bounces += 1;
                rag.vy *= -0.34;
                rag.vx *= 0.6;
                rag.spin *= 0.55;
            } else {
                rag.vy = 0;
                rag.vx *= 0.85;
                rag.spin *= 0.8;
            }
        }
    }

    for (const part of sim.parts) {
        part.x += part.vx * dt;
        part.y += part.vy * dt;

        if (part.kind === 'confetti') {
            part.vy += 620 * dt;
            part.vx *= 0.99;
        } else {
            part.vy += 180 * dt;
            part.vx *= 0.985;
        }

        part.life -= dt;
    }

    sim.parts = sim.parts.filter((part) => part.life > 0);
}

/* ----------------------------------------------------------------- drawing */

function jitter(sim: Sim) {
    return sim.shake > 0 ? (Math.random() - 0.5) * sim.shake * 26 : 0;
}

function draw(
    ctx: CanvasRenderingContext2D,
    sim: Sim,
    view: View,
    scale: number,
    width: number,
    height: number,
    dpr: number,
) {
    const { steps, chance } = view;
    const worldW = START_W + steps * LANE_W + FINISH_W;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.translate(jitter(sim), jitter(sim));

    ctx.fillStyle = '#0a1118';
    ctx.fillRect(0, 0, worldW, H);

    drawYard(ctx, sim.time);
    drawFinish(ctx, steps);

    for (let lane = 1; lane <= steps; lane++) {
        drawLane(ctx, sim, view, lane);
    }

    /* traffic — the lane the killer car is coming down keeps its traffic off,
     * otherwise two cars arrive at the bird at once */
    for (let lane = 1; lane <= steps; lane++) {
        const car = sim.cars[lane - 1];

        if (!car || lane === sim.killerLane) {
            continue;
        }

        drawVehicle(ctx, laneX(lane), car.y, car.colour, car.speed > 0);
    }

    /* multiplier plates sit above the traffic so a car never hides the odds */
    for (let lane = 1; lane <= steps; lane++) {
        drawPill(ctx, view, lane);
    }

    /* the bird */
    const baseLane = view.lost ? view.step + 1 : view.step;
    let chickenX = laneX(baseLane);
    let hopT: number | undefined;

    if (sim.hop) {
        const fromX = laneX(sim.hop.from);
        const toX = laneX(sim.hop.to);

        chickenX = fromX + (toX - fromX) * sim.hop.t;
        hopT = sim.hop.t;
    }

    if (sim.rag) {
        drawChicken(ctx, sim.rag.x, sim.rag.y, sim.time, {
            dead: true,
            rot: sim.rag.rot,
        });
    } else {
        drawChicken(ctx, chickenX, CY, sim.time, { hopT });
    }

    if (sim.killer) {
        drawVehicle(ctx, sim.killer.x, sim.killer.y, '#ef4444', true, true);
    }

    for (const part of sim.parts) {
        ctx.globalAlpha = Math.max(0, Math.min(1, part.life));

        if (part.kind === 'feather') {
            ctx.fillStyle = part.colour;
            ctx.strokeStyle = '#cbd5e1';
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.ellipse(part.x, part.y, part.size, part.size / 2.4, part.life * 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        } else {
            ctx.fillStyle = part.colour;
            ctx.fillRect(part.x, part.y, part.size, part.size * 0.7);
        }
    }

    ctx.globalAlpha = 1;

    /* a little glow on the lane the bird is standing on */
    const here = view.lost ? view.step + 1 : view.step;
    const hx = laneX(here);
    const glow = ctx.createRadialGradient(hx, CY, 8, hx, CY, LANE_W);
    glow.addColorStop(0, 'rgba(255,255,255,0.09)');
    glow.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(hx - LANE_W, 0, LANE_W * 2, H);

    if (sim.flash > 0) {
        ctx.fillStyle = `rgba(255,90,60,${sim.flash * 0.4})`;
        ctx.fillRect(0, 0, worldW, H);
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);

    void chance;
}

function drawLane(ctx: CanvasRenderingContext2D, sim: Sim, view: View, lane: number) {
    const accent = view.accent;
    const x0 = START_W + (lane - 1) * LANE_W;
    const cleared = view.step >= lane;
    const active = view.open && view.step === lane - 1;
    const lostHere = view.lost && view.step === lane - 1;

    const asphalt = ctx.createLinearGradient(0, 0, 0, H);
    asphalt.addColorStop(0, lane % 2 === 0 ? '#2c333d' : '#272e37');
    asphalt.addColorStop(1, lane % 2 === 0 ? '#1d232a' : '#1a1f25');
    ctx.fillStyle = asphalt;
    ctx.fillRect(x0, 0, LANE_W, H);

    ctx.fillStyle = 'rgba(255,255,255,0.045)';
    for (let k = 0; k < 18; k++) {
        ctx.fillRect(
            x0 + ((lane * 37 + k * 53) % (LANE_W - 6)) + 3,
            (lane * 91 + k * 67) % H,
            2,
            2,
        );
    }

    if (cleared) {
        ctx.fillStyle = 'rgba(34,197,94,0.14)';
        ctx.fillRect(x0, 0, LANE_W, H);
    }

    if (lostHere) {
        ctx.fillStyle = 'rgba(244,63,94,0.18)';
        ctx.fillRect(x0, 0, LANE_W, H);
    }

    /* lane divider, moving with the traffic */
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    for (let y = -((sim.time * 34) % 40); y < H; y += 40) {
        ctx.fillRect(x0 + LANE_W - 2, y, 2.5, 20);
    }

    if (active) {
        ctx.strokeStyle = accent;
        ctx.globalAlpha = 0.55 + Math.sin(sim.time * 4) * 0.3;
        ctx.lineWidth = 2.5;
        ctx.strokeRect(x0 + 3, 3, LANE_W - 6, H - 6);
        ctx.globalAlpha = 1;
    }

    /* manhole in the middle of the lane */
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(laneX(lane), CY, 34, 20, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2b4a62';
    ctx.beginPath();
    ctx.ellipse(laneX(lane), CY, 31, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3a6283';
    ctx.beginPath();
    ctx.ellipse(laneX(lane), CY, 25, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(9,20,28,0.55)';
    ctx.lineWidth = 2;
    for (let bar = -1; bar <= 1; bar++) {
        ctx.beginPath();
        ctx.moveTo(laneX(lane) + bar * 7, CY - 11);
        ctx.lineTo(laneX(lane) + bar * 7, CY + 11);
        ctx.stroke();
    }

}

function drawPill(ctx: CanvasRenderingContext2D, view: View, lane: number) {
    const cleared = view.step >= lane;

    ctx.fillStyle = cleared ? '#16a34a' : 'rgba(6,12,18,0.86)';
    roundRect(ctx, laneX(lane) - 33, CY + 34, 66, 24, 12);
    ctx.fill();

    ctx.fillStyle = cleared ? '#eafff0' : 'rgba(255,255,255,0.78)';
    ctx.font = '800 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${laneMult(lane, view.chance).toFixed(2)}x`, laneX(lane), CY + 51);
}

function drawYard(ctx: CanvasRenderingContext2D, time: number) {
    const edge = START_W - 14;

    const grass = ctx.createLinearGradient(0, 0, 0, H);
    grass.addColorStop(0, '#2f8f4e');
    grass.addColorStop(1, '#175c31');
    ctx.fillStyle = grass;
    ctx.fillRect(0, 0, edge, H);

    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    for (let x = 0; x < edge; x += 44) {
        if (Math.round(x / 44) % 2 === 0) {
            ctx.fillRect(x, 0, 44, H);
        }
    }

    /* coop */
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    roundRect(ctx, 14, 34, 74, 62, 6);
    ctx.fill();
    ctx.fillStyle = '#dc2626';
    roundRect(ctx, 10, 26, 74, 36, [8, 8, 0, 0]);
    ctx.fill();
    ctx.fillStyle = '#b91c1c';
    roundRect(ctx, 10, 62, 74, 34, [0, 0, 8, 8]);
    ctx.fill();
    ctx.fillStyle = '#7c4a1e';
    roundRect(ctx, 32, 74, 28, 22, 3);
    ctx.fill();

    /* hay bale */
    ctx.fillStyle = '#e6b84a';
    ctx.beginPath();
    ctx.arc(150, 64, 19, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#b8862a';
    ctx.lineWidth = 1.6;
    for (let r = 15; r > 4; r -= 5) {
        ctx.beginPath();
        ctx.arc(150, 64, r, 0, Math.PI * 2);
        ctx.stroke();
    }

    /* tree */
    ctx.fillStyle = '#14532d';
    ctx.beginPath();
    ctx.arc(170, H - 68, 28, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#15803d';
    ctx.beginPath();
    ctx.arc(162, H - 76, 21, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(134,239,172,0.4)';
    ctx.beginPath();
    ctx.arc(154, H - 82, 9, 0, Math.PI * 2);
    ctx.fill();

    /* traffic light */
    const lx = 74;
    const ly = H - 128;
    ctx.fillStyle = '#2b4a62';
    ctx.fillRect(lx - 4, ly + 40, 8, 46);
    ctx.beginPath();
    ctx.ellipse(lx, ly + 88, 20, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2b4a62';
    roundRect(ctx, lx - 17, ly, 34, 52, 12);
    ctx.fill();
    ctx.fillStyle = '#1a2f40';
    ctx.beginPath();
    ctx.arc(lx, ly + 15, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = Math.round(time) % 8 < 4 ? '#f5a623' : '#6b4b12';
    ctx.beginPath();
    ctx.arc(lx, ly + 37, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffe08a';
    ctx.beginPath();
    ctx.arc(lx - 2, ly + 34, 2.6, 0, Math.PI * 2);
    ctx.fill();

    /* bushes */
    ctx.fillStyle = '#0b1219';
    ctx.beginPath();
    ctx.ellipse(150, H - 22, 42, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2b4a62';
    ctx.beginPath();
    ctx.arc(134, H - 34, 22, 0, Math.PI * 2);
    ctx.arc(166, H - 36, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#34597a';
    ctx.beginPath();
    ctx.arc(150, H - 48, 20, 0, Math.PI * 2);
    ctx.fill();

    /* zebra crossing at the gate, level with the bird */
    ctx.fillStyle = 'rgba(229,231,235,0.9)';
    for (let k = 0; k < 4; k++) {
        roundRect(ctx, edge - 30, CY - 66 + k * 34, 24, 20, 3);
        ctx.fill();
    }

    /* curb */
    ctx.fillStyle = '#9ca3af';
    ctx.fillRect(edge, 0, 12, H);
    ctx.fillStyle = '#d1d5db';
    ctx.fillRect(edge, 0, 3, H);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(edge + 9, 0, 3, H);

    /* START sign */
    ctx.fillStyle = '#7c4a1e';
    roundRect(ctx, 20, H - 46, 62, 22, 5);
    ctx.fill();
    ctx.fillStyle = '#fff7e0';
    ctx.font = '900 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('START', 51, H - 31);

    for (let k = 0; k < 2; k++) {
        const bx = 112 + k * 46 + Math.sin(time * 1.2 + k * 2) * 20;
        const by = 150 + k * 78 + Math.cos(time * 1.5 + k) * 14;
        const flap = Math.abs(Math.sin(time * 14 + k)) * 4 + 1;

        ctx.fillStyle = k === 0 ? '#fbbf24' : '#f472b6';
        ctx.beginPath();
        ctx.ellipse(bx - 3, by, flap, 4.5, 0, 0, Math.PI * 2);
        ctx.ellipse(bx + 3, by, flap, 4.5, 0, 0, Math.PI * 2);
        ctx.fill();
    }
}

function drawFinish(ctx: CanvasRenderingContext2D, steps: number) {
    const fx = START_W + steps * LANE_W;

    ctx.fillStyle = '#1f6b3a';
    ctx.fillRect(fx, 0, FINISH_W, H);

    for (let y = 0; y < H; y += 20) {
        for (let k = 0; k < 2; k++) {
            ctx.fillStyle = (y / 20 + k) % 2 === 0 ? '#0b0f14' : '#f8fafc';
            ctx.fillRect(fx + k * 20, y, 20, 20);
        }
    }

    ctx.fillStyle = '#0b0f14';
    ctx.fillRect(fx + 40, 0, 4, H);

    ctx.fillStyle = '#f8fafc';
    ctx.font = '900 14px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('FINISH', fx + 54, 32);

    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.ellipse(fx + 96, CY, 17, 22, 0.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath();
    ctx.ellipse(fx + 100, CY + 24, 24, 8, 0, 0, Math.PI * 2);
    ctx.fill();
}

function drawVehicle(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    colour: string,
    facingDown: boolean,
    police = false,
) {
    const w = 34;
    const len = 72;

    ctx.save();
    ctx.translate(x, y);

    if (!facingDown) {
        ctx.scale(1, -1);
    }

    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    roundRect(ctx, -w / 2 + 3, -len / 2 + 5, w, len, 10);
    ctx.fill();

    ctx.fillStyle = colour;
    roundRect(ctx, -w / 2, -len / 2, w, len, 11);
    ctx.fill();

    ctx.fillStyle = 'rgba(6,14,22,0.78)';
    roundRect(ctx, -w / 2 + 5, -len / 2 + 11, w - 10, 17, 4);
    ctx.fill();
    roundRect(ctx, -w / 2 + 5, len / 2 - 27, w - 10, 13, 4);
    ctx.fill();

    ctx.fillStyle = '#080c10';
    roundRect(ctx, -w / 2 - 3, -len / 2 + 9, 5, 16, 2);
    ctx.fill();
    roundRect(ctx, w / 2 - 2, -len / 2 + 9, 5, 16, 2);
    ctx.fill();
    roundRect(ctx, -w / 2 - 3, len / 2 - 25, 5, 16, 2);
    ctx.fill();
    roundRect(ctx, w / 2 - 2, len / 2 - 25, 5, 16, 2);
    ctx.fill();

    ctx.fillStyle = '#fff8c8';
    roundRect(ctx, -w / 2 + 3, len / 2 - 6, 9, 4, 2);
    ctx.fill();
    roundRect(ctx, w / 2 - 12, len / 2 - 6, 9, 4, 2);
    ctx.fill();

    if (police) {
        ctx.fillStyle = '#f43f5e';
        roundRect(ctx, -w / 2 + 4, -6, 10, 6, 2);
        ctx.fill();
        ctx.fillStyle = '#38bdf8';
        roundRect(ctx, w / 2 - 14, -6, 10, 6, 2);
        ctx.fill();
    }

    ctx.restore();
}

function drawChicken(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    time: number,
    options: { dead?: boolean; rot?: number; hopT?: number } = {},
) {
    const { dead = false, rot = 0, hopT } = options;

    ctx.save();
    ctx.translate(x, y);

    if (dead) {
        ctx.rotate(rot);
    }

    const air = hopT !== undefined ? Math.sin(Math.PI * hopT) : 0;
    const squish = 1 + air * 0.12;

    if (!dead && hopT !== undefined) {
        ctx.rotate(air * 0.18);
    }

    ctx.scale(1 / squish, squish);

    /* legs */
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    for (const [lx, dir] of [
        [-5, 1],
        [6, -1],
    ] as const) {
        const step = dead ? dir * 6 : Math.sin(time * 3) * 1.5;
        ctx.beginPath();
        ctx.moveTo(lx, 15);
        ctx.lineTo(lx + step, dead ? 26 : 25);
        ctx.stroke();
    }

    /* tail */
    const feathers = ['#cbd5e1', '#e2e8f0', '#f1f5f9'];
    for (let k = 0; k < 3; k++) {
        ctx.save();
        ctx.translate(-17, 0);
        ctx.rotate(-0.95 + k * 0.5 + Math.sin(time * 3 + k) * 0.05);
        ctx.fillStyle = feathers[k];
        ctx.strokeStyle = '#b6c2d0';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.ellipse(-9, 0, 12, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
    }

    /* body */
    const body = ctx.createRadialGradient(-6, -8, 3, 0, 2, 26);
    body.addColorStop(0, '#ffffff');
    body.addColorStop(0.7, '#eef2f7');
    body.addColorStop(1, '#c9d4e0');
    ctx.fillStyle = body;
    ctx.strokeStyle = '#aebccc';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 2, 21, 17, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    /* wing */
    const wave = dead
        ? Math.sin(time * 32) * 0.8 - 0.3
        : hopT !== undefined
          ? -Math.sin(hopT * Math.PI) * 1.15
          : Math.sin(time * 3) * 0.07;
    ctx.save();
    ctx.translate(-3, 1);
    ctx.rotate(wave);
    ctx.fillStyle = '#f1f5f9';
    ctx.strokeStyle = '#aebccc';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(6, -4);
    ctx.quadraticCurveTo(-6, -8, -15, 2);
    ctx.quadraticCurveTo(-11, 11, 2, 9);
    ctx.quadraticCurveTo(9, 5, 6, -4);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    /* comb */
    ctx.fillStyle = '#ef4444';
    ctx.strokeStyle = '#b91c1c';
    ctx.lineWidth = 1;
    for (const [cx, cy, r] of [
        [6, -22, 4],
        [11.5, -24, 4.6],
        [17, -21, 3.6],
    ] as const) {
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
    }

    /* head */
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#aebccc';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(12, -12, 10.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    /* beak */
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.moveTo(21, -14);
    ctx.lineTo(31, -10);
    ctx.lineTo(21, -8);
    ctx.closePath();
    ctx.fill();

    /* wattle */
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.ellipse(18, -3, 2.6, 4.6, 0.2, 0, Math.PI * 2);
    ctx.fill();

    /* eye */
    if (dead) {
        ctx.strokeStyle = '#111827';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(10, -17);
        ctx.lineTo(16, -11);
        ctx.moveTo(16, -17);
        ctx.lineTo(10, -11);
        ctx.stroke();
    } else if (time % 3.4 < 0.14) {
        ctx.strokeStyle = '#111827';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(10, -13);
        ctx.lineTo(16, -13);
        ctx.stroke();
    } else {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(13, -13, 4.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#aebccc';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = '#111827';
        ctx.beginPath();
        ctx.arc(14.2, -13, 2.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(15, -14, 0.9, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.restore();
}

function roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number | number[],
) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
}
