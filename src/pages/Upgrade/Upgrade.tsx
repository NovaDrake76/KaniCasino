
import React, { useState } from "react";
import Title from "../../components/Title";
import { Tooltip } from "react-tooltip";
import Items from "./Items";
import MainButton from "../../components/MainButton";
import { AiOutlineClose } from "react-icons/ai";
import { GiUpgrade } from "react-icons/gi";
import { upgradeItem } from "../../services/games/GamesServices";
import { toast } from "react-toastify";

const Upgrade: React.FC = () => {
    const [selectedItems, setSelectedItems] = useState<any[]>([]);
    const [selectedTarget, setSelectedTarget] = useState<any>(null);
    const [selectedCase, setSelectedCase] = useState<string | null>(null);
    const [successRate, setSuccessRate] = useState<number>(0);
    const [success, setSuccess] = useState<boolean>(false);

    const itemPlaceholder = [
        {
            imgSrc: "/images/item1.webp",
            text: "Select an item that you want to upgrade"
        },
        {
            imgSrc: "/images/item2.webp",
            text: "Select an item that you want to obtain"
        }
    ];

    const renderPlaceholder = (i: any) => {
        return (
            <div className="flex flex-col items-center justify-center gap-2 text-center">
                <img
                    src={itemPlaceholder[i].imgSrc}
                    alt="upgrade"
                    className="object-contain h-[280px]"
                />
                <span className="text-[#3D3A4E] w-2/3 font-semibold">{itemPlaceholder[i].text}</span>
            </div>
        );
    }

    const renderSelectedItems = (items: any[]) => {
        const heightPercent = 80 / items.length;
        return (
            <div className="flex flex-wrap items-center justify-center gap-2 text-center w-[333px] h-[336px]">
                {items.map((selectedItems, index) => (
                    <img
                        key={index}
                        src={selectedItems.item?.image ? selectedItems.item?.image : selectedItems.image}
                        alt="selected-item"
                        style={{ width: `${heightPercent}%` }}
                        className="object-contain"
                    />
                ))}
            </div>
        );
    }

    const ClearItems = () => {
        setSelectedItems([]);
        setSelectedCase(null);

    }

    const UpgradeItems = async () => {
        const payload = {
            selectedItemIds: selectedItems.map(item => item.identifier),
            targetItemId: selectedTarget
        };

        try {
            const response = await upgradeItem(payload.selectedItemIds, payload.targetItemId);
            setSuccess(response.success)
            setSelectedItems([]);
            if (response.success) {
                setSelectedCase(null);
                setSelectedTarget(null);
            }

        } catch (err: any) {
            const errorMessage = err.response && err.response.data ? err.response.data.message : "An error occurred";
            toast.error(errorMessage, {
                theme: "dark",
            });
            console.log(err);
        }
    };



    return (
        <div className="w-screen flex justify-center">
            <div className=" flex-col w-full max-w-[1920px]">
                <div className="w-full flex justify-center">
                    <Tooltip id="my-tooltip" style={{
                        width: "300px",
                    }} />
                    <span
                        className="text-[#3a365a] underline -translate-x-1 cursor-help"
                        data-tooltip-id="my-tooltip"
                        data-tooltip-content={
                            `Upgrade items from your inventory for a chance to get a more rare one. ` +
                            `The closer the rarity of your current item to the desired item, the higher the success rate. `
                        }
                    >
                        How it works?
                    </span>
                </div>

                <div className="flex items-center justify-around px-5 h-[333px] ">
                    {
                        selectedItems.length > 0 ? <div className="flex flex-col relative">
                            {renderSelectedItems(selectedItems)}
                            <MainButton text="Clear Items" icon={<AiOutlineClose />} onClick={ClearItems}
                            />
                            <div className="absolute -right-10 top-10 p-4 bg-gray-400/10 hover:bg-gray-500/60 rounded-full cursor-pointer transition-all" onClick={
                                () => {
                                    setSelectedItems([]);
                                }}>
                                <AiOutlineClose />
                            </div>
                        </div> : renderPlaceholder(0)
                    }
                    <div className="w-[420px] flex justify-center h-[333px]">

                        Success Rate: {(successRate * 100).toFixed(2)}%

                    </div>
                    {
                        selectedTarget ? <div className="flex flex-col relative">
                            {renderSelectedItems([selectedTarget])}
                            <MainButton text="Upgrade" icon={<GiUpgrade />} type="danger" iconPosition="right" onClick={UpgradeItems}
                            />
                            <div className="absolute -left-10 top-10 p-4 bg-gray-400/10 hover:bg-gray-500/60 rounded-full cursor-pointer transition-all" onClick={
                                () => {
                                    setSelectedTarget(null);
                                }}>
                                <AiOutlineClose />
                            </div>
                        </div> : renderPlaceholder(1)
                    }
                </div>
                <div className="flex justify-center">
                    <Title title="Upgrade Items" />
                </div>
                <Items selectedItems={selectedItems} setSelectedItems={setSelectedItems}
                    selectedTarget={selectedTarget} setSelectedTarget={setSelectedTarget}
                    selectedCase={selectedCase} setSelectedCase={setSelectedCase} setSuccessRate={setSuccessRate} />
            </div>
        </div>
    );
};

export default Upgrade;
