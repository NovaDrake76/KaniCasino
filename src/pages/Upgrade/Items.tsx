import { useState, useContext } from "react";
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
}

const Items: React.FC<Inventory> = ({ selectedItems, setSelectedItems, selectedTarget, setSelectedTarget, selectedCase, setSelectedCase }) => {
    const { userData } = useContext(UserContext);

    if (userData) {
        return (
            <div className="flex items-center justify-around gap-4 px-14">
                <UserItems selectedItems={selectedItems} setSelectedItems={setSelectedItems} selectedCase={selectedCase} setSelectedCase={setSelectedCase} />
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