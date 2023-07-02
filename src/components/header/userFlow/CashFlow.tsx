const CashFlow = () => {
    return (
        <div className="absolute  mt-24 w-[calc(100vw-2rem)] max-w-[1920px]  flex justify-end">
            <div className="bg-[#19172D] p-4 rounded  flex flex-col gap-4 w-48 mr-24">
                <button className="w-full bg-[#00AA00] p-2 rounded text-white">Deposit</button>
                <button className="w-full bg-[#3A3A55] p-2 rounded text-white">Withdraw</button>
            </div>
        </div>
    )
}

export default CashFlow