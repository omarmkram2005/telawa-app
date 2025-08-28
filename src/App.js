import React, { useState, useEffect, useRef } from "react";

const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition;

function App() {
  const [pageNumber, setPageNumber] = useState(1);
  const [ayahs, setAyahs] = useState([]);
  const [words, setWords] = useState([]);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [results, setResults] = useState([]);
  const [listening, setListening] = useState(false);

  const recognitionRef = useRef(null);

  // تحميل الصفحة
  useEffect(() => {
    const fetchPage = async () => {
      const res = await fetch(
        `https://api.alquran.cloud/v1/page/${pageNumber}/quran-uthman`
      );
      const data = await res.json();
      setAyahs(data.data.ayahs);

      // نحول النصوص لكلمات منفصلة
      const allWords = data.data.ayahs
        .map((a) => a.text.split(" "))
        .flat()
        .filter((w) => w.trim() !== "");
      setWords(allWords);
      setResults(new Array(allWords.length).fill(null));
      setCurrentWordIndex(0);
    };
    fetchPage();
  }, [pageNumber]);

  // إزالة التشكيل للمقارنة
  const normalize = (text) =>
    text.replace(/[\u064B-\u0652]/g, "").replace(/[^\u0621-\u064A ]/g, "");

  // بدء التسجيل
  const startListening = () => {
    if (!SpeechRecognition) {
      alert("المتصفح لا يدعم التعرف على الصوت");
      return;
    }

    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.lang = "ar-SA";
    recognitionRef.current.continuous = true;
    recognitionRef.current.interimResults = false;

    recognitionRef.current.onresult = (event) => {
      const transcript = event.results[event.results.length - 1][0].transcript;
      console.log("🎤", transcript);

      const spoken = normalize(transcript).split(" ");
      const expected = normalize(words[currentWordIndex] || "");

      if (spoken.includes(expected)) {
        // ✅ صحيح
        const updated = [...results];
        updated[currentWordIndex] = true;
        setResults(updated);
        setCurrentWordIndex((prev) => prev + 1);
      } else {
        // ❌ خطأ
        const updated = [...results];
        updated[currentWordIndex] = false;
        setResults(updated);
      }
    };

    recognitionRef.current.onstart = () => setListening(true);
    recognitionRef.current.onend = () => setListening(false);

    recognitionRef.current.start();
  };

  return (
    <div className="p-6 text-right">
      <h1 className="text-2xl font-bold mb-4">📖 صفحة {pageNumber}</h1>

      <button
        onClick={startListening}
        className={`px-4 py-2 rounded ${
          listening ? "bg-red-500" : "bg-green-500"
        } text-white`}
      >
        {listening ? "🎙️ جاري الاستماع..." : "🎤 ابدأ التلاوة"}
      </button>

      <div className="mt-6 leading-loose text-xl">
        {words.map((word, i) => (
          <span
            key={i}
            className={`px-1 ${
              results[i] === true
                ? "bg-green-300"
                : results[i] === false
                ? "bg-red-300"
                : ""
            }`}
          >
            {word}
          </span>
        ))}
      </div>
    </div>
  );
}

export default App;
