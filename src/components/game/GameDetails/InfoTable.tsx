interface InfoTableProps {
  head: string[];
  rows: React.ReactNode[][];
  // columns that read as plain text; every other column after the first is a payout, in gold
  plain?: number[];
}

// the tables inside game info: same header and rows as the live bets table, scrolling sideways on a phone
const InfoTable = ({ head, rows, plain = [] }: InfoTableProps) => (
  <div className="w-full overflow-x-auto rounded-lg border border-line">
    <table className="min-w-full divide-y divide-line">
      <thead className="bg-surface-nav">
        <tr>
          {head.map((label, i) => (
            <th key={i} className="whitespace-nowrap px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-ink-muted">
              {label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-line">
        {rows.map((row, r) => (
          <tr key={r}>
            {row.map((cell, c) => (
              <td
                key={c}
                className={`whitespace-nowrap px-4 py-2 text-sm tabular-nums ${
                  c === 0 || plain.includes(c) ? "text-ink-soft" : "font-semibold text-accent-gold"
                }`}
              >
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export default InfoTable;
