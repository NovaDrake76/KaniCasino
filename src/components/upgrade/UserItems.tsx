import { useContext, useEffect, useRef, useState } from "react";
import { AiOutlineArrowDown } from "react-icons/ai";
import { MdOutlineNavigateBefore, MdOutlineNavigateNext } from "react-icons/md";
import Skeleton from "react-loading-skeleton";
import Item from "../Item";
import UserContext from "../../UserContext";
import { getInventory } from "../../services/users/UserServices";

interface Inventory {
    selectedItems: any;
    setSelectedItems: React.Dispatch<React.SetStateAction<any>>;
    selectedCase: any;
    setSelectedCase: React.Dispatch<React.SetStateAction<any>>;
}

const UserItems: React.FC<Inventory> = ({ selectedItems, setSelectedItems, selectedCase, setSelectedCase }) => {
    const [inventory, setInventory] = useState<any>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [pageLimit, setPageLimit] = useState<number>(0);
    const [currentPage, setCurrentPage] = useState<number>(1);
    const [inventoryFilters, setInventoryFilters] = useState({
        name: '',
        rarity: '',
        sortBy: '',
        order: 'asc'
    });
    const inventoryRef = useRef<HTMLDivElement | null>(null);
    const { userData } = useContext(UserContext);

    const getInventoryInfo = async () => {
        setLoading(true);
        if (userData) {
            try {
                const newFilters = { ...inventoryFilters, caseId: selectedCase };
                const inventory = await getInventory(userData.id, currentPage, newFilters);
                setInventory(inventory.items);
                setPageLimit(inventory.totalPages);
            }
            catch (error) {
                console.log(error);
            }
        }
        setLoading(false);
    }

    useEffect(() => {
        getInventoryInfo();
    }, [currentPage, inventoryFilters, userData]);

    return (
        <div className="flex flex-col w-1/2  gap-2">
            <div className="flex w-full items-center justify-between border px-6 h-24">
                <span>Inventory</span>
                <div className="flex items-center justify-between cursor-pointer" onClick={() => {
                    setInventoryFilters(prev => {
                        return {
                            ...prev,
                            sortBy: prev.sortBy === '' ? 'mostRare' : ''
                        }
                    })
                }
                }>
                    <span>Rarity</span>
                    <AiOutlineArrowDown style={{
                        transform: inventoryFilters.sortBy === 'mostRare' ? 'rotate(180deg)' : '',
                        transition: 'transform 0.2s ease-in-out'

                    }} />
                </div>
            </div>
            <div className="flex h-[500px] border flex-wrap gap-2 p-4 overflow-y-auto justify-around" >
                {
                    loading ? (
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
                        inventory.map((item: any, index: number) => {
                            return (
                                <div key={index} ref={
                                    index === 0 ? inventoryRef : null
                                }
                                    onClick={() => {
                                        const itemIdentifier = `${item._id}-${index}`;
                                        const itemExists = selectedItems.some((selectedItem: { identifier: string; }) => selectedItem.identifier === itemIdentifier);

                                        setSelectedItems(
                                            itemExists ?
                                                selectedItems.filter((selectedItem: { identifier: string; }) => selectedItem.identifier !== itemIdentifier)
                                                :
                                                [...selectedItems, { item: item, identifier: itemIdentifier }]
                                        );
                                    }}
                                    className={`cursor-pointer border-2 ${selectedItems.some((selectedItem: { identifier: string; }) => selectedItem.identifier === `${item._id}-${index}`) ? ' border-[#606bc7]' : 'border-transparent'}`}>
                                    <Item item={item} />
                                </div>
                            )
                        })
                    )
                }

            </div>
            <div className="flex items-center gap-4 text-white">
                <MdOutlineNavigateBefore
                    style={{
                        cursor: currentPage === 1 ? "not-allowed" : "pointer",
                        color: currentPage === 1 ? "gray" : "white"
                    }}
                    onClick={() => {
                        currentPage !== 1 && setCurrentPage(prev => prev - 1);
                        currentPage !== 1 && inventoryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' });
                    }}
                />
                <span>Page: {currentPage}</span>
                <MdOutlineNavigateNext
                    style={{
                        cursor: currentPage === pageLimit ? "not-allowed" : "pointer",
                        color: currentPage === pageLimit ? "gray" : "white"
                    }}
                    onClick={() => {
                        currentPage !== pageLimit && setCurrentPage(prev => prev + 1);
                        currentPage !== pageLimit && inventoryRef.current?.scrollIntoView({ behavior: 'smooth' });
                    }}
                />
            </div>
        </div>
    )

}

export default UserItems;