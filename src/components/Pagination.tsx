import React from "react";

interface PaginationProps {
    totalPages: number;
    currentPage: number;
    setPage: (page: number) => void;
}

const Pagination: React.FC<PaginationProps> = ({ totalPages, currentPage, setPage }) => {
    const renderPageNumber = (pageNumber: number) => (
        <div
            key={pageNumber}
            className={`p-4 w-10 h-10 flex items-center justify-center border rounded hover:border-white transition-all 
                ${pageNumber === currentPage ?
                    "border-white bg-primary-light text-secondary" :
                    "border-gray-500 text-gray-500 hover:text-white cursor-pointer"}`}
            onClick={() => setPage(pageNumber)}
        >
            {pageNumber}
        </div>
    );

    const renderPagination = () => {
        let pages = [];

        if (totalPages <= 7) {
            // Show all pages if total pages less than or equal to 7
            for (let i = 1; i <= totalPages; i++) {
                pages.push(renderPageNumber(i));
            }
        } else {
            // More than 7 total pages, calculate start and end pages

            if (currentPage <= 4) {

                pages = [
                    ...Array.from({ length: 5 }, (_, i) => renderPageNumber(i + 1)),
                    <span key="ellipsis1" className="text-gray-500">...</span>,
                    renderPageNumber(totalPages)
                ];
            } else if (currentPage + 3 >= totalPages) {

                pages = [
                    renderPageNumber(1),
                    <span key="ellipsis1" className="text-gray-500">...</span>,
                    ...Array.from({ length: 5 }, (_, i) => renderPageNumber(totalPages - 4 + i))
                ];
            } else {

                pages = [
                    renderPageNumber(1),
                    <span key="ellipsis1" className="text-gray-500">...</span>,
                    ...Array.from({ length: 5 }, (_, i) => renderPageNumber(currentPage - 2 + i)),
                    <span key="ellipsis2" className="text-gray-500">...</span>,
                    renderPageNumber(totalPages)
                ];
            }
        }

        return pages;
    };

    return (
        <div className="flex flex-wrap gap-4 items-center p-2 py-4">
            {renderPagination()}
        </div>
    );
}

export default Pagination;
