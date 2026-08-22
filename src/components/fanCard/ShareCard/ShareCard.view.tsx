import { IoClose } from "react-icons/io5";
import { BsChevronLeft, BsChevronRight } from "react-icons/bs";
import { CARD_H, CARD_W } from "../cardRender";
import { ShareCardViewProps } from "./ShareCard.types";
import i18n from "../../../i18n";

const ShareCardView: React.FC<ShareCardViewProps> = ({
  data,
  styles,
  at,
  label,
  loading,
  error,
  said,
  canvasRef,
  go,
  step,
  onPointerDown,
  onPointerUp,
  share,
  copy,
  save,
  onClose,
}) => (
  <div
    className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4"
    onClick={onClose}
    role="presentation"
  >
    <div
      className="notched w-full max-w-[560px] bg-[#211B38] p-4 sm:p-6"
      onClick={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
      aria-label={i18n.t("fanCard.title", { name: data.name })}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="truncate text-sm font-bold text-white">{i18n.t("fanCard.title", { name: data.name })}</p>
        <button onClick={onClose} aria-label={i18n.t("fanCard.close")} className="shrink-0 text-[#8B84A6] hover:text-white">
          <IoClose className="text-2xl" />
        </button>
      </div>

      <div className="relative select-none" onPointerDown={onPointerDown} onPointerUp={onPointerUp}>
        <canvas
          ref={canvasRef}
          width={CARD_W}
          height={CARD_H}
          className="block h-auto w-full bg-[#151225]"
          style={{ aspectRatio: `${CARD_W} / ${CARD_H}` }}
        />
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-[#8B84A6]">
            {i18n.t("fanCard.drawing")}
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-xs text-[#E88]">{error}</div>
        )}
        {styles.length > 1 && !error && (
          <>
            <button
              onClick={() => step(-1)}
              aria-label={i18n.t("fanCard.previous")}
              className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/60 p-2 text-white hover:bg-black/80"
            >
              <BsChevronLeft />
            </button>
            <button
              onClick={() => step(1)}
              aria-label={i18n.t("fanCard.next")}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/60 p-2 text-white hover:bg-black/80"
            >
              <BsChevronRight />
            </button>
          </>
        )}
      </div>

      {styles.length > 1 && (
        <div className="flex items-center justify-center gap-1.5 py-3">
          {styles.map((style, index) => (
            <button
              key={style}
              onClick={() => go(index)}
              aria-label={i18n.t(`fanCard.style.${style}`)}
              aria-current={index === at}
              className={`h-1.5 transition-all ${index === at ? "w-5 bg-[#4F46E5]" : "w-1.5 bg-[#403864]"}`}
            />
          ))}
        </div>
      )}

      <p className="pb-3 text-center text-xs font-bold text-[#CFC9E6]">{label}</p>

      <button
        onClick={share}
        disabled={!!error}
        className="notched-sm w-full bg-[#4F46E5] py-3 text-sm font-bold text-white disabled:opacity-40"
      >
        {i18n.t("fanCard.share")}
      </button>
      <div className="mt-2 flex gap-2">
        <button
          onClick={copy}
          disabled={!!error}
          className="notched-sm flex-1 border border-[#3B3363] py-2.5 text-xs font-bold text-[#B7B0D6] hover:text-white disabled:opacity-40"
        >
          {i18n.t("fanCard.copy")}
        </button>
        <button
          onClick={save}
          disabled={!!error}
          className="notched-sm flex-1 border border-[#3B3363] py-2.5 text-xs font-bold text-[#B7B0D6] hover:text-white disabled:opacity-40"
        >
          {i18n.t("fanCard.save")}
        </button>
      </div>
      <p className="h-4 pt-2 text-center text-[11px] text-[#3ED598]">{said}</p>
    </div>
  </div>
);

export default ShareCardView;
