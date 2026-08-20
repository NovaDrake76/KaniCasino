import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Avatar from "./Avatar";
import { User } from "../components/Types";
import FanBadge from "./FanBadge";
import { rarityColor } from "../utils/rarity";
import i18n from "../i18n";

interface Player {
    player: User
}

const CARD_W = 470;
const GAP = 12;
// below this the card would run off the top of the window, so it flips under the row
const FLIP_AT = 220;

const PlayerPreview: React.FC<Player> = ({ player }) => {
    const anchor = useRef<HTMLSpanElement | null>(null);
    const [at, setAt] = useState<{ left: number; top?: number; bottom?: number } | null>(null);

    // the card is portalled to the body because each podium column and each live-bet row
    // is its own stacking context: a neighbour's avatar painted over the card whatever
    // z-index it carried inside one
    useLayoutEffect(() => {
        // the span itself is 0x0, so the card is placed against the nearest ancestor that
        // has a real box: the podium column, or the live-bet row
        let host: HTMLElement | null = anchor.current?.parentElement || null;
        while (host && host.getBoundingClientRect().width === 0) host = host.parentElement;
        const box = host?.getBoundingClientRect();
        if (!box) return;
        const left = Math.min(
            Math.max(8, box.left + box.width / 2 - CARD_W / 2),
            window.innerWidth - CARD_W - 8
        );
        setAt(
            box.top < FLIP_AT
                ? { left, top: box.bottom + GAP }
                : { left, bottom: window.innerHeight - box.top + GAP }
        );
    }, []);

    const color = rarityColor(player.fixedItem?.rarity || "");

    // clip-path cuts straight through a css border and leaves the four chamfer tips
    // uncoloured, so the rarity colour is an outer layer with the card 2px inside it
    const card = (
        <div
            style={{ ...at, width: CARD_W, backgroundColor: player.fixedItem ? color : "#3A365A" }}
            className="notched pointer-events-none fixed z-[140] p-[2px]"
        >
            <div className="notched flex items-stretch justify-between overflow-hidden bg-[#281D3F]">
                <div className="flex items-center gap-2 p-6">
                    <div className="min-w-[96px]">
                        <Avatar image={player.profilePicture} id={player._id} size="large" level={player.level} noLink />
                    </div>
                    <div className="flex flex-col items-start">
                        <span className="flex items-center gap-1.5 font-bold text-lg max-w-[200px]">
                            <FanBadge fanRank={player.fanRank} linked={false} hoverCard={false} />
                            <span className="truncate text-white">{player.username}</span>
                        </span>
                        <span className="font-bold text-[#56528b] ">Level {player.level}</span>
                        {player.fanRank && (
                            <span className="whitespace-nowrap text-xs text-[#84819A]">
                                {i18n.t("fandom.standingLine", {
                                    rank: player.fanRank.rank,
                                    name: player.fanRank.name,
                                    count: player.fanRank.count,
                                })}
                            </span>
                        )}
                    </div>
                </div>
                {player.fixedItem && (
                    <div className="relative flex w-[160px] shrink-0 flex-col items-center justify-center px-2 py-4">
                        <div
                            className="absolute left-1/2 top-1/2"
                            style={{ width: 1, height: 1, boxShadow: `0 0 60px 34px ${color}` }}
                        />
                        <img
                            src={player.fixedItem.image}
                            alt={player.fixedItem.name}
                            className="relative z-10 h-24 w-24 object-contain"
                        />
                        <span
                            className="relative z-10 w-full pt-2 text-center text-base font-semibold leading-tight"
                            style={{ textShadow: '1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000' }}
                        >
                            {player.fixedItem.name}
                        </span>
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <>
            <span ref={anchor} className="block h-0 w-0" />
            {at && createPortal(card, document.body)}
        </>
    );
}

export default PlayerPreview;
