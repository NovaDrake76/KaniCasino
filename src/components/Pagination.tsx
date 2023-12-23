import React from "react";

interface PaginationProps {
    totalPages: number;
    currentPage: number;
    setPage: (page: number) => void;
}

const Pagination: React.FC<PaginationProps> = ({ totalPages, currentPage, setPage }) => {
    // Function to render a single page number
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

    // Function to render the pagination
    const renderPagination = () => {
        let pages: any = [];
        let startPage, endPage;

        if (totalPages <= 7) {
            // Less than 7 total pages, so show all
            startPage = 1;
            endPage = totalPages;
        } else {
            // More than 7 total pages, calculate start and end pages
            if (currentPage <= 4) {
                startPage = 1;
                endPage = 5;
                pages = [
                    ...Array.from({ length: 5 }, (_, i) => renderPageNumber(i + 1)),
                    <span key="ellipsis1" className="text-gray-500">...</span>,
                    renderPageNumber(totalPages)
                ];
            } else if (currentPage + 3 >= totalPages) {
                startPage = totalPages - 4;
                endPage = totalPages;
                pages = [
                    renderPageNumber(1),
                    <span key="ellipsis1" className="text-gray-500">...</span>,
                    ...Array.from({ length: 5 }, (_, i) => renderPageNumber(totalPages - 4 + i))
                ];
            } else {
                startPage = currentPage - 2;
                endPage = currentPage + 2;
                pages = [
                    renderPageNumber(1),
                    <span key="ellipsis1" className="text-gray-500">...</span>,
                    ...Array.from({ length: 5 }, (_, i) => renderPageNumber(currentPage - 2 + i)),
                    <span key="ellipsis2" className="text-gray-500">...</span>,
                    renderPageNumber(totalPages)
                ];
            }
        }

        // Add the middle range of page numbers
        if (totalPages > 7 && currentPage > 4 && currentPage + 3 < totalPages) {
            for (let i = startPage; i <= endPage; i++) {
                pages.push(renderPageNumber(i));
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
