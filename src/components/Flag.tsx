// flags drawn inline rather than pulled from an icon pack: at 20px wide the detail is
// invisible anyway, and this keeps the selector free of a dependency and of network calls
const flags: Record<string, JSX.Element> = {
  en: (
    <>
      <rect width="24" height="16" fill="#012169" />
      <path d="M0 0l24 16M24 0L0 16" stroke="#fff" strokeWidth="3" />
      <path d="M0 0l24 16M24 0L0 16" stroke="#C8102E" strokeWidth="1.6" />
      <path d="M12 0v16M0 8h24" stroke="#fff" strokeWidth="5" />
      <path d="M12 0v16M0 8h24" stroke="#C8102E" strokeWidth="3" />
    </>
  ),
  zh: (
    <>
      <rect width="24" height="16" fill="#DE2910" />
      <path d="M4 2.6l.9 2.7-2.3-1.7h2.8L3.1 5.3z" fill="#FFDE00" />
      <circle cx="8.4" cy="2" r="0.9" fill="#FFDE00" />
      <circle cx="10.2" cy="4" r="0.9" fill="#FFDE00" />
      <circle cx="10.2" cy="6.6" r="0.9" fill="#FFDE00" />
      <circle cx="8.4" cy="8.6" r="0.9" fill="#FFDE00" />
    </>
  ),
  ja: (
    <>
      <rect width="24" height="16" fill="#fff" />
      <circle cx="12" cy="8" r="4.6" fill="#BC002D" />
    </>
  ),
  ko: (
    <>
      <rect width="24" height="16" fill="#fff" />
      <path d="M12 3.6a4.4 4.4 0 010 8.8 2.2 2.2 0 000-4.4 2.2 2.2 0 010-4.4z" fill="#CD2E3A" />
      <path d="M12 3.6a2.2 2.2 0 010 4.4 2.2 2.2 0 000 4.4 4.4 4.4 0 010-8.8z" fill="#0047A0" />
      <g stroke="#000" strokeWidth="0.8">
        <path d="M3 4.2h3M3 5.8h3M3 7.4h3" />
        <path d="M18 8.6h3M18 10.2h3M18 11.8h3" />
      </g>
    </>
  ),
  es: (
    <>
      <rect width="24" height="16" fill="#AA151B" />
      <rect y="4" width="24" height="8" fill="#F1BF00" />
    </>
  ),
  pt: (
    <>
      <rect width="24" height="16" fill="#009B3A" />
      <path d="M12 2l9.5 6-9.5 6L2.5 8z" fill="#FEDF00" />
      <circle cx="12" cy="8" r="3.4" fill="#002776" />
      <path d="M8.9 6.8c2.2-.7 4.5-.3 6.2.9" stroke="#fff" strokeWidth="0.9" fill="none" />
    </>
  ),
  fr: (
    <>
      <rect width="24" height="16" fill="#fff" />
      <rect width="8" height="16" fill="#002395" />
      <rect x="16" width="8" height="16" fill="#ED2939" />
    </>
  ),
  de: (
    <>
      <rect width="24" height="16" fill="#000" />
      <rect y="5.33" width="24" height="5.34" fill="#DD0000" />
      <rect y="10.67" width="24" height="5.33" fill="#FFCE00" />
    </>
  ),
  it: (
    <>
      <rect width="24" height="16" fill="#fff" />
      <rect width="8" height="16" fill="#008C45" />
      <rect x="16" width="8" height="16" fill="#CD212A" />
    </>
  ),
  vi: (
    <>
      <rect width="24" height="16" fill="#DA251D" />
      <path d="M12 3.8l1.4 4.3-3.7-2.7h4.6l-3.7 2.7z" fill="#FFFF00" />
    </>
  ),
};

interface FlagProps {
  code: string;
  className?: string;
}

const Flag: React.FC<FlagProps> = ({ code, className = "h-3.5 w-5" }) => (
  <svg viewBox="0 0 24 16" className={`shrink-0 ${className}`} aria-hidden="true">
    <clipPath id={`flag-${code}`}>
      <rect width="24" height="16" />
    </clipPath>
    <g clipPath={`url(#flag-${code})`}>{flags[code] || flags.en}</g>
  </svg>
);

export default Flag;
