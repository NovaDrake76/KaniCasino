import { useContext, useEffect, useMemo, useRef, useState } from "react";
import UserContext from "../../../UserContext";
import i18n from "../../../i18n";
import { putCardStyle } from "../../../services/users/UserServices";
import { CARD_H, CARD_W, renderAll } from "../cardRender";
import { loadCardArt, loadCardFonts } from "../cardAssets";
import { resolveStyle, stylesFor } from "../cardStyles";
import { FanCardStyleId } from "../cardTypes";
import { ShareCardProps } from "./ShareCard.types";

const SAID_MS = 2200;
const SWIPE_PX = 34;

export const fileNameFor = (character: string) =>
  `${character.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "fan"}-top-fan.png`;

export function useShareCardServices({ data, leadsABoard, onClose }: ShareCardProps) {
  const { userData, toogleUserData } = useContext(UserContext);
  const styles = useMemo(() => stylesFor(leadsABoard), [leadsABoard]);

  const [at, setAt] = useState(() => Math.max(0, styles.indexOf(resolveStyle(userData?.cardStyle, styles))));
  const [frames, setFrames] = useState<Map<FanCardStyleId, HTMLCanvasElement> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [said, setSaid] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let alive = true;
    setFrames(null);
    setError(null);
    (async () => {
      try {
        await loadCardFonts();
        const art = await loadCardArt(data.image);
        if (alive) setFrames(renderAll(styles, data, art));
      } catch {
        if (alive) setError(i18n.t("fanCard.artFailed"));
      }
    })();
    return () => {
      alive = false;
    };
  }, [data, styles]);

  // the visible canvas only ever copies a finished frame, so moving through the set costs
  // a blit instead of a redraw
  useEffect(() => {
    const canvas = canvasRef.current;
    const frame = frames?.get(styles[at]);
    if (!canvas || !frame) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, CARD_W, CARD_H);
    ctx.drawImage(frame, 0, 0);
  }, [frames, at, styles]);

  useEffect(() => {
    if (!said) return;
    const id = setTimeout(() => setSaid(null), SAID_MS);
    return () => clearTimeout(id);
  }, [said]);

  const go = (index: number) => setAt(Math.min(Math.max(index, 0), styles.length - 1));
  const step = (delta: number) => setAt((prev) => (prev + delta + styles.length) % styles.length);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") step(-1);
      if (e.key === "ArrowRight") step(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const dragFrom = useRef<number | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    dragFrom.current = e.clientX;
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const from = dragFrom.current;
    dragFrom.current = null;
    if (from === null || styles.length < 2) return;
    const dx = e.clientX - from;
    if (Math.abs(dx) > SWIPE_PX) step(dx < 0 ? 1 : -1);
  };

  const toPng = () =>
    new Promise<Blob | null>((resolve) => {
      const frame = frames?.get(styles[at]);
      if (!frame) return resolve(null);
      frame.toBlob(resolve, "image/png");
    });

  // whatever they last sent out is what they wear. a failed write is not worth an error
  // in front of someone who just shared something.
  const remember = async (style: FanCardStyleId) => {
    try {
      await putCardStyle(style);
      if (userData) toogleUserData({ ...userData, cardStyle: style });
    } catch {
      /* the choice is cosmetic */
    }
  };

  const save = async (ready?: Blob | null) => {
    const png = ready || (await toPng());
    if (!png) return;
    const url = URL.createObjectURL(png);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileNameFor(data.name);
    link.click();
    URL.revokeObjectURL(url);
    setSaid(i18n.t("fanCard.saved"));
  };

  const copy = async (ready?: Blob | null) => {
    const png = ready || (await toPng());
    if (!png) return;
    try {
      if (typeof ClipboardItem === "undefined") throw new Error("no clipboard");
      await navigator.clipboard.write([new ClipboardItem({ "image/png": png })]);
      setSaid(i18n.t("fanCard.copied"));
      remember(styles[at]);
    } catch {
      save(png);
    }
  };

  const share = async () => {
    const png = await toPng();
    if (!png) return;
    const file = new File([png], fileNameFor(data.name), { type: "image/png" });
    remember(styles[at]);
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file] });
      } catch {
        /* cancelling a share is not a failure */
      }
      return;
    }
    copy(png);
  };

  return {
    data,
    styles,
    at,
    styleId: styles[at],
    label: i18n.t(`fanCard.style.${styles[at]}`),
    loading: !frames && !error,
    error,
    said,
    canvasRef,
    go,
    step,
    onPointerDown,
    onPointerUp,
    share,
    copy: () => copy(),
    save: () => save(),
    onClose,
  };
}
