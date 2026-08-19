import { useRef, useState, useCallback } from "react";

// captures drawing strokes as {x, y, t} points, same format the recorder tool used
// strokes live in both a ref AND state -- state alone caused a stale closure bug
// (handleCheck would read strokes from before the last setStrokes update flushed,
// submitting an empty array even though the user had drawn something). getStrokes()
// reads the ref so it's always current regardless of render timing.
export function useStrokeCanvas() {
  const canvasRef = useRef(null);
  const currentStrokeRef = useRef([]);
  const strokesRef = useRef([]);
  const [strokes, setStrokes] = useState([]);

  const getContext = useCallback(() => {
    const canvas = canvasRef.current;
    return canvas ? canvas.getContext("2d") : null;
  }, []);

  const getRelativePoint = useCallback((event) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      t: Date.now() / 1000,
    };
  }, []);

  // pointer events unify mouse, touch, and stylus into one API -- capturing the pointer
  // on down keeps move/up routed to the canvas even if a finger drifts outside its bounds
  // mid-stroke, which touch does far more easily than a mouse ever does
  const handlePointerDown = useCallback(
    (event) => {
      event.preventDefault();
      try {
        canvasRef.current?.setPointerCapture(event.pointerId);
      } catch {
        // setPointerCapture throws if the browser doesn't recognize the pointerId as an
        // active pointer -- drawing still works without capture, just less robust to the
        // pointer straying outside the canvas mid-stroke
      }
      currentStrokeRef.current = [getRelativePoint(event)];
    },
    [getRelativePoint]
  );

  const handlePointerMove = useCallback(
    (event) => {
      if (currentStrokeRef.current.length === 0) return;
      event.preventDefault();

      const point = getRelativePoint(event);
      const prev = currentStrokeRef.current[currentStrokeRef.current.length - 1];
      currentStrokeRef.current.push(point);
      drawSegment(getContext(), prev, point);
    },
    [getRelativePoint, getContext]
  );

  const handlePointerUp = useCallback((event) => {
    if (event?.pointerId != null) {
      try {
        canvasRef.current?.releasePointerCapture(event.pointerId);
      } catch {
        // no-op if it was never captured in the first place
      }
    }
    if (currentStrokeRef.current.length > 1) {
      const updated = [...strokesRef.current, currentStrokeRef.current];
      strokesRef.current = updated;
      setStrokes(updated);
    }
    currentStrokeRef.current = [];
  }, []);

  const clear = useCallback(() => {
    const ctx = getContext();
    const canvas = canvasRef.current;
    if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
    strokesRef.current = [];
    setStrokes([]);
    currentStrokeRef.current = [];
  }, [getContext]);

  // drops the last stroke and redraws the rest from scratch -- canvas has no native
  // per-stroke undo, so this is the simplest correct way to "remove" one
  const undo = useCallback(() => {
    const ctx = getContext();
    const canvas = canvasRef.current;
    if (!ctx || !canvas || strokesRef.current.length === 0) return;

    const updated = strokesRef.current.slice(0, -1);
    strokesRef.current = updated;
    setStrokes(updated);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const stroke of updated) {
      for (let i = 1; i < stroke.length; i++) drawSegment(ctx, stroke[i - 1], stroke[i]);
    }
  }, [getContext]);

  // use this instead of `strokes` when you need the current value right now
  // (state lags a render behind)
  const getStrokes = useCallback(() => strokesRef.current, []);

  return {
    canvasRef,
    strokes,
    getStrokes,
    clear,
    undo,
    handlers: {
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
      onPointerLeave: handlePointerUp, // rarely fires once captured, kept as a fallback
      onPointerCancel: handlePointerUp, // e.g. the OS interrupts a touch gesture mid-stroke
    },
  };
}

function drawSegment(ctx, from, to) {
  if (!ctx) return;
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.strokeStyle = "black";
  ctx.stroke();
}
