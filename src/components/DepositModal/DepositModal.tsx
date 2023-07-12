import { useState } from 'react';

type DepositOption = {
    id: string;
    label: string;
    content: React.ReactNode;
};

type DepositModalProps = {
    options: DepositOption[];
    setOpenDepositModal: React.Dispatch<React.SetStateAction<boolean>>;
};

const DepositModal = ({ options, setOpenDepositModal }: DepositModalProps) => {
    const [selectedOption, setSelectedOption] = useState<string>(options[0].id);

    const handleOptionClick = (optionId: string) => {
        setSelectedOption(optionId);
    };

    return (
        <div className="fixed z-10 inset-0 overflow-y-auto ">
            <div className="flex items-center justify-center min-h-screen">
                <div className="fixed inset-0 bg-gray-500 opacity-75"></div>
                <div className="relative bg-[#141225] rounded-lg w-[600px] h-[600px]">
                    <div className="flex items-center justify-between p-4 bg-[#100f1f] rounded-t-lg">
                        <h2 className="text-lg font-medium">Deposit</h2>
                        <button onClick={() => { setOpenDepositModal(false) }}>
                            <svg
                                className="w-6 h-6 text-gray-600 hover:text-gray-800 transition-colors duration-150"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                            >
                                <path
                                    fillRule="evenodd"
                                    d="M10 8.586L3.707 2.293a1 1 0 00-1.414 1.414L8.586 10l-6.293 6.293a1 1 0 101.414 1.414L10 11.414l6.293 6.293a1 1 0 001.414-1.414L11.414 10l6.293-6.293a1 1 0 00-1.414-1.414L10 8.586z"
                                    clipRule="evenodd"
                                />
                            </svg>
                        </button>
                    </div>
                    <div className="flex p-4">
                        <div className="flex flex-col w-1/3 gap-2">
                            {options.map((option) => (
                                <button
                                    key={option.id}
                                    className={`p-4 text-left font-medium bg-[#1c1a31] hover:bg-[#141225] focus:bg-[#141225]focus:outline-none ${selectedOption === option.id ? 'bg-[#646cff]' : ''
                                        }`}
                                    onClick={() => handleOptionClick(option.id)}
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>
                        <div className="flex-grow p-4">{options.find((option) => option.id === selectedOption)?.content}</div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DepositModal;