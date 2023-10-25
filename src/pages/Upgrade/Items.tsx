import { useState, useContext, useEffect } from "react";
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
}

const Items: React.FC<Inventory> = ({ selectedItems, setSelectedItems, selectedTarget, setSelectedTarget, selectedCase, setSelectedCase, setSuccessRate, toggleReload }) => {
    const { userData } = useContext(UserContext);


    const baseChances: any = {
        "1": { "1": 0.5, "2": 0.2, "3": 0.1, "4": 0.05, "5": 0.002 },
        "2": { "1": 0.2, "2": 0.5, "3": 0.2, "4": 0.1, "5": 0.01 },
        "3": { "1": 0.1, "2": 0.2, "3": 0.5, "4": 0.2, "5": 0.05 },
        "4": { "1": 0.05, "2": 0.1, "3": 0.2, "4": 0.5, "5": 0.1 },
        "5": { "1": 0.002, "2": 0.01, "3": 0.05, "4": 0.1, "5": 0.5 }
    };

    const calculateSuccessRate = (selectedItems: any[], targetRarity: string) => {
        let totalChance = 0;

        for (const item of selectedItems) {
            const baseChance = baseChances[item.item.rarity][targetRarity];
            totalChance += baseChance;
        }

        // Apply diminishing returns
        totalChance = 1 - Math.pow(1 - totalChance, 1.25);

        // Cap the chance at 80%
        return Math.min(totalChance, 0.8);
    };


    useEffect(() => {
        if (selectedTarget && selectedItems.length > 0) {

            const rate = calculateSuccessRate(selectedItems, selectedTarget.rarity);
            setSuccessRate(rate);

        } else {
            setSuccessRate(0);
        }
    }, [selectedItems, selectedTarget]);

    if (userData) {
        return (
            <div className="flex items-center justify-around gap-4 px-14">
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