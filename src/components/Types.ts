export interface User {
    _id: string;
    level: number;
    profilePicture: string;
    username: string;
    weeklyWinnings: number;
    xp: number;
    nextBonus: number;
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