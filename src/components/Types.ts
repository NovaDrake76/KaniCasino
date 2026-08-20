import { FanRank } from "../services/fandom/FandomService";
import { Badge, BadgeKey } from "../services/badges/BadgeService";

export interface User {
    id: string;
    _id: string;
    level: number;
    profilePicture: string;
    username: string;
    weeklyWinnings: number;
    xp: number;
    nextBonus: string;
    walletBalance: number;
    hasUnreadNotifications: boolean;
    fixedItem: {
        image: string;
        name: string;
        description: string;
        rarity: string;
    }
    fanRank?: FanRank;
    badge?: Badge | null;
    badges?: Badge[];
    selectedBadge?: BadgeKey | null;
    collectionRank?: {
        distinct: number;
        total: number;
        rank: number;
    };

}

export interface IMarketItem {
    _id: string;
    sellerId: {
        _id: string;
        username: string;
    }
    item: {
        _id: string;
        name: string;
        image: string;
        uniqueId: string
    };
    price: number;
    itemName: string;
    itemImage: string;
    __v: number;
    uniqueId: string;
}

export interface BasicItem {
    case: string;
    image: string;
    name: string;
    rarity: number;
    _id: string;
    uniqueId: string;
    baseValue?: number;
    sellValue?: number;
    rollId?: string;
}

export interface Case {
    _id: string;
    title: string;
    price: number;
    image: string;
    items: BasicItem[];
}