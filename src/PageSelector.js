import React from "react";

const PageSelector = ({ onSelectPage, currentPage }) => {
  const totalPages = 604; // عدد صفحات القرآن الكريم

  const handleInputChange = (event) => {
    const page = parseInt(event.target.value);
    if (page >= 1 && page <= totalPages) {
      onSelectPage(page);
    }
  };

  const handleSelectChange = (event) => {
    const page = parseInt(event.target.value);
    onSelectPage(page);
  };

  return (
    <div className="mb-6">
      <label className="block text-lg font-bold mb-2">اختر صفحة:</label>
      <div className="flex items-center">
        <select
          value={currentPage || ""}
          onChange={handleSelectChange}
          className="border rounded p-2 mr-2"
        >
          {[...Array(totalPages)].map((_, index) => (
            <option key={index + 1} value={index + 1}>
              الصفحة {index + 1}
            </option>
          ))}
        </select>
        <input
          type="number"
          min="1"
          max={totalPages}
          placeholder="أدخل رقم الصفحة"
          onChange={handleInputChange}
          className="border rounded p-2"
        />
      </div>
    </div>
  );
};

export default PageSelector;
