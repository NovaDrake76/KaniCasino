import GameLayout from "../../components/game/GameLayout";
import GameButton from "../../components/game/GameButton";
import OptionRow from "../../components/game/OptionRow";
import GameBar from "../../components/game/GameBar";
import LiveStatsButton from "../../components/LiveStats/LiveStatsButton";
import { BonusBetHint, GameBonusStrip } from "../../components/daisu/GameBonus";
import BigWinAlert from "../Slot/BigWinAlert";
import TicketPanel from "./TicketPanel";
import ProgressPanel from "./ProgressPanel";
import ScratchStage from "./ScratchStage";
import { ScratchViewProps } from "./Scratch.types";
import i18n from "../../i18n";

const ScratchView: React.FC<ScratchViewProps> = ({
  stageRef,
  panel,
  quantities,
  quantity,
  chooseQuantity,
  quantityRow,
  canChoose,
  total,
  action,
  showRevealStack,
  holdRevealStack,
  revealStack,
  stage,
  bigWin,
}) => (
  <div className="relative w-full overflow-x-clip">
    {bigWin !== null && <BigWinAlert value={bigWin} delayMs={0} />}
    <GameLayout
      game="scratch"
      bar={
        <GameBar>
          <LiveStatsButton />
        </GameBar>
      }
      title={i18n.t("scratch.scratch")}
      panel={
        <>
          <GameBonusStrip game="scratch" />

          {panel.kind === "details" ? <TicketPanel details={panel.details} reserve={panel.reserve} /> : <ProgressPanel progress={panel.progress} />}

          {quantityRow && (
            <div className={quantityRow === "held" ? "invisible" : undefined} aria-hidden={quantityRow === "held" || undefined}>
              <OptionRow label={i18n.t("scratch.tickets")} options={quantities} value={quantity} onChange={chooseQuantity} disabled={!canChoose} />
            </div>
          )}

          <BonusBetHint game="scratch" bet={total} />

          <GameButton onClick={action.onClick} disabled={action.disabled} tour="play-button">
            {action.label}
          </GameButton>

          {(showRevealStack || holdRevealStack) && (
            <div aria-hidden={holdRevealStack || undefined} className={holdRevealStack ? "invisible" : undefined}>
              <GameButton onClick={revealStack} variant="secondary" disabled={holdRevealStack}>
                {i18n.t("scratch.revealStack")}
              </GameButton>
            </div>
          )}
        </>
      }
    >
      <div ref={stageRef} className="flex w-full scroll-mt-4 justify-center">
        <ScratchStage stage={stage} />
      </div>
    </GameLayout>
  </div>
);

export default ScratchView;
