
import React, { useState } from "react";
import Title from "../../components/Title";
import { Tooltip } from "react-tooltip";
import Items from "./Items";
import MainButton from "../../components/MainButton";
import { AiOutlineClose } from "react-icons/ai";
import { GiUpgrade } from "react-icons/gi";
import { upgradeItem } from "../../services/games/GamesServices";
import { toast } from "react-toastify";
import ClockPointer from './ClockPointer';

const Upgrade: React.FC = () => {
    const [selectedItems, setSelectedItems] = useState<any[]>([]);
    const [selectedTarget, setSelectedTarget] = useState<any>(null);
    const [selectedCase, setSelectedCase] = useState<string | null>(null);
    const [successRate, setSuccessRate] = useState<number>(0);
    const [success, setSuccess] = useState<boolean>(false);
    const [loadingUpgrade, setLoadingUpgrade] = useState<boolean>(false);
    const [toggleReload, setToggleReload] = useState<boolean>(false);
    const [spinning, setSpinning] = useState(false);
    const [stopAngle, setStopAngle] = useState(0);
    const [finished, setFinished] = useState(false);


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

    const renderCloseButton = (type: string) => {
        return (
            <div className={`absolute ${type === "target" ? "-left-10" : "-right-10"} top-10 p-4 bg-gray-400/10 hover:bg-gray-500/60 rounded-full cursor-pointer transition-all`}
                onClick={
                    () => {
                        if (type === "target") {
                            setSelectedTarget(null);
                        } else {
                            setSelectedItems([]);
                        }
                    }}>
                <AiOutlineClose />
            </div>
        )
    }

    const ClearItems = () => {
        setSelectedItems([]);
    }

    const UpgradeItems = async () => {
        setLoadingUpgrade(true)
        setFinished(false);
        setSuccess(false);

        const payload = {
            selectedItemIds: selectedItems.map(item => item.identifier),
            targetItemId: selectedTarget
        };
        try {
            const response = await upgradeItem(payload.selectedItemIds, payload.targetItemId);
            setSpinning(true);
            if (response.success) {
                // stop anywhere in the success chance area
                setStopAngle(Math.random() * (successRate * 360))
            } else {
                setStopAngle(successRate * 360 + Math.random() * ((1 - successRate) * 360))
            }
            setTimeout(() => {
                setLoadingUpgrade(false)
                setSpinning(false);
                setSelectedItems([]);
                setToggleReload(!toggleReload);
                setSuccess(response.success)
                setFinished(true);

                if (response.success) {
                    setSelectedCase(null);
                    setSelectedTarget(null);
                }
            }, 8000);

        } catch (err: any) {
            const errorMessage = err.response && err.response.data ? err.response.data.message : "An error occurred";
            toast.error(errorMessage, {
                theme: "dark",
            });
            setLoadingUpgrade(false)
            setSpinning(false);
            console.log(err);
        }
    };

    return (
        <div className="w-screen flex justify-center">
            <div className=" flex-col w-full max-w-[1920px]">
                <div className="w-full flex justify-center ml-1">
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

                <div className="flex flex-col md:flex-row items-center justify-around px-5  ">
                    {
                        selectedItems.length > 0 ? <div className="flex flex-col relative">
                            {renderSelectedItems(selectedItems)}
                            <MainButton text="Clear Items" icon={<AiOutlineClose />} onClick={ClearItems}
                            />
                            {
                                !spinning && renderCloseButton("selected")
                            }
                        </div> : renderPlaceholder(0)
                    }
                    <div className="flex flex-col justify-center items-center relative">
                        <div className="absolute top-1/2 left-1/2 z-10" style={{
                            boxShadow: `0px 0px 500px 200px #1c133d`,
                        }}></div>
                        <div className="z-20">
                            <ClockPointer successRate={successRate} spinning={spinning} success={success} stopAngle={stopAngle} finished={finished} />
                        </div>
                    </div>
                    {
                        selectedTarget ? <div className="flex flex-col relative">
                            {renderSelectedItems([selectedTarget])}
                            <MainButton text="Upgrade" icon={<GiUpgrade />} type="danger" iconPosition="right" onClick={UpgradeItems}
                                disabled={loadingUpgrade || selectedItems.length < 1} />
                            {
                                !spinning && renderCloseButton("target")
                            }
                        </div> : renderPlaceholder(1)
                    }
                </div>
                <div className="flex justify-center">
                    <Title title="Upgrade Items" />
                </div>
                <Items selectedItems={selectedItems} setSelectedItems={setSelectedItems}
                    selectedTarget={selectedTarget} setSelectedTarget={setSelectedTarget}
                    selectedCase={selectedCase} setSelectedCase={setSelectedCase}
                    setSuccessRate={setSuccessRate} toggleReload={toggleReload} setFinished={setFinished} />
            </div>
        </div>
    );
};

export default Upgrade;
