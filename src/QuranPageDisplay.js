import React from "react";

const QuranPageDisplay = ({ page, currentVerse, recognizedWords }) => {
  if (!page || !page.ayahs) return null; // تأكد من وجود البيانات

  return (
    <div className="bg-white p-6 rounded-lg shadow-md mb-8">
      <h3 className="text-2xl font-bold text-center text-green-800 mb-6">
        الصفحة {page.number}
      </h3>
      <div className="arabic-font text-2xl leading-loose text-justify">
        {page.ayahs.map((verse) => (
          <div key={verse.number} className="mb-4">
            <span className="font-bold">{verse.number}:</span>
            {verse.text.split(" ").map((word, wordIndex) => {
              const wordKey = `${verse.number}-${wordIndex}`;
              const isCorrect = recognizedWords[wordKey] === "correct";
              const isIncorrect = recognizedWords[wordKey] === "incorrect";

              return (
                <span
                  key={wordKey}
                  className={`inline-block mx-1 ${
                    isCorrect ? "text-green-600 font-bold" : ""
                  } ${isIncorrect ? "text-red-600 line-through" : ""}`}
                >
                  {word}
                </span>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};

export default QuranPageDisplay;
