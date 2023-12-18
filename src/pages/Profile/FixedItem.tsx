import Rarities from "../../components/Rarities";
import { RiDoubleQuotesL } from "react-icons/ri";
import { putFixDescription } from "../../services/users/UserServices";
import { useState } from "react";
import { BiEditAlt } from "react-icons/bi";


interface IfixedItem {
    fixedItem: any;
    isSameUser: boolean;
    setRefresh?: React.Dispatch<React.SetStateAction<boolean>>;
}

const FixItem: React.FC<IfixedItem> = ({ fixedItem, isSameUser, setRefresh }) => {
    const [description, setDescription] = useState<string>(
        fixedItem ? fixedItem.description : ""
    );
    const [isEditing, setIsEditing] = useState<boolean>(false);
    const [isHovering, setIsHovering] = useState<boolean>(false);

    const updateFixDescription = async (description: string) => {
        try {
            await putFixDescription(description);
            setRefresh && setRefresh((prev) => !prev);

        } catch (error) {
            console.log(error);
        }
    };

    const TextArea = () => {
        return (
            <div className="flex flex-col items-center justify-center">
                <textarea
                    className="w-36 h-16 rounded-lg bg-white p-2 text-black resize-none "
                    maxLength={50}
                    value={description}
                    onChange={(e) => {
                        setDescription(e.target.value);
                    }}
                />
                <button
                    className="bg-blue-500 rounded-lg px-4 py-2 mt-2"
                    onClick={() => {
                        updateFixDescription(description);
                        setIsEditing(false);
                    }}
                >
                    Save
                </button>
            </div>
        );
    };

    return (
        <div
            className="flex p-4 rounded  border-gray-800 min-w-[350px] h-44 notched"
            style={{
                backgroundImage: `linear-gradient(270deg, ${Rarities.find((rarity) => rarity.id == fixedItem.rarity)?.color
                    } 20%, rgba(0,0,0,0) 100%)`,
            }}
        >
            <div className="flex items-center justify-between px-4 w-full">
                <div>
                    {fixedItem.description ? (
                        <div className="flex items-center justify-center">
                            <RiDoubleQuotesL className="text-2xl text-[#dddcfc]" />
                            {isEditing ? (
                                TextArea()
                            ) : (
                                <div
                                    className="max-w-[160px] overflow-auto flex items-center transition-all"
                                    onMouseEnter={() => {
                                        setIsHovering(true);
                                    }}
                                    onMouseLeave={() => {
                                        setIsHovering(false);
                                    }}
                                >
                                    <span
                                        className="text-center  overflow-auto max-w-[140px]"
                                        style={{ textShadow: '1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000' }}
                                    >
                                        {fixedItem.description ? description : "No description"}
                                    </span>

                                    {isSameUser && isHovering && (
                                        <BiEditAlt
                                            className="text-2xl text-[#dddcfc] cursor-pointer"
                                            onClick={() => {
                                                setIsEditing(true);
                                            }}
                                        />
                                    )}
                                </div>
                            )}
                            <RiDoubleQuotesL className="text-2xl text-[#dddcfc] rotate-180" />
                        </div>
                    ) : (
                        isSameUser && (
                            <div className="flex items-center justify-center">
                                <RiDoubleQuotesL className="text-2xl text-[#dddcfc]" />
                                {isEditing ? (
                                    TextArea()
                                ) : (
                                    <span
                                        className="text-center flex items-center cursor-pointer"
                                        onClick={() => {
                                            setIsEditing(true);
                                        }}
                                    >
                                        Edit Description <BiEditAlt />
                                    </span>
                                )}

                                <RiDoubleQuotesL className="text-2xl text-[#dddcfc] rotate-180" />
                            </div>
                        )
                    )}
                </div>
                <div className="flex flex-col items-center justify-center justify-self-end">
                    <img
                        src={fixedItem.image}
                        alt={fixedItem.name}
                        className="w-24 h-24 object-contain rounded"
                    />
                    <div className="w-auto" />

                    <p className="text-base py-2 font-semibold"
                        style={{ textShadow: '1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000' }}
                    >{fixedItem.name}</p>
                </div>
            </div>
        </div>

    )
}

export default FixItem;