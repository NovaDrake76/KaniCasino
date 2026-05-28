import { useContext, useEffect } from "react";
import UserContext from "../../UserContext";
import UserItems from "./UserItems";
import ChooseUpgradeItems from "./ChooseUpgradeItems";

interface Inventory {
    selectedItems: any;
    setSelectedItems: React.Dispatch<React.SetStateAction<any>>;
    selectedTarget: any;
    setSelectedTarget: React.Dispatch<React.SetStateAction<any>>;
    selectedCase: string | null;
    setSelectedCase: React.Dispatch<React.SetStateAction<string | null>>;
    setSuccessRate: React.Dispatch<React.SetStateAction<number>>;
    toggleReload: boolean;
    setFinished: React.Dispatch<React.SetStateAction<boolean>>;
    spinning: boolean;
}

const Items: React.FC<Inventory> = ({ selectedItems, setSelectedItems, selectedTarget, setSelectedTarget, selectedCase, setSelectedCase, setSuccessRate, toggleReload, setFinished, spinning }) => {
    const { userData } = useContext(UserContext);


    const baseChances: any = {
        "1": { "1": 0.5, "2": 0.2, "3": 0.1, "4": 0.05, "5": 0.002 },
        "2": { "1": 0.2, "2": 0.5, "3": 0.2, "4": 0.1, "5": 0.01 },
        "3": { "1": 0.1, "2": 0.2, "3": 0.5, "4": 0.2, "5": 0.05 },
        "4": { "1": 0.05, "2": 0.1, "3": 0.2, "4": 0.5, "5": 0.1 },
        "5": { "1": 0.002, "2": 0.01, "3": 0.05, "4": 0.1, "5": 0.5 }
    };

    // mirrors the server formula exactly (sorted strongest-first, order-independent)
    // so the displayed rate matches the rate the server actually rolls
    const rarityFactors: any = { "4": 0.7, "5": 0.5 };
    const rarityCaps: any = { "1": 0.8, "2": 0.7, "3": 0.6, "4": 0.45, "5": 0.2 };
    const diminishingRate = 0.9;

    const calculateSuccessRate = (selectedItems: any, targetRarity: string) => {
        const rarityFactor = rarityFactors[targetRarity] || 1;

        const contributions = selectedItems
            .map((item: any) => {
                const baseChance = (baseChances[item.item.rarity] || {})[targetRarity] || 0;
                return baseChance * rarityFactor;
            })
            .sort((a: number, b: number) => b - a);

        let failChance = 1;
        contributions.forEach((chance: number, index: number) => {
            failChance *= 1 - chance * Math.pow(diminishingRate, index);
        });

        const successRate = 1 - failChance;
        const cap = rarityCaps[targetRarity] !== undefined ? rarityCaps[targetRarity] : 0.8;
        return Math.min(successRate, cap);
    };

    useEffect(() => {
        if (selectedTarget && selectedItems.length > 0) {
            setFinished(false)
            const rate = calculateSuccessRate(selectedItems, selectedTarget.rarity);
            setSuccessRate(rate);

        } else {
            setSuccessRate(0);
        }

    }, [selectedItems, selectedTarget]);

    if (userData) {
        return (
            <div className={`flex flex-col md:flex-row items-center justify-around gap-4 px-14 ${spinning && "pointer-events-none"}`} >
                <UserItems selectedItems={selectedItems} setSelectedItems={setSelectedItems} selectedCase={selectedCase} setSelectedCase={setSelectedCase} toggleReload={toggleReload} setSelectedTarget={setSelectedTarget} />
                <ChooseUpgradeItems setSelectedItems={setSelectedItems} selectedCase={selectedCase} setSelectedCase={setSelectedCase} selectedTarget={selectedTarget} setSelectedTarget={setSelectedTarget} />
            </div >
        )
    } else {
        return (
            <div className="w-full flex justify-center">Sign in to play</div>
        )
    }


}

export default Items;