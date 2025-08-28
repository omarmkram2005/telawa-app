import React, { useState, useEffect } from "react";

function App() {
  const [pageNumber, setPageNumber] = useState(1);
  const [ayahs, setAyahs] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [recognition, setRecognition] = useState(null);

  // تحميل الصفحة من API
  useEffect(() => {
    const fetchPage = async () => {
      try {
        const res = await fetch(
          `https://api.alquran.cloud/v1/page/${pageNumber}/quran-uthmani`
        );
        const data = await res.json();
        if (data.code === 200) {
          setAyahs(data.data.ayahs);
          setCurrentIndex(0);
        }
      } catch (err) {
        console.error("Error fetching Quran data:", err);
      }
    };

    fetchPage();
  }, [pageNumber]);

  // تفعيل التعرف على الصوت
  useEffect(() => {
    if (!("webkitSpeechRecognition" in window)) {
      alert("المتصفح لا يدعم التعرف على الصوت.");
      return;
    }

    const rec = new window.webkitSpeechRecognition();
    rec.lang = "ar-SA";
    rec.continuous = true;
    rec.interimResults = true;

    rec.onresult = (event) => {
      const transcript =
        event.results[event.results.length - 1][0].transcript.trim();
      if (ayahs.length > 0 && currentIndex < ayahs.length) {
        const currentAyah = ayahs[currentIndex].text.trim();

        if (transcript === currentAyah) {
          document.getElementById(`ayah-${currentIndex}`).style.color = "green";
          setCurrentIndex((prev) => prev + 1);
        } else {
          document.getElementById(`ayah-${currentIndex}`).style.color = "red";
        }
      }
    };

    setRecognition(rec);
  }, [ayahs, currentIndex]);

  const toggleRecording = () => {
    if (!recognition) return;

    if (isRecording) {
      recognition.stop();
      setIsRecording(false);
    } else {
      recognition.start();
      setIsRecording(true);
    }
  };

  return (
    <div className="p-6 text-center">
      <h1 className="text-2xl font-bold mb-4">📖 صفحة {pageNumber}</h1>

      {/* التنقل بين الصفحات */}
      <div className="flex justify-center space-x-2 mb-4">
        <button
          onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
          className="px-4 py-2 bg-gray-300 rounded"
        >
          ⬅️ السابق
        </button>
        <input
          type="number"
          value={pageNumber}
          onChange={(e) => setPageNumber(Number(e.target.value))}
          min="1"
          max="604"
          className="border px-2 py-1 w-20 text-center"
        />
        <button
          onClick={() => setPageNumber((p) => Math.min(604, p + 1))}
          className="px-4 py-2 bg-gray-300 rounded"
        >
          التالي ➡️
        </button>
      </div>

      {/* زر التسجيل */}
      <button
        onClick={toggleRecording}
        className={`px-6 py-2 rounded font-bold ${
          isRecording ? "bg-red-500 text-white" : "bg-green-500 text-white"
        }`}
      >
        {isRecording ? "⏹️ إيقاف" : "🎤 بدء التسجيل"}
      </button>

      {/* عرض الآيات */}
      <div className="mt-6 space-y-2 text-xl leading-relaxed text-right">
        {ayahs.length > 0 ? (
          ayahs.map((ayah, index) => (
            <p key={ayah.number} id={`ayah-${index}`} className="ayah">
              {ayah.text}
            </p>
          ))
        ) : (
          <p>جارِ تحميل الصفحة...</p>
        )}
      </div>
    </div>
  );
}

export default App;
