import i18n from "../../i18n";
// the indicator beside the daily gift link. it pings only while a spin is unclaimed.
const GiftTag = () => (
  <span className="relative -ml-1 self-start inline-flex items-center">
    <span className="absolute inset-0 animate-ping rounded bg-accent-gold opacity-75" />
    <span className="relative rounded bg-accent-gold px-1 py-px text-[8px] font-extrabold leading-none tracking-[0.08em] text-[#2a2100]">
      {i18n.t("nav.free")}
    </span>
  </span>
);

export default GiftTag;
