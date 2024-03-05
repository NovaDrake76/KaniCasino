
import React, { useState } from "react";
import Title from "../../components/Title";
import { Tooltip } from "react-tooltip";
import Items from "./Items";
import TopContent from "./TopContent";

interface selectedItems {
    identifier: string;
    item: {
        name: string;
        image: string;
        rarity: string;
    }
}

const Upgrade: React.FC = () => {
    const [selectedItems, setSelectedItems] = useState<selectedItems[]>([]);
    const [selectedTarget, setSelectedTarget] = useState<selectedItems | null>(null);
    const [selectedCase, setSelectedCase] = useState<string | null>(null);
    const [successRate, setSuccessRate] = useState<number>(0);
    const [toggleReload, setToggleReload] = useState<boolean>(false);
    const [finished, setFinished] = useState(false);
    const [spinning, setSpinning] = useState(false);

    return (
        <div className="w-screen flex justify-center z-10">
            <div className=" flex-col w-full max-w-[1920px]">
                <div className="w-full flex justify-center ml-1">
                    <Tooltip id="my-tooltip" style={{
                        width: "300px",
                        zIndex: 30,
                    }} />
                    <span
                        className="text-[#3a365a] underline -translate-x-1 cursor-help z-30"
                        data-tooltip-id="my-tooltip"
                        data-tooltip-content={
                            `Upgrade items from your inventory for a chance to get a more rare one. ` +
                            `The closer the rarity of your current item to the desired item, the higher the success rate. `
                        }
                    >
                        How it works?
                    </span>
                </div>

                <TopContent selectedItems={selectedItems} setSelectedItems={setSelectedItems} selectedTarget={selectedTarget}
                    setSelectedTarget={setSelectedTarget} successRate={successRate} finished={finished} setFinished={setFinished}
                    toggleReload={toggleReload} setToggleReload={setToggleReload} setSelectedCase={setSelectedCase}
                    spinning={spinning} setSpinning={setSpinning} />
                <div className="flex justify-center">
                    <Title title="Upgrade Items" />
                </div>

                <Items selectedItems={selectedItems} setSelectedItems={setSelectedItems}
                    selectedTarget={selectedTarget} setSelectedTarget={setSelectedTarget}
                    selectedCase={selectedCase} setSelectedCase={setSelectedCase}
                    setSuccessRate={setSuccessRate} toggleReload={toggleReload} setFinished={setFinished} spinning={spinning} />
            </div>
        </div>
    );
};

export default Upgrade;
