import { Link } from "react-router-dom";
import { FiArrowLeft } from "react-icons/fi";
import { GiGamepad } from "react-icons/gi";
import i18n from "../../../i18n";

interface Props {
  // the game's own name, when the page is one game rather than the arcade itself
  game?: string;
  children: React.ReactNode;
}

const ArcadeShell = ({ game, children }: Props) => (
  <div className="flex w-full justify-center px-4 pb-16 pt-6 md:px-8">
    <div className="flex w-full max-w-5xl flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#5CC8FF]/30 pb-3">
        <nav className="flex items-center gap-2 text-sm">
          <Link to="/arcade" className="flex items-center gap-2 font-bold text-[#5CC8FF] hover:text-[#8FDBFF]">
            <GiGamepad className="text-xl" /> {i18n.t("arcade.title")}
          </Link>
          {game && (
            <>
              <span className="text-ink-faint">/</span>
              <span className="font-semibold text-ink">{game}</span>
            </>
          )}
        </nav>
        <Link to="/" className="flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink-soft">
          <FiArrowLeft /> {i18n.t("arcade.backToCasino")}
        </Link>
      </div>
      {children}
    </div>
  </div>
);

export default ArcadeShell;
