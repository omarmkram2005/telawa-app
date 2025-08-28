import React from "react";

const PageSelector = ({ onSelectPage, currentPage }) => {
  return (
    <div className="bg-white p-6 rounded-lg shadow-md mb-8">
      <h2 className="text-2xl font-bold text-green-800 mb-4 text-center">
        📖 اختر صفحة القرآن الكريم
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {[1, 2].map((page) => (
          <button
            key={page}
            onClick={() => onSelectPage(page)}
            className={`p-3 rounded-lg text-center transition-all duration-200 ${
              currentPage === page
                ? "bg-green-600 text-white shadow-lg transform scale-105"
                : "bg-green-100 text-green-800 hover:bg-green-200"
            }`}
          >
            الصفحة {page}
          </button>
        ))}
      </div>
    </div>
  );
};

export default PageSelector;
