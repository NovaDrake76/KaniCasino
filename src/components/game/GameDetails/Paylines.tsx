import i18n from "../../../i18n";

const LINES: { name: string; cells: number[] }[] = [
  { name: "top", cells: [0, 1, 2] },
  { name: "middle", cells: [3, 4, 5] },
  { name: "bottom", cells: [6, 7, 8] },
  { name: "diagonal", cells: [0, 4, 8] },
  { name: "diagonal", cells: [2, 4, 6] },
];

// the five ways a slots spin can pay, drawn on the machine's 3x3 grid
const Paylines = () => (
  <div className="flex flex-wrap gap-4" data-testid="paylines">
    {LINES.map((line, i) => (
      <div key={i} className="flex flex-col items-center gap-1.5">
        <div className="grid w-[54px] grid-cols-3 gap-[3px]">
          {Array.from({ length: 9 }, (_, cell) => (
            <span key={cell} className={`h-4 ${line.cells.includes(cell) ? "bg-accent" : "bg-line"}`} />
          ))}
        </div>
        <span className="text-[11px] text-ink-muted">{i18n.t(`gameInfo.lines.${line.name}`)}</span>
      </div>
    ))}
  </div>
);

export default Paylines;
