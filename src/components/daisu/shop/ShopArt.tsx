const GOLD = "#FFCC00";
const INK = "#C9C6DE";
const FILL = "#281D3F";

// one picture per item, drawn on a 40 unit grid so every tile size stays sharp
const ShopArt = ({ item, size }: { item: string; size: number }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden>
    {item === "collectionBook" && (
      <>
        <path d="M8 7h18a5 5 0 0 1 5 5v21H13a5 5 0 0 1-5-5z" fill={FILL} stroke={GOLD} strokeWidth="2.2" strokeLinejoin="round" />
        <path d="M8 28a5 5 0 0 1 5-5h18" stroke={GOLD} strokeWidth="2.2" />
        <path d="M15 12h10M15 17h7" stroke={INK} strokeWidth="2.2" strokeLinecap="round" />
      </>
    )}
    {item === "tradersLicense" && (
      <>
        <rect x="5" y="9" width="30" height="22" rx="2" fill={FILL} stroke={GOLD} strokeWidth="2.2" />
        <rect x="9" y="14" width="8" height="10" fill="#3A2C5C" stroke={INK} strokeWidth="1.6" />
        <path d="M21 15h10M21 20h7M21 25h9" stroke={INK} strokeWidth="2" strokeLinecap="round" />
      </>
    )}
    {item === "upgradeKit" && (
      <>
        <path d="M20 4l13 7.5v17L20 36 7 28.5v-17z" fill={FILL} stroke={GOLD} strokeWidth="2.2" strokeLinejoin="round" />
        <path d="M20 27V14M14 19l6-6 6 6" stroke={INK} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </>
    )}
    {item === "chatPass" && (
      <>
        <path d="M6 9h28v18H18l-7 6v-6H6z" fill={FILL} stroke={GOLD} strokeWidth="2.2" strokeLinejoin="round" />
        <path d="M12 16h16M12 21h10" stroke={INK} strokeWidth="2.2" strokeLinecap="round" />
      </>
    )}
    {item === "predictionPass" && (
      <>
        <circle cx="20" cy="20" r="15" fill={FILL} stroke={GOLD} strokeWidth="2.2" />
        <path d="M11 25l6-6 4 4 8-9" stroke={INK} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </>
    )}
  </svg>
);

export default ShopArt;
