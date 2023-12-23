export interface User {
    _id: string;
    level: number;
    profilePicture: string;
    username: string;
    weeklyWinnings: number;
    fixedItem: {
        image: string;
        name: string;
        description: string;
        rarity: string;
    }

}