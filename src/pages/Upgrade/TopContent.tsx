import MainButton from "../../components/MainButton";
import { AiOutlineClose } from "react-icons/ai";
import { GiUpgrade } from "react-icons/gi";
import ClockPointer from './ClockPointer';
import { useState } from "react";
import { toast } from "react-toastify";
import { upgradeItem } from "../../services/games/GamesServices";
import React from "react";

interface Props {
    selectedItems: any[];
    setSelectedItems: React.Dispatch<React.SetStateAction<any[]>>;
    setSelectedCase: React.Dispatch<React.SetStateAction<string | null>>;
    selectedTarget: any;
    setSelectedTarget: React.Dispatch<React.SetStateAction<any>>;
    successRate: number;
    finished: boolean;
    setFinished: React.Dispatch<React.SetStateAction<boolean>>;
    toggleReload: boolean;
    setToggleReload: React.Dispatch<React.SetStateAction<boolean>>;
    spinning: boolean;
    setSpinning: React.Dispatch<React.SetStateAction<boolean>>;
}

const TopContent: React.FC<Props> = ({ selectedItems, setSelectedItems, selectedTarget, setSelectedTarget, successRate, finished, setFinished, setToggleReload, toggleReload, setSelectedCase, spinning, setSpinning }) => {
    const [loadingUpgrade, setLoadingUpgrade] = useState<boolean>(false);
    const [stopAngle, setStopAngle] = useState(0);
    const [success, setSuccess] = useState(false);
    const [loadedImages, setLoadedImages] = useState<Record<number, boolean>>({});

    const handleImageLoaded = (index: number) => {
        setLoadedImages((prevLoadedImages) => ({
            ...prevLoadedImages,
            [index]: true,
        }));
    };

    // //play /upgrade.wav when spinning
    // const audio = new Audio("/upgrade.wav");

    // if (spinning) {
    //     audio.play();
    // } else {
    //     audio.pause();
    // }

    const UpgradeItems = async () => {
        setLoadingUpgrade(true)
        setFinished(false);
        setSuccess(false);

        const payload = {
            selectedItemIds: selectedItems.map(item => item.identifier),
            targetItemId: selectedTarget._id
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
            setLoadingUpgrade(false)

            setTimeout(() => {
                setSpinning(false);
                setSelectedItems([]);
                setToggleReload(!toggleReload);
                setSuccess(response.success)
                setFinished(true);
                setStopAngle(0);

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

    const renderPlaceholder = (i: number) => {
        return (
            <div className="flex flex-col items-center justify-center gap-2 text-center w-[333px] fadeIn">
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
            <div className="flex flex-wrap items-center justify-center gap-2 text-center w-[333px] h-[336px] ">
                {items.map((selectedItem, index) => (
                    <React.Fragment key={index}>
                        <img
                            src={selectedItem.item?.image ? selectedItem.item?.image : selectedItem.image}
                            alt="selected-item"
                            style={{ width: `${heightPercent}%`, display: loadedImages[index] ? 'block' : 'none' }}
                            className="object-contain"
                            onLoad={() => handleImageLoaded(index)}
                        />
                        {!loadedImages[index] && <div>Loading...</div>}
                    </React.Fragment>
                ))}
            </div>
        );
    }

    const renderCloseButton = (type: string, setSelectedTarget: any, setSelectedItems: any) => {
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

    return (
        <div className="flex flex-col md:flex-row items-center justify-around px-5  ">
            {
                selectedItems.length > 0 ? <div className="flex flex-col relative">
                    {renderSelectedItems(selectedItems)}
                    <MainButton text={`Clear Items ${selectedItems.length > 1 ? `(${selectedItems.length})` : ''}`} icon={<AiOutlineClose />} onClick={ClearItems} disabled={spinning} />
                    {
                        !spinning && renderCloseButton("selected", setSelectedTarget, setSelectedItems)
                    }
                </div> : renderPlaceholder(0)
            }
            <div className="flex flex-col justify-center items-center relative">
                <div className="absolute top-1/2 left-1/2 z-0" style={{
                    boxShadow: spinning ? "0 0 0 1000px rgba(0, 0, 0, 0.5)" : `0px 0px 500px 180px #1c133d`,
                    transition: "box-shadow 1.5s ease-in-out",
                }}></div>
                <div className="z-20">
                    <ClockPointer successRate={successRate} spinning={spinning} success={success} stopAngle={stopAngle} finished={finished} />
                </div>
            </div>
            {
                selectedTarget ? <div className="flex flex-col relative">
                    {renderSelectedItems([selectedTarget])}
                    <MainButton text="Upgrade" icon={<GiUpgrade />} type="danger" iconPosition="right" onClick={UpgradeItems}
                        disabled={loadingUpgrade || spinning || selectedItems.length < 1} loading={loadingUpgrade} />
                    {
                        !spinning && renderCloseButton("target", setSelectedTarget, setSelectedItems)
                    }
                </div> : renderPlaceholder(1)
            }
        </div>
    )

}

export default TopContent;