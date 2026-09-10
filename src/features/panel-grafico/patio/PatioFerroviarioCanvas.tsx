"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { type MovementRow, type PatioTrackCatalogItem, type ChangeKind, type PatioTrack, type PatioRemovedGhost } from "../types";
import { buildPatioTracks, buildServiceActivity } from "./model";
import { resizeCanvas, patioLayout, toRad, polarPoint, trackEndPoint, distanceToSegment } from "./geometry";
import { drawPatioCanvas } from "./render";

export function PatioFerroviarioCanvas({
  movements,
  torneados,
  trackCatalog,
  changedKeys,
}: {
  movements: MovementRow[];
  torneados: MovementRow[];
  trackCatalog: PatioTrackCatalogItem[];
  changedKeys: Map<string, ChangeKind>;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const previousTracksRef = useRef<PatioTrack[]>([]);
  const removedGhostsRef = useRef<PatioRemovedGhost[]>([]);
  const [selectedTrackId, setSelectedTrackId] = useState("VIA-4");

  const tracks = useMemo(() => buildPatioTracks(movements, trackCatalog), [movements, trackCatalog]);
  const serviceActivity = useMemo(
    () => ({
      torno: buildServiceActivity(torneados, "Torno"),
      lavado: null,
    }),
    [torneados]
  );

  useEffect(() => {
    if (!tracks.some((track) => track.id === selectedTrackId)) setSelectedTrackId(tracks[0]?.id ?? "VIA-4");
  }, [selectedTrackId, tracks]);

  useEffect(() => {
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    const currentKeys = new Set(tracks.map((track) => track.locomotive?.key).filter(Boolean) as string[]);
    const removed = previousTracksRef.current
      .filter((track): track is PatioTrack & { locomotive: NonNullable<PatioTrack["locomotive"]> } => Boolean(track.locomotive?.key))
      .filter((track) => !currentKeys.has(track.locomotive.key))
      .map((track) => ({ ...track, removedAt: now }));

    removedGhostsRef.current = [
      ...removedGhostsRef.current.filter((ghost) => now - ghost.removedAt < 1800),
      ...removed,
    ];
    previousTracksRef.current = tracks;
  }, [tracks]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    let frameId = 0;
    let disposed = false;
    let sizeVersion = 0;
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const observer =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
            sizeVersion += 1;
            resizeCanvas(canvas, container);
          })
        : null;
    observer?.observe(container);

    const draw = (time: number) => {
      if (disposed) return;
      void sizeVersion;
      resizeCanvas(canvas, container);
      drawPatioCanvas(context, canvas, {
        tracks,
        serviceActivity,
        selectedTrackId,
        changedKeys,
        removedGhosts: removedGhostsRef.current,
        time,
        reducedMotion,
      });
      frameId = window.requestAnimationFrame(draw);
    };

    frameId = window.requestAnimationFrame(draw);
    return () => {
      disposed = true;
      observer?.disconnect();
      if (frameId) window.cancelAnimationFrame(frameId);
    };
  }, [changedKeys, selectedTrackId, serviceActivity, tracks]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handlePointer = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / Math.max(1, rect.width);
      const scaleY = canvas.height / Math.max(1, rect.height);
      const point = { x: (event.clientX - rect.left) * scaleX, y: (event.clientY - rect.top) * scaleY };
      const layout = patioLayout(canvas.width, canvas.height);
      let nearest = selectedTrackId;
      let nearestDistance = Number.POSITIVE_INFINITY;
      for (const track of tracks) {
        const angle = toRad(track.angle);
        const start = polarPoint(layout, layout.turntableRadius, angle);
        const end = trackEndPoint(layout, track.angle);
        const distance = distanceToSegment(point, start, end);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearest = track.id;
        }
      }
      if (nearestDistance < 44) setSelectedTrackId(nearest);
    };
    canvas.addEventListener("pointerdown", handlePointer);
    return () => canvas.removeEventListener("pointerdown", handlePointer);
  }, [selectedTrackId, tracks]);

  return (
    <div ref={containerRef} className="relative h-full min-h-0 w-full overflow-hidden">
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="Patio ferroviario interactivo con puente giratorio, vias y locomotoras activas"
        className="h-full w-full cursor-pointer"
      />
    </div>
  );
}
