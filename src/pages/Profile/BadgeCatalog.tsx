import { useEffect, useState } from "react";
import Modal from "../../components/Modal";
import { BadgeFace, badgeName } from "../../components/Badge";
import {
  Badge as BadgeData,
  BadgeKey,
  CatalogBadge,
  getBadgeCatalog,
  isCollectionBadge,
} from "../../services/badges/BadgeService";
import i18n from "../../i18n";

interface BadgeCatalogProps {
  badges: BadgeData[];
  worn: BadgeKey | null;
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

// every badge that exists, so a player can see what is out there rather than only what
// they happen to hold. a locked one says what it would take.
const BadgeCatalog: React.FC<BadgeCatalogProps> = ({ badges, worn, open, setOpen }) => {
  const [all, setAll] = useState<CatalogBadge[]>([]);
  const held = new Map(badges.map((badge) => [badge.key, badge]));

  // the collection badges come from the live categories, so the list cannot be a constant
  useEffect(() => {
    if (!open || all.length) return;
    getBadgeCatalog()
      .then(setAll)
      .catch(() => setAll([]));
  }, [open, all.length]);

  return (
    <Modal open={open} setOpen={setOpen} width="min(520px, 95vw)">
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-bold">{i18n.t("badge.allTitle")}</h2>
          <p className="mt-1 text-xs text-[#84819A]">
            {i18n.t("badge.allCount", { held: held.size, total: all.length })}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          {all.map(({ key, label, size }) => {
            const owned = held.get(key);
            return (
              <div
                key={key}
                className={`notched-sm flex items-start gap-3 p-3 ${
                  owned ? "bg-[#212031]" : "bg-[#19172d]"
                }`}
              >
                <BadgeFace badgeKey={key} size="xl" muted={!owned} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`text-sm font-bold ${owned ? "text-white" : "text-[#625F7E]"}`}>
                      {badgeName(key, label)}
                    </span>
                    {worn === key && (
                      <span className="notched-xs bg-[#4F46E5] px-2 py-0.5 text-[9px] font-extrabold tracking-widest text-white">
                        {i18n.t("badge.wearing")}
                      </span>
                    )}
                    {!owned && (
                      <span className="text-[9px] font-extrabold tracking-widest text-[#625F7E]">
                        {i18n.t("badge.locked")}
                      </span>
                    )}
                  </div>
                  <p className={`mt-1 text-xs leading-relaxed ${owned ? "text-[#C9C6DE]" : "text-[#84819A]"}`}>
                    {isCollectionBadge(key)
                      ? i18n.t("badge.collectionHint", { category: label || "" })
                      : i18n.t(`badge.${key}Hint`)}
                  </p>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-[#625F7E]">
                    {isCollectionBadge(key)
                      ? i18n.t("badge.collectionHow", { category: label || "", count: size || 0 })
                      : i18n.t(`badge.${key}How`)}
                  </p>
                  {owned && owned.note && (
                    <p className="mt-1.5 text-[11px] italic text-[#84819A]">{owned.note}</p>
                  )}
                  {owned && owned.awardedAt && (
                    <p className="mt-1 text-[11px] text-[#625F7E]">
                      {i18n.t("badge.awarded", {
                        date: new Date(owned.awardedAt).toLocaleDateString(),
                      })}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Modal>
  );
};

export default BadgeCatalog;
