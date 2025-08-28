import React, { useState, useEffect } from "react";

const App = () => {
  const [pageNumber, setPageNumber] = useState(1);
  const [ayahs, setAyahs] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recognition, setRecognition] = useState(null);
  const [currentAyahIndex, setCurrentAyahIndex] = useState(0);
  const [results, setResults] = useState([]);
  const [errors, setErrors] = useState(0);

  // تحميل الصفحة من API
  const fetchPage = async (page) => {
    try {
      const response = await fetch(
        `https://api.alquran.cloud/v1/page/${page}/quran-uthmani`
      );
      const data = await response.json();
      if (data.status === "OK") {
        setAyahs(data.data.ayahs);
        setCurrentAyahIndex(0);
        setResults([]);
        setErrors(0);
      }
    } catch (err) {
      console.error("Error fetching page:", err);
    }
  };

  useEffect(() => {
    fetchPage(pageNumber);
  }, [pageNumber]);

  // بدء التسجيل الصوتي
  const startRecognition = () => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("المتصفح لا يدعم التعرف على الصوت");
      return;
    }

    const recog = new SpeechRecognition();
    recog.lang = "ar-SA";
    recog.continuous = true;
    recog.interimResults = false;

    recog.onresult = (event) => {
      const transcript =
        event.results[event.results.length - 1][0].transcript.trim();
      console.log("📢 قلت:", transcript);

      const expected = ayahs[currentAyahIndex]?.text || "";
      const isCorrect = transcript.includes(expected);

      if (isCorrect) {
        setResults((prev) => [...prev, { ayah: expected, correct: true }]);
        setCurrentAyahIndex((prev) => prev + 1);
      } else {
        setResults((prev) => [...prev, { ayah: expected, correct: false }]);
        setErrors((prev) => prev + 1);
      }
    };

    recog.start();
    setRecognition(recog);
    setIsRecording(true);
  };

  // إيقاف التسجيل
  const stopRecognition = () => {
    if (recognition) recognition.stop();
    setIsRecording(false);
  };

  return (
    <div className="p-4 text-center">
      <h1 className="text-2xl font-bold mb-4">📖 تطبيق تلاوة القرآن</h1>

      {/* أزرار التنقل بين الصفحات */}
      <div className="flex gap-2 justify-center mb-4">
        <button
          className="bg-gray-300 px-3 py-1 rounded"
          onClick={() => setPageNumber((prev) => Math.max(prev - 1, 1))}
        >
          ⬅️ صفحة قبل
        </button>
        <span className="px-4 py-1 border rounded">الصفحة: {pageNumber}</span>
        <button
          className="bg-gray-300 px-3 py-1 rounded"
          onClick={() => setPageNumber((prev) => prev + 1)}
        >
          صفحة بعد ➡️
        </button>
      </div>

      {/* عرض الآيات */}
      <div className="border p-4 rounded text-right leading-loose">
        {ayahs.map((ayah, index) => {
          const result = results[index];
          return (
            <span
              key={ayah.number}
              className={`px-1 ${
                result ? (result.correct ? "bg-green-200" : "bg-red-200") : ""
              }`}
            >
              {ayah.text}{" "}
            </span>
          );
        })}
      </div>

      {/* أزرار التسجيل */}
      <div className="mt-4">
        {!isRecording ? (
          <button
            className="bg-green-500 text-white px-4 py-2 rounded"
            onClick={startRecognition}
          >
            🎤 ابدأ التسجيل
          </button>
        ) : (
          <button
            className="bg-red-500 text-white px-4 py-2 rounded"
            onClick={stopRecognition}
          >
            ⏹️ أوقف التسجيل
          </button>
        )}
      </div>

      {/* عرض النتيجة */}
      <div className="mt-4">
        <p>عدد الأخطاء: {errors}</p>
      </div>
    </div>
  );
};

export default App;
