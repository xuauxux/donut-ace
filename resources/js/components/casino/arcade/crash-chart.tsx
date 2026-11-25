import { useEffect, useRef, useState } from 'react';

type Props = {
    accent: string;
    /** Auto cash-out target; the server pays if the crash point reaches it. */
    target: number;
    /** Crash point reported by the server, or null before a round is played. */
    crashAt: number | null;
    phase: 'idle' | 'run' | 'settled';
    won: boolean;
};

/** Multiplier growth used for the curve: m = e^(k·t). */
const K = 0.22;

/**
 * Canvas crash graph in the style of the reference: grid with multiplier and
 * second axes, a growing exponential curve with a soft fill, and the big
 * multiplier centred on the chart. Everything is drawn on canvas so the
 * animation never re-renders React.
 */
export function CrashChart({ accent, target, crashAt, phase, won }: Props) {
    const wrapRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [size, setSize] = useState({ width: 640, height: 320 });

    const stateRef = useRef({ accent, target, crashAt, phase, won });
    stateRef.current = { accent, target, crashAt, phase, won };

    useEffect(() => {
        const wrap = wrapRef.current;

        if (!wrap) {
            return;
        }

        const fit = () =>
            setSize({
                width: Math.max(280, Math.round(wrap.clientWidth)),
                height: Math.max(180, Math.round(wrap.clientHeight)),
            });

        fit();

        const observer = new ResizeObserver(fit);
        observer.observe(wrap);

        return () => observer.disconnect();
    }, []);

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
        canvas.width = Math.round(size.width * dpr);
        canvas.height = Math.round(size.height * dpr);

        let frame = 0;
        let started = 0;
        let elapsed = 0;
        let last = performance.now();
        let lastPhase: Props['phase'] | null = null;

        const render = (now: number) => {
            const dt = Math.min(0.05, (now - last) / 1000);
            last = now;

            const state = stateRef.current;

            if (state.phase === 'run') {
                if (lastPhase !== 'run') {
                    elapsed = 0;
                    started = now;
                }

                elapsed = (now - started) / 1000;
            } else if (state.phase === 'idle') {
                elapsed = 0;
            }

            lastPhase = state.phase;

            paint(ctx, state, elapsed, size.width, size.height, dpr);
            frame = requestAnimationFrame(render);
        };

        frame = requestAnimationFrame(render);

        return () => cancelAnimationFrame(frame);
    }, [size.width, size.height]);

    return (
        <div
            ref={wrapRef}
            className="relative h-[260px] w-full overflow-hidden rounded-2xl bg-[#0b1520] ring-1 ring-white/10 sm:h-[320px]"
        >
            <canvas
                ref={canvasRef}
                className="size-full"
                style={{ width: size.width, height: size.height }}
                aria-label="Crash multiplier graph"
            />
        </div>
    );
}

type State = {
    accent: string;
    target: number;
    crashAt: number | null;
    phase: Props['phase'];
    won: boolean;
};

