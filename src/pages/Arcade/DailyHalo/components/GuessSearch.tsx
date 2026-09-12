import { FiSearch } from "react-icons/fi";
import type { HaloStudent } from "../../../../services/arcade/DailyHaloService";
import { academyLogo } from "../dailyHalo.logic";
import StudentPortrait from "./StudentPortrait";
import i18n from "../../../../i18n";

interface Props {
  term: string;
  setTerm: (term: string) => void;
  suggestions: HaloStudent[];
  pick: (student: HaloStudent) => void;
  pickFirst: () => void;
  submitting: boolean;
  guessesLeft: number;
}

const GuessSearch = ({ term, setTerm, suggestions, pick, pickFirst, submitting, guessesLeft }: Props) => (
  <div className="relative mx-auto w-full max-w-2xl">
    <div className="flex items-center gap-3 border border-line bg-surface px-4 focus-within:border-[#5CC8FF]">
      <FiSearch className="flex-shrink-0 text-ink-faint" />
      <input
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") pickFirst();
        }}
        disabled={submitting}
        placeholder={i18n.t("arcade.halo.search")}
        aria-label={i18n.t("arcade.halo.search")}
        className="h-12 min-w-0 flex-1 border-none bg-transparent text-ink outline-none placeholder:text-ink-faint"
      />
      <span className="whitespace-nowrap text-xs font-semibold text-ink-muted">
        {i18n.t("arcade.halo.guessesLeft", { count: guessesLeft })}
      </span>
    </div>
    {term.trim() && (
      <ul className="absolute left-0 right-0 top-full z-overlay m-0 mt-1 max-h-96 list-none overflow-y-auto bg-surface-nav p-0 shadow-2xl">
        {suggestions.length === 0 ? (
          <li className="px-4 py-3 text-sm text-ink-muted">{i18n.t("arcade.halo.noMatch")}</li>
        ) : (
          suggestions.map((s) => {
            const logo = academyLogo(s.academy);
            return (
              <li key={s.name}>
                <button
                  type="button"
                  onClick={() => pick(s)}
                  className="flex w-full items-center gap-3 border-none bg-transparent px-3 py-2 text-left hover:border-none hover:bg-surface-hover"
                >
                  <StudentPortrait face src={s.studentImage} name={s.name} className="h-12 w-12" />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-semibold text-ink">{s.name}</span>
                    <span className="flex items-center gap-1.5 text-xs text-ink-muted">
                      {logo && <img src={logo} alt="" className="h-4 w-4 object-contain" />}
                      {s.academy}, {s.type}
                    </span>
                  </span>
                </button>
              </li>
            );
          })
        )}
      </ul>
    )}
  </div>
);

export default GuessSearch;
