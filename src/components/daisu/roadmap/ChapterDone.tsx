import { createPortal } from "react-dom";
import Monetary from "../../Monetary";
import type { Roadmap } from "../../../services/daisu/RoadmapService";
import { chapterName, missionWords } from "./missionCopy";
import { kp } from "../potMath";
import i18n from "../../../i18n";

interface Props {
  done: { chapter: number; bonus: number };
  roadmap: Roadmap | null;
  game: string;
  onClose: () => void;
}

const t = (key: string, vars?: Record<string, string | number>) => i18n.t(`daisu.roadmap.${key}`, vars);

// a chapter just closed: its bonus, and what she wants next
const ChapterDone = ({ done, roadmap, game, onClose }: Props) =>
  createPortal(
    <div className="fixed inset-0 z-[65] flex items-end justify-center text-white md:items-center" style={{ background: "rgba(9, 7, 20, 0.78)" }}>
      <div
        role="dialog"
        aria-label={t("chapterDone", { n: done.chapter })}
        className="flex max-h-full w-full flex-col overflow-y-auto bg-surface shadow-2xl md:w-[600px]"
      >
        <div
          className="flex gap-5 px-5 pb-5 pt-6 md:px-7 md:pt-7"
          style={{ background: "radial-gradient(120% 90% at 20% 10%, rgba(255, 204, 0, 0.14), transparent 60%)" }}
        >
          <img src="/images/daisu/idle.webp" alt="" className="h-36 w-auto shrink-0 md:h-[190px]" />
          <div className="flex flex-col gap-2.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-accent-gold">{t("chapterDone", { n: done.chapter })}</span>
            <span className="text-[32px] font-extrabold leading-none text-accent-gold md:text-[40px]">+{kp(done.bonus)}</span>
            <p className="m-0 text-sm leading-normal text-ink-soft">{t(roadmap?.finished ? "finishedLine" : "chapterDoneLine")}</p>
          </div>
        </div>
        {roadmap && !roadmap.finished && (
          <div className="flex flex-col gap-1.5 px-5 md:px-7">
            <span className="pb-1 text-[11px] font-bold uppercase tracking-wider text-ink-muted">{chapterName(roadmap.chapter)}</span>
            {roadmap.missions.map((m) => (
              <div key={m.key} className="flex items-center justify-between gap-3 bg-surface-nav px-3.5 py-2.5 text-[13px] font-semibold">
                <span className="min-w-0">{missionWords(m.key, m.target, game).title}</span>
                <b className="shrink-0 text-accent-gold">
                  <Monetary value={m.reward} />
                </b>
              </div>
            ))}
          </div>
        )}
        <div className="flex px-5 pb-6 pt-5 md:px-7 md:pb-7">
          <button
            type="button"
            onClick={onClose}
            className="h-11 w-full rounded-md border-none bg-accent px-6 text-sm font-bold text-white hover:border-none hover:bg-accent-light focus:outline-none md:h-[42px] md:w-auto"
          >
            {t("letsGo")}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );

export default ChapterDone;
