import { useEffect, useRef } from "react";

// calls back once, the first time at least half of the element is on screen: a lock under the fold was mounted, not seen
export const useSeen = <T extends Element>(onSeen: () => void) => {
  const ref = useRef<T | null>(null);
  const latest = useRef(onSeen);
  latest.current = onSeen;
  const done = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || done.current) return;
    const fire = () => {
      if (done.current) return;
      done.current = true;
      latest.current();
    };
    if (typeof IntersectionObserver === "undefined") {
      fire();
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        fire();
      },
      { threshold: 0.5 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return ref;
};
