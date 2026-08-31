import { useEffect, useRef, useState } from "react";
import { derivBus } from "@/lib/deriv/tick-bus";
import type { ConnectionStatus, Tick } from "@/lib/deriv-ws";

const MAX_TICKS = 240;

export function useDerivTicks(symbol: string) {
  const [ticks, setTicks] = useState<Tick[]>([]);
  const [status, setStatus] = useState<ConnectionStatus>("closed");
  const [pipSize, setPipSize] = useState(() => derivBus.getPipSize(symbol));
  const [error, setError] = useState<string | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!symbol) {
      setTicks([]);
      setStatus("closed");
      return;
    }

    setError(null);
    setPipSize(derivBus.getPipSize(symbol));

    const syncTicks = () => {
      const busTicks = derivBus.getTicks(symbol);
      const mapped: Tick[] = (busTicks.length > MAX_TICKS ? busTicks.slice(-MAX_TICKS) : busTicks).map((t) => ({
        epoch: Math.floor(t.t / 1000),
        quote: t.price,
      }));
      setTicks(mapped);
      setPipSize(derivBus.getPipSize(symbol));
    };

    const scheduleFlush = () => {
      if (rafRef.current !== null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        syncTicks();
      });
    };

    const unsubStatus = derivBus.onStatus((s) => {
      setStatus(
        s === "live"
          ? "open"
          : s === "connecting"
            ? "connecting"
            : s === "error"
              ? "error"
              : "closed",
      );
    });

    const unsubHistory = derivBus.onHistory((sym) => {
      if (sym === symbol) scheduleFlush();
    });

    const unsubTick = derivBus.onTick((sym) => {
      if (sym === symbol) scheduleFlush();
    });

    const unsubSym = derivBus.subscribe([symbol]);

    // Prime immediately from cache
    syncTicks();

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      unsubTick();
      unsubHistory();
      unsubStatus();
      unsubSym();
    };
  }, [symbol]);

  return { ticks, status, pipSize, error };
}

