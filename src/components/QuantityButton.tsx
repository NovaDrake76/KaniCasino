interface QuantityButtonProps {
    quantity: number;
    setQuantity: (quantity: number) => void;
    disabled?: boolean;
}

const QuantityButton: React.FC<QuantityButtonProps> = ({ quantity, setQuantity, disabled }) => {

    const handleIncrement = () => {
        if (quantity < 5 && !disabled) {
            setQuantity(quantity + 1);
        }
    };

    const handleDecrement = () => {
        if (quantity > 1 && !disabled) {
            setQuantity(quantity - 1);
        }
    };

    const buttonStyle = `${disabled ? "cursor-disabled" : "cursor-pointer"} w-8 h-8 flex items-center justify-center select-none`

    return (
        <div className="flex items-center gap-2 border rounded border-secondary">
            <div
                className={buttonStyle}
                onClick={handleDecrement}
            >
                -
            </div>
            <span className="w-2">{quantity}</span>
            <div
                className={buttonStyle}
                onClick={handleIncrement}
            >
                +
            </div>
        </div>
    );
};


export default QuantityButton;