function paint(
    ctx: CanvasRenderingContext2D,
    state: State,
    elapsed: number,
    width: number,
    height: number,
    dpr: number,
) {
    const left = 46;
    const right = width - 16;
    const top = 16;
    const bottom = height - 26;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#0b1520';
    ctx.fillRect(0, 0, width, height);

    const settling = state.phase === 'run' || state.phase === 'settled';
    const crashAt = state.crashAt ?? state.target;
    const ceiling = settling ? Math.min(state.target, crashAt) : 1;
    const value =
        state.phase === 'settled'
            ? ceiling
            : settling
              ? Math.min(ceiling, Math.exp(K * elapsed))
              : 1;

    const tMax = Math.max(8, (Math.log(Math.max(1.01, value)) / K) * 1.25);
    const yMax = Math.max(2, value * 1.25);

    const xOf = (t: number) => left + (t / tMax) * (right - left);
    const yOf = (m: number) => bottom - ((m - 1) / Math.max(0.01, yMax - 1)) * (bottom - top);

    /* grid */
    ctx.strokeStyle = 'rgba(127,152,168,0.16)';
    ctx.fillStyle = 'rgba(160,178,192,0.85)';
    ctx.lineWidth = 1;
    ctx.font = '11px ui-sans-serif, system-ui, sans-serif';

    for (let i = 0; i <= 4; i++) {
        const m = 1 + ((yMax - 1) * i) / 4;
        const y = yOf(m);

        ctx.beginPath();
        ctx.moveTo(left, y);
        ctx.lineTo(right, y);
        ctx.stroke();

        ctx.textAlign = 'right';
        ctx.fillText(`${m.toFixed(1)}×`, left - 8, y + 4);
    }

    for (let i = 0; i <= 4; i++) {
        const t = (tMax * i) / 4;

        ctx.textAlign = 'center';
        ctx.fillText(`${Math.round(t)}s`, xOf(t), height - 8);
    }

    /* target line */
    if (settling) {
        const ty = yOf(Math.min(state.target, yMax));

        ctx.save();
        ctx.setLineDash([5, 5]);
        ctx.strokeStyle = 'rgba(201,247,58,0.45)';
        ctx.beginPath();
        ctx.moveTo(left, ty);
        ctx.lineTo(right, ty);
        ctx.stroke();
        ctx.restore();

        ctx.fillStyle = 'rgba(201,247,58,0.8)';
        ctx.textAlign = 'left';
        ctx.font = '10px ui-sans-serif, system-ui, sans-serif';
        ctx.fillText(`cash out ${state.target.toFixed(2)}×`, left + 4, ty - 6);
    }

    /* curve */
    const crashed = state.phase === 'settled' && !state.won;
    const colour = crashed ? '#f0524a' : state.accent;
    const endT = Math.log(Math.max(1, value)) / K;

    if (settling && value > 1.001) {
        const steps = 90;

        ctx.beginPath();

        for (let i = 0; i <= steps; i++) {
            const t = (endT * i) / steps;
            const x = xOf(t);
            const y = yOf(Math.exp(K * t));

            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }

        ctx.strokeStyle = colour;
        ctx.lineWidth = 3.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();

        ctx.lineTo(xOf(endT), bottom);
        ctx.lineTo(left, bottom);
        ctx.closePath();

        const fill = ctx.createLinearGradient(0, top, 0, bottom);
        fill.addColorStop(0, `${colour}55`);
        fill.addColorStop(1, `${colour}00`);
        ctx.fillStyle = fill;
        ctx.fill();

        if (!crashed) {
            const hx = xOf(endT);
            const hy = yOf(value);

            ctx.beginPath();
            ctx.arc(hx, hy, 14, 0, Math.PI * 2);
            ctx.fillStyle = `${colour}22`;
            ctx.fill();

            ctx.beginPath();
            ctx.arc(hx, hy, 5, 0, Math.PI * 2);
            ctx.fillStyle = colour;
            ctx.fill();
        }
    }

    /* big multiplier */
    ctx.textAlign = 'center';
    ctx.fillStyle = crashed ? '#f0524a' : settling ? colour : 'rgba(226,236,244,0.9)';
    ctx.font = '900 46px ui-sans-serif, system-ui, sans-serif';
    const label = (settling ? value : 1).toFixed(2);
    ctx.fillText(`${label}×`, width / 2, height / 2 - 4);

    ctx.fillStyle = 'rgba(160,178,192,0.9)';
    ctx.font = '600 12px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText(
        crashed
            ? `Crashed at ${crashAt.toFixed(2)}×`
            : state.phase === 'settled'
              ? `Cashed out at ${state.target.toFixed(2)}×`
              : state.phase === 'run'
                ? 'Climbing…'
                : 'Place a bet to start the round',
        width / 2,
        height / 2 + 20,
    );
}
