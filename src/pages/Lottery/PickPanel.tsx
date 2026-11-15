import { FiX } from "react-icons/fi";
import GameButton from "../../components/game/GameButton";
import VerifyBanner from "../../components/verify/VerifyBanner";
import { BallRow } from "./Ball";
import type { LotteryViewProps } from "./Lottery.types";
import i18n from "../../i18n";

type Panel = LotteryViewProps["panel"];

const SMALL =
  "min-h-[36px] rounded border-0 px-2 py-1.5 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-light disabled:opacity-40";

const ActionChip = ({ onClick, disabled, wide, children }: { onClick: () => void; disabled?: boolean; wide?: boolean; children: React.ReactNode }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={`${SMALL} bg-surface-raised text-ink enabled:hover:bg-surface-hover ${wide ? "col-span-2" : ""}`}
  >
    {children}
  </button>
);

const NumberGrid = ({ panel }: { panel: Panel }) => (
  <div data-testid="number-grid" className="grid grid-cols-5 gap-1.5">
    {panel.grid.map((cell) => (
      <button
        key={cell.n}
        type="button"
        aria-pressed={cell.picked}
        onClick={() => panel.toggle(cell.n)}
        className={`h-10 rounded border-0 p-0 text-sm font-bold tabular-nums transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-light short:h-9 ${
          cell.picked
            ? "bg-accent text-white hover:bg-accent"
            : cell.muted
              ? "bg-surface-nav text-ink-faint hover:bg-surface-nav"
              : "bg-surface-nav text-ink-soft hover:bg-surface-hover hover:text-white"
        }`}
      >
        {cell.n}
      </button>
    ))}
  </div>
);

const Slip = ({ panel }: { panel: Panel }) => (
  <div data-testid="slip" className="flex flex-col gap-2 rounded bg-surface-nav p-3">
    <div className="flex items-center justify-between">
      <span className="text-xs font-semibold text-ink-muted">{i18n.t("lottery.slip")}</span>
      {panel.clearSlip && (
        <button
          type="button"
          onClick={panel.clearSlip}
          className="rounded-none border-0 bg-transparent p-0 text-xs font-semibold text-ink-muted hover:text-ink focus:outline-none"
        >
          {i18n.t("lottery.clear")}
        </button>
      )}
    </div>
    {panel.slip.length === 0 ? (
      <p className="m-0 text-xs leading-relaxed text-ink-muted">{i18n.t("lottery.slipEmpty")}</p>
    ) : (
      <ul className="m-0 flex max-h-36 list-none flex-col gap-1.5 overflow-y-auto p-0 short:max-h-24">
        {panel.slip.map((row) => (
          <li key={row.key} data-testid="slip-row" className="flex items-center justify-between gap-2">
            <BallRow balls={row.numbers.map((n) => ({ n, tone: "plain" }))} size="sm" />
            <button
              type="button"
              onClick={row.remove}
              aria-label={i18n.t("lottery.remove")}
              className="flex h-7 w-7 items-center justify-center rounded border-0 bg-transparent p-0 text-ink-muted hover:bg-surface-hover hover:text-ink focus:outline-none"
            >
              <FiX />
            </button>
          </li>
        ))}
      </ul>
    )}
    {panel.total && (
      <div className="flex items-center justify-between border-t border-line pt-2 text-xs">
        <span className="text-ink-muted">{i18n.t("lottery.total")}</span>
        <span className="font-bold tabular-nums text-accent-gold">{panel.total}</span>
      </div>
    )}
  </div>
);

// the pick, the slip and the buy, built from the shared game controls
const PickPanel = ({ panel }: { panel: Panel }) => (
  <>
    <VerifyBanner feature="lottery" compact />
    <div className="flex items-center justify-between">
      <span className="text-xs font-semibold text-ink-muted">{i18n.t("lottery.pickTitle")}</span>
      <span data-testid="pick-hint" className="text-xs tabular-nums text-ink-muted">
        {panel.pickHint}
      </span>
    </div>
    <NumberGrid panel={panel} />
    <div className="grid grid-cols-2 gap-1.5">
      <ActionChip onClick={panel.fillPick}>{i18n.t("lottery.quickPick")}</ActionChip>
      <ActionChip onClick={panel.addPick} disabled={!panel.canAdd}>
        {i18n.t("lottery.addToSlip")}
      </ActionChip>
      {panel.quickMany.map((q) => (
        <ActionChip key={q.n} onClick={() => panel.addMany(q.n)} disabled={q.disabled}>
          {q.label}
        </ActionChip>
      ))}
      {panel.repeat && (
        <ActionChip onClick={panel.repeat.onClick} disabled={panel.repeat.disabled} wide>
          {panel.repeat.label}
        </ActionChip>
      )}
    </div>
    <Slip panel={panel} />
    {panel.held && (
      <p data-testid="held" className="m-0 text-xs text-ink-muted">
        {panel.held}
      </p>
    )}
    {panel.full && <p className="m-0 text-xs font-semibold text-accent-amber">{panel.full}</p>}
    <GameButton onClick={panel.action.onClick} disabled={panel.action.disabled}>
      {panel.action.label}
    </GameButton>
  </>
);

export default PickPanel;
