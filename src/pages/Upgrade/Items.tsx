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

    const calculateSuccessRate = (selectedItems: any, targetRarity: string) => {
        let totalChance = 1;
        let diminishingFactor = 1;  // Initialize a diminishing factor
        let rarityFactor = 1;  // Initialize a rarity factor

        const diminishingRate = 0.9; // 90% effectiveness for each subsequent item

        // Apply a rarity factor to make it harder to get higher rarities
        if (targetRarity == "4") {
            rarityFactor = 0.7;
        } else if (targetRarity == "5") {
            rarityFactor = 0.5;
        }

        for (const item of selectedItems) {
            const baseChance = baseChances[item.item.rarity][targetRarity];

            // Apply rarity factor conditionally
            if (parseInt((targetRarity), 10) >= 3 && selectedItems.length > 1) {
                totalChance *= (1 - (baseChance * diminishingFactor * rarityFactor));
                rarityFactor = rarityFactor / 1.11;
            } else {
                totalChance *= (1 - (baseChance * diminishingFactor));
            }

            diminishingFactor *= diminishingRate;  // Reduce the effectiveness for the next item
        }

        // Apply diminishing returns
        totalChance = 1 - totalChance;


        // Cap the chance by rarity
        if (targetRarity == "2") {
            return Math.min(totalChance, 0.7);
        }
        else if (targetRarity == "3") {
            return Math.min(totalChance, 0.6);

        }
        else if (targetRarity == "4") {
            return Math.min(totalChance, 0.45);

        }
        else if (targetRarity == "5") {
            return Math.min(totalChance, 0.2);
        } else {
            return 0.8;
        }
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