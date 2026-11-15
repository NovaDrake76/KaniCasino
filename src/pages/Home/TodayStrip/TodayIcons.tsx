import { useId } from "react";

// three draw balls in the palette of public/images/lottery.svg; the ids are per instance so two strips never share a gradient
export const BallsIcon = () => {
  const id = useId().replace(/:/g, "");
  return (
    <svg width="40" height="40" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id={`${id}-gold`} cx="0.35" cy="0.3" r="0.85">
          <stop offset="0" stopColor="#ffe680" />
          <stop offset="1" stopColor="#f2b705" />
        </radialGradient>
        <radialGradient id={`${id}-indigo`} cx="0.35" cy="0.3" r="0.85">
          <stop offset="0" stopColor="#8f8af2" />
          <stop offset="1" stopColor="#4f46e5" />
        </radialGradient>
        <radialGradient id={`${id}-pale`} cx="0.35" cy="0.3" r="0.85">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#c9c6de" />
        </radialGradient>
      </defs>
      <circle cx="14.5" cy="31.5" r="9" fill={`url(#${id}-indigo)`} />
      <circle cx="33.5" cy="31.5" r="9" fill={`url(#${id}-pale)`} />
      <circle cx="24" cy="18.5" r="11" fill={`url(#${id}-gold)`} />
      <circle cx="24" cy="18.5" r="5.6" fill="#ffffff" />
      <path d="M21.9 15.9h4.2l-2.6 5.9" fill="none" stroke="#1b1830" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

export const CupIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="text-accent-gold">
    <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 4h8v5a4 4 0 0 1-8 0z" />
      <path d="M8 6H5.2a2.9 2.9 0 0 0 2.9 3.8" />
      <path d="M16 6h2.8a2.9 2.9 0 0 1-2.9 3.8" />
      <path d="M12 13v3.5" />
      <path d="M8.5 20h7" />
      <path d="M9.8 16.5h4.4V20H9.8z" />
    </g>
  </svg>
);
