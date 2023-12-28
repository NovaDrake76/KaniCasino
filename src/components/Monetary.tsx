interface IMonetaryProps {
    value: number;
    showFraction?: boolean;
}

const Monetary: React.FC<IMonetaryProps> = ({ value, showFraction = false }) => {

    const formattedValue = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "DOL",
        maximumFractionDigits: showFraction ? 2 : 0,
    })
        .format(value)
        .replace("DOL", "K₽")

    return (
        <span>
            {formattedValue}
        </span>
    )
};

export default Monetary;