import i18n from "../../../i18n";

// her words for a mission, resolved per render for the language; the game is whichever one her
// bonus is on right now
export const missionWords = (key: string, target: number, game: string) => {
  const vars = { target: target.toLocaleString("en-US"), game };
  return {
    title: i18n.t(`daisu.roadmap.missions.${key}.title`, vars),
    desc: i18n.t(`daisu.roadmap.missions.${key}.desc`, vars),
    help: i18n.t(`daisu.roadmap.missions.${key}.help`, vars),
  };
};

export const chapterName = (n: number) => `${i18n.t("daisu.roadmap.chapter", { n })} · ${i18n.t(`daisu.roadmap.chapters.${n}`)}`;
