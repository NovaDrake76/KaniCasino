import { useEffect, useState } from "react";
import mike1 from "/images/slot/mike1.webp";
import mike2 from "/images/slot/mike2.webp";
import mike3 from "/images/slot/mike3.webp";
import mike4 from "/images/slot/mike4.webp";

interface RenderMikeProps {
    status: "normal" | "win" | "losing" | "jackpot";
}

const RenderMike: React.FC<RenderMikeProps> = ({ status }) => {
    const [currentMike, setCurrentMike] = useState(mike1);

    const handleMike = () => {
        if (status === "normal") {
            setTimeout(() => {
                setCurrentMike(mike1);
            }, 3000);
        } else if (status === "win") {
            setTimeout(() => {
                setCurrentMike(mike4);
            }, 3000);
        } else if (status === "losing") {
            setTimeout(() => {
                setCurrentMike(mike2);
            }, 3000);
        } else if (status === "jackpot") {
            setTimeout(() => {
                setCurrentMike(mike3);
            }, 3000);
        }
    };

    useEffect(() => {
        handleMike();
    }, [status]);

    return (
        <div className="w-full flex justify-center -mb-16 -z-10">
            <img src={currentMike} className="w-[200px] h-[200px]  " />
        </div>
    );

};

export default RenderMike;