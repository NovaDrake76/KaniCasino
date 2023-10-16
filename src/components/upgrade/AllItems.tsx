import React, { useState, useContext, useEffect } from "react";
import { AiOutlineArrowDown } from "react-icons/ai"
import UserContext from "../../UserContext";
import { getCases, getCase } from "../../services/cases/CaseServices";
import Item from "../Item";  // Import your Item component if you have one
import Case from "../Case";
import Skeleton from "react-loading-skeleton";

interface AllItems {
    selectedItems: any;
    selectedCase: any;
    setSelectedCase: React.Dispatch<React.SetStateAction<any>>;
    selectedTarget: any;
    setSelectedTarget: React.Dispatch<React.SetStateAction<any>>;
}

const AllItems: React.FC<AllItems> = ({ selectedItems, selectedCase, setSelectedCase, selectedTarget, setSelectedTarget }) => {
    const [allCases, setAllCases] = useState<any[]>([]);
    const [selectedCaseItems, setSelectedCaseItems] = useState<any[]>([]);
    const [loadingItems, setLoadingItems] = useState<boolean>(true);
    const [itemFilters, setItemFilters] = useState({
        name: '',
        rarity: '',
        sortBy: '',
        order: 'asc'
    });
    const { userData } = useContext(UserContext);

    const getAllItemsInfo = async () => {
        setLoadingItems(true);
        if (userData) {
            try {
                const newFilters = { ...itemFilters, caseId: selectedCase };
                const items = await getCases();
                setAllCases(items);
            }
            catch (error) {
                console.log(error);
            }
        }
        setLoadingItems(false);
    }

    const getSelectedCaseItems = async () => {
        setLoadingItems(true);
        if (userData) {
            try {
                const items = await getCase(selectedCase?._id);
                setSelectedCaseItems(items.items);
            }
            catch (error) {
                console.log(error);
            }
        }
        setLoadingItems(false);
    }

    useEffect(() => {
        getAllItemsInfo();
    }, [itemFilters, userData]);

    useEffect(() => {
        selectedCase && getSelectedCaseItems();
    }, [selectedCase]);

    return (
        <div className="flex flex-col w-1/2 gap-2 mb-8">
            <div className="flex w-full items-center justify-between border px-6 h-24">
                <span>Get one Item</span>
                <div className="flex items-center justify-between cursor-pointer" onClick={() => {
                    setItemFilters(prev => {
                        return {
                            ...prev,
                            sortBy: prev.sortBy === '' ? 'mostRare' : ''
                        }
                    })
                }}>
                    <span>Rarity</span>
                    <AiOutlineArrowDown style={{
                        transform: itemFilters.sortBy === 'mostRare' ? 'rotate(180deg)' : '',
                        transition: 'transform 0.2s ease-in-out'
                    }} />
                </div>
            </div>
            <div className="flex h-[500px] border flex-wrap gap-2 p-4 overflow-y-auto justify-around">
                {
                    loadingItems ? (
                        { array: Array(12).fill(0) }.array.map((_, i) => (
                            <Skeleton
                                width={176}
                                height={216}
                                highlightColor="#161427"
                                baseColor="#1c1a31"
                                key={i}
                            />
                        ))
                    ) : (
                        selectedCase === null ? (
                            allCases.map((item: any, index: number) => {
                                return (
                                    <div key={index} onClick={() => {
                                        setSelectedCase(item);
                                    }} className="cursor-pointer">
                                        <div className="flex flex-col items-center">
                                            <img src={item.image} alt={`Select items from ${item.title}`} className="object-contain h-40" />
                                            <span>{item.title}</span>
                                        </div>
                                    </div>
                                )
                            })
                        ) : (
                            selectedCaseItems.map((item: any, index: number) => {
                                return (
                                    <div key={index} onClick={() => {
                                        setSelectedTarget(item)
                                    }}>
                                        <Item item={item} />

                                    </div>
                                )
                            }
                            )
                        )
                    )
                }


            </div>

        </div>
    )
}

export default AllItems;
