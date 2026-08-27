import { useContext, useEffect } from "react";
import UserContext from "../../UserContext";
import UserItems from "./UserItems";
import ChooseUpgradeItems from "./ChooseUpgradeItems";
import { calculateSuccessRate } from "./upgradeRules";
import i18n from "../../i18n";

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

    useEffect(() => {
        if (selectedTarget && selectedItems.length > 0) {
            setFinished(false)
            setSuccessRate(calculateSuccessRate(selectedItems, selectedTarget));
        } else {
            setSuccessRate(0);
        }

    }, [selectedItems, selectedTarget]);

    if (userData) {
        return (
            <div className={`flex flex-col md:flex-row items-center justify-around gap-4 px-14 ${spinning && "pointer-events-none"}`} >
                <UserItems selectedItems={selectedItems} setSelectedItems={setSelectedItems} selectedCase={selectedCase} setSelectedCase={setSelectedCase} toggleReload={toggleReload} selectedTarget={selectedTarget} setSelectedTarget={setSelectedTarget} />
                <ChooseUpgradeItems setSelectedItems={setSelectedItems} selectedItems={selectedItems} selectedCase={selectedCase} setSelectedCase={setSelectedCase} selectedTarget={selectedTarget} setSelectedTarget={setSelectedTarget} />
            </div >
        )
    } else {
        return (
            <div className="w-full flex justify-center">{i18n.t("upgrade.signInToPlay")}</div>
        )
    }


}

export default Items;
