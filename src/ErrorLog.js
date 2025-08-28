import React from "react";

const ErrorLog = ({ errors, currentPage }) => {
  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h3 className="text-xl font-bold text-red-800 mb-4">
        📋 سجل الأخطاء - الصفحة {currentPage}
      </h3>

      {errors.length === 0 ? (
        <p className="text-green-600 text-center py-4">
          🎉 لا توجد أخطاء - ممتاز!
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left rtl:text-right text-gray-700">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50">
              <tr>
                <th className="px-4 py-2">الآية</th>
                <th className="px-4 py-2">الكلمة</th>
              </tr>
            </thead>
            <tbody>
              {errors.map((error, index) => (
                <tr key={index} className="bg-white border-b hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium">{error.verse}</td>
                  <td className="px-4 py-2 text-red-600">
                    {error.incorrectWord}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ErrorLog;
