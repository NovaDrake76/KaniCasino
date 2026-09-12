import { FiArrowRight, FiSearch } from "react-icons/fi";
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
}

const GuessSearch = ({ term, setTerm, suggestions, pick, pickFirst, submitting }: Props) => (
  <div className="relative mx-auto mb-8 max-w-2xl">
    <div
      className={`relative flex items-center rounded-2xl bg-white transition-shadow duration-300 ${
        term ? "shadow-[0_10px_40px_rgba(10,139,250,0.3)]" : "shadow-lg hover:shadow-xl"
      }`}
    >
      <div className="pl-5 text-slate-400">
        {submitting ? (
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-transparent" />
        ) : (
          <FiSearch className="h-5 w-5" />
        )}
      </div>
      <input
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") pickFirst();
        }}
        disabled={submitting}
        placeholder={i18n.t("arcade.halo.search")}
        aria-label={i18n.t("arcade.halo.search")}
        className="w-full border-none bg-transparent p-5 font-semibold text-slate-700 outline-none placeholder:text-slate-400"
      />
    </div>

    {term.trim() && (
      <ul className="absolute left-0 right-0 top-full z-overlay m-0 mt-2 max-h-96 list-none overflow-hidden overflow-y-auto rounded-2xl bg-white p-0 shadow-2xl">
        {suggestions.length === 0 ? (
          <li className="p-8 text-center font-medium text-slate-400">{i18n.t("arcade.halo.noMatch")}</li>
        ) : (
          suggestions.map((s) => {
            const logo = academyLogo(s.academy);
            return (
              <li key={s.name} className="border-b border-slate-100 last:border-0">
                <button
                  type="button"
                  onClick={() => pick(s)}
                  className="group flex w-full items-center gap-4 border-none bg-transparent p-4 text-left transition-colors hover:border-none hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50"
                >
                  <StudentPortrait variant="square" src={s.studentImage} name={s.name} className="shadow-sm transition-shadow group-hover:shadow-md" />
                  <div className="flex-1">
                    <div className="mb-1 text-base font-bold text-slate-800">{s.name}</div>
                    <div className="flex flex-col items-start gap-2 md:flex-row md:items-center">
                      <span className="flex items-center gap-1.5 rounded-full bg-slate-100 px-2 py-0.5">
                        {logo && <img src={logo} alt="" className="h-4 w-4 object-contain" />}
                        <span className="text-xs font-bold uppercase text-slate-500">{s.academy}</span>
                      </span>
                      <span className="rounded bg-blue-500 px-2 py-0.5 text-xs font-bold text-white">{s.type}</span>
                    </div>
                  </div>
                  <FiArrowRight className="mr-2 text-lg text-blue-600 opacity-0 transition-opacity group-hover:opacity-100" />
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
