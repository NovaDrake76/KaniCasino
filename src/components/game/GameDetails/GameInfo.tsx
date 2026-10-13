import { Link } from "react-router-dom";
import { FiShield } from "react-icons/fi";
import { gameInfo, GameKey, InfoContext } from "./content";
import i18n from "../../../i18n";

const H = "text-sm font-bold text-ink";
const P = "text-sm leading-relaxed text-ink-soft";

// what the game is, how to play it, what it pays and how to check it: the stake.com style description under a game
const GameInfo = ({ game, ctx }: { game: GameKey; ctx?: InfoContext }) => {
  const info = gameInfo(game, ctx);

  return (
    <article className="w-full rounded-lg border border-line bg-surface" data-testid="game-info">
      <header className="flex flex-col gap-3 border-b border-line p-5 sm:p-6">
        <h2 className="text-lg font-bold">{info.name}</h2>
        <p className={P}>{info.summary}</p>
        {info.chips.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {info.chips.map((chip) => (
              <span key={chip} className="rounded-full bg-surface-raised px-3 py-1 text-xs font-semibold text-ink-soft">
                {chip}
              </span>
            ))}
          </div>
        )}
      </header>

      <div className="grid grid-cols-1 gap-8 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="flex min-w-0 flex-col gap-7">
          {info.sections.map((section) => (
            <section key={section.title} className="flex flex-col gap-3">
              <h3 className={H}>{section.title}</h3>
              {section.steps && (
                <ol className="flex flex-col gap-2.5">
                  {section.steps.map((step, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-white">
                        {i + 1}
                      </span>
                      <span className={P}>{step}</span>
                    </li>
                  ))}
                </ol>
              )}
              {section.paragraphs?.map((text, i) => (
                <p key={i} className={P}>
                  {text}
                </p>
              ))}
              {section.node}
              {section.bullets && (
                <ul className="flex flex-col gap-2">
                  {section.bullets.map((text, i) => (
                    <li key={i} className={`flex gap-3 ${P}`}>
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 bg-accent-light" />
                      <span>{text}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>

        <aside className="flex flex-col gap-4">
          <dl className="flex flex-col divide-y divide-line rounded-lg border border-line bg-surface-nav">
            {info.facts.map((fact) => (
              <div key={fact.label} className="flex items-center justify-between gap-4 px-4 py-3">
                <dt className="text-xs font-medium uppercase tracking-wider text-ink-muted">{fact.label}</dt>
                <dd className={`text-right text-sm font-bold tabular-nums ${fact.gold ? "text-accent-gold" : "text-ink"}`}>
                  {fact.value}
                </dd>
              </div>
            ))}
          </dl>
          <div className="flex flex-col gap-2 rounded-lg border border-line bg-surface-nav p-4">
            <span className="flex items-center gap-2 text-sm font-bold">
              <FiShield className="text-emerald-400" />
              {i18n.t("gameInfo.fairTitle")}
            </span>
            <p className="text-[13px] leading-relaxed text-ink-soft">{info.fairness}</p>
            {info.verifiable && (
              <Link to="/provably-fair" className="text-[13px] font-semibold text-secondary-light hover:text-white">
                {i18n.t("gameInfo.verifyLink")}
              </Link>
            )}
          </div>
        </aside>
      </div>
    </article>
  );
};

export default GameInfo;
