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
    };
    price: number;
    itemName: string;
    itemImage: string;
    __v: number;
}

export interface BasicItem {
    case: string;
    image: string;
    name: string;
    rarity: number;
    _id: string;
}

export interface Case {
    _id: string;
    title: string;
    price: number;
    image: string;
    items: BasicItem[];
}