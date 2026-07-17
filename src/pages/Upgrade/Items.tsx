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
    // server rolls: p = RTP(targetRarity) * staked / target, capped by the rarity ceiling.
    const UPGRADE_RTP_BY_RARITY: { [k: string]: number } = { "1": 0.9, "2": 0.9, "3": 0.85, "4": 0.75, "5": 0.6 };
    const UPGRADE_CEILING: { [k: string]: number } = { "1": 0.9, "2": 0.7, "3": 0.45, "4": 0.25, "5": 0.12 };

    const calculateSuccessRate = (items: any, target: any) => {
        const stakedValue = items.reduce(
            (sum: number, selected: any) => sum + (selected.item?.baseValue || 0),
            0
        );
        const targetValue = target?.baseValue || 0;
        if (stakedValue <= 0 || targetValue <= 0) return 0;
        const rtp = UPGRADE_RTP_BY_RARITY[String(target?.rarity)] || 0.9;
        const ceiling = UPGRADE_CEILING[String(target?.rarity)] || 0.9;
        return Math.min((rtp * stakedValue) / targetValue, ceiling);
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