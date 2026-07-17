"use client";

import { useEffect, useRef, useState } from "react";

import { getCelebrationPreset } from "@/features/tasks/celebration-preset";

const MOMENTUM_COLORS = ["#7c3aed", "#8b5cf6", "#f59e0b", "#10b981", "#38bdf8"];

type CelebrationState =
  "idle" | "fired" | "seen" | "reduced" | "disabled" | "failed";

export function CompletionCelebrationEffect({
  completionId,
  enabled,
}: {
  completionId: string;
  enabled: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<CelebrationState>("idle");

  useEffect(() => {
    const timers: number[] = [];
    let cancelled = false;
    let reset: (() => void) | undefined;

    async function run() {
      await Promise.resolve();
      if (cancelled) {
        return;
      }

      if (!enabled) {
        setState("disabled");
        return;
      }

      const reducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      if (reducedMotion) {
        setState("reduced");
        return;
      }

      const storageKey = `momentum:celebrated:${completionId}`;
      try {
        if (window.sessionStorage.getItem(storageKey)) {
          setState("seen");
          return;
        }
        window.sessionStorage.setItem(storageKey, "1");
      } catch {
        // Storage availability must never block persisted celebration content.
      }

      try {
        const canvas = canvasRef.current;
        if (!canvas) {
          setState("failed");
          return;
        }
        const { default: confetti } = await import("canvas-confetti");
        if (cancelled) {
          return;
        }
        const preset = getCelebrationPreset({
          enabled,
          reducedMotion: false,
          viewportWidth: window.innerWidth,
        });
        const fire = confetti.create(canvas, {
          resize: true,
          useWorker: false,
        });
        reset = () => fire.reset();

        fire({
          particleCount: preset.particleCount,
          spread: preset.spread,
          startVelocity: 52,
          origin: { x: 0.5, y: 0.58 },
          scalar: preset.scalar,
          colors: MOMENTUM_COLORS,
          zIndex: 55,
          disableForReducedMotion: true,
        });

        const emojiShapes = ["🎉", "✨", "⚡"].map((text) =>
          confetti.shapeFromText({ text, scalar: 2 }),
        );
        const origins = [0.2, 0.5, 0.8];
        for (const [index, shape] of emojiShapes.entries()) {
          const timer = window.setTimeout(
            () => {
              if (!cancelled) {
                fire({
                  particleCount: Math.ceil(preset.emojiCount / 3),
                  shapes: [shape],
                  angle: 90,
                  spread: 46,
                  startVelocity: 38,
                  gravity: 0.72,
                  ticks: 180,
                  origin: { x: origins[index] ?? 0.5, y: 0.88 },
                  scalar: preset.scalar * 1.35,
                  zIndex: 55,
                  disableForReducedMotion: true,
                });
              }
            },
            140 + index * 160,
          );
          timers.push(timer);
        }

        timers.push(
          window.setTimeout(() => {
            if (!cancelled) {
              fire({
                particleCount: Math.ceil(preset.particleCount * 0.35),
                spread: preset.spread + 16,
                startVelocity: 34,
                origin: { x: 0.5, y: 0.64 },
                scalar: preset.scalar * 0.75,
                colors: MOMENTUM_COLORS,
                zIndex: 55,
                disableForReducedMotion: true,
              });
            }
          }, 620),
        );
        setState("fired");
      } catch {
        if (!cancelled) {
          setState("failed");
        }
      }
    }

    void run();
    return () => {
      cancelled = true;
      timers.forEach((timer) => window.clearTimeout(timer));
      reset?.();
    };
  }, [completionId, enabled]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-[55] size-full"
      data-testid="completion-celebration-effect"
      data-celebration-state={state}
      aria-hidden="true"
    />
  );
}
