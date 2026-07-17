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


    // mirrors backend/games/upgrade.js exactly, so the rate on screen is the rate the
    // server rolls. the chance is the stake measured against the prize, which holds the
    // edge at 1 - UPGRADE_RTP however the rarities are mixed.
    const UPGRADE_RTP = 0.9;
    const MAX_UPGRADE_CHANCE = 0.95;

    const calculateSuccessRate = (items: any, target: any) => {
        const stakedValue = items.reduce(
            (sum: number, selected: any) => sum + (selected.item?.baseValue || 0),
            0
        );
        const targetValue = target?.baseValue || 0;
        if (stakedValue <= 0 || targetValue <= 0) return 0;
        return Math.min((UPGRADE_RTP * stakedValue) / targetValue, MAX_UPGRADE_CHANCE);
    };

    useEffect(() => {
        if (selectedTarget && selectedItems.length > 0) {
            setFinished(false)
            const rate = calculateSuccessRate(selectedItems, selectedTarget);
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