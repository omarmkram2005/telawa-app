import React, { useState, useEffect, useRef } from "react";

// دعم التعرف على الصوت (SpeechRecognition API)
const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition;

function App() {
  const [pageNumber, setPageNumber] = useState(1);
  const [ayahs, setAyahs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);

  const recognitionRef = useRef(null);

  // جلب بيانات الصفحة من API
  const fetchPage = async (page) => {
    try {
      setLoading(true);
      const res = await fetch(
        `https://api.alquran.cloud/v1/page/${page}/quran-uthman`
      );
      if (!res.ok) throw new Error("Page not found");
      const data = await res.json();
      setAyahs(data.data.ayahs || []);
    } catch (err) {
      console.error("Error fetching Quran data:", err);
      setAyahs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPage(pageNumber);
  }, [pageNumber]);

  // تغيير الصفحة
  const nextPage = () => {
    if (pageNumber < 604) setPageNumber(pageNumber + 1);
  };

  const prevPage = () => {
    if (pageNumber > 1) setPageNumber(pageNumber - 1);
  };

  // بدء التعرف على الصوت
  const startListening = () => {
    if (!SpeechRecognition) {
      alert("المتصفح لا يدعم التعرف على الصوت");
      return;
    }

    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.lang = "ar-SA"; // لغة عربية
    recognitionRef.current.continuous = false;
    recognitionRef.current.interimResults = false;

    recognitionRef.current.onresult = (event) => {
      const transcript = event.results[0][0].transcript.trim();
      console.log("🎤 النص المسموع:", transcript);

      if (transcript.includes("التالي")) {
        nextPage();
      } else if (transcript.includes("السابق")) {
        prevPage();
      } else if (!isNaN(parseInt(transcript))) {
        const num = parseInt(transcript);
        if (num >= 1 && num <= 604) {
          setPageNumber(num);
        }
      } else {
        alert("لم يتم التعرف على الأمر الصوتي");
      }
    };

    recognitionRef.current.onstart = () => setListening(true);
    recognitionRef.current.onend = () => setListening(false);

    recognitionRef.current.start();
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4 text-center">
        📖 المصحف - صفحة {pageNumber}
      </h1>

      {/* التحكم في الصفحة */}
      <div className="flex items-center justify-center gap-2 mb-4">
        <button
          onClick={prevPage}
          disabled={pageNumber === 1}
          className="px-4 py-2 bg-gray-200 rounded disabled:opacity-50"
        >
          ⬅️ السابق
        </button>

        <input
          type="number"
          value={pageNumber}
          onChange={(e) => setPageNumber(Number(e.target.value))}
          min="1"
          max="604"
          className="w-20 border px-2 py-1 text-center"
        />

        <button
          onClick={nextPage}
          disabled={pageNumber === 604}
          className="px-4 py-2 bg-gray-200 rounded disabled:opacity-50"
        >
          التالي ➡️
        </button>
      </div>

      {/* زر التعرف على الصوت */}
      <div className="flex justify-center mb-6">
        <button
          onClick={startListening}
          className={`px-6 py-2 rounded ${
            listening ? "bg-red-500 text-white" : "bg-green-500 text-white"
          }`}
        >
          {listening ? "🎙️ جاري الاستماع..." : "🎤 اضغط للتحدث"}
        </button>
      </div>

      {/* عرض الآيات */}
      <div className="space-y-4 text-right">
        {loading ? (
          <p className="text-center">⏳ جارِ تحميل الصفحة...</p>
        ) : ayahs.length > 0 ? (
          ayahs.map((ayah) => (
            <p key={ayah.number} className="text-lg leading-loose">
              <span className="font-bold text-green-700">
                ({ayah.numberInSurah})
              </span>{" "}
              {ayah.text}
            </p>
          ))
        ) : (
          <p className="text-center">❌ لا توجد آيات</p>
        )}
      </div>
    </div>
  );
}

export default App;
