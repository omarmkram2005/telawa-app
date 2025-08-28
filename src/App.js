import React, { useState, useEffect } from "react";
import axios from "axios";
import PageSelector from "./PageSelector";
import QuranPageDisplay from "./QuranPageDisplay";
import RecitationControl from "./RecitationControl";
import ErrorLog from "./ErrorLog";

const App = () => {
  const [selectedPage, setSelectedPage] = useState(1); // بدءًا من الصفحة 1
  const [currentVerse, setCurrentVerse] = useState(0);
  const [recognizedWords, setRecognizedWords] = useState({});
  const [errors, setErrors] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [progress, setProgress] = useState(0);
  const [quranData, setQuranData] = useState(null);

  useEffect(() => {
    fetchQuranPage(selectedPage);
  }, [selectedPage]);

  const fetchQuranPage = async (page) => {
    try {
      const response = await axios.get(
        `https://api.alquran.cloud/v1/page/${page}/quran-uthmani`
      );
      setQuranData(response.data.data);
    } catch (error) {
      console.error("Error fetching Quran data:", error);
    }
  };

  const handleStartRecitation = () => {
    setIsRecording(true);
    setProgress(0);
    setRecognizedWords({});
    setErrors([]);
    setCurrentVerse(1); // بدءًا من الآية الأولى

    // تفعيل التعرف على الصوت
    const recognition = new (window.SpeechRecognition ||
      window.webkitSpeechRecognition)();
    recognition.lang = "ar-SA";
    recognition.interimResults = true; // تفعيل النتائج المؤقتة
    recognition.continuous = true; // تفعيل التعرف المستمر

    recognition.onresult = (event) => {
      const transcript = event.results[event.results.length - 1][0].transcript;
      analyzeRecitation(transcript);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognition.start();
  };

  const analyzeRecitation = (text) => {
    if (!quranData) return;

    const currentVerseData = quranData.ayahs[currentVerse - 1];

    // تحليل النص المدخل
    const words = text.split(" ");
    words.forEach((word, index) => {
      if (index < currentVerseData.text.split(" ").length) {
        const correctWord = currentVerseData.text.split(" ")[index];
        if (word === correctWord) {
          setRecognizedWords((prev) => ({
            ...prev,
            [`${currentVerse}-${index + 1}`]: "correct",
          }));
        } else {
          setRecognizedWords((prev) => ({
            ...prev,
            [`${currentVerse}-${index + 1}`]: "incorrect",
          }));
          setErrors((prev) => [
            ...prev,
            { verse: currentVerseData.number, incorrectWord: word },
          ]);
        }
      }
    });

    // تحديث التقدم
    setProgress((currentVerse / quranData.ayahs.length) * 100);
  };

  const handleStopRecitation = () => {
    setIsRecording(false);
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold text-center mb-6">
        اختبار تلاوة القرآن الكريم
      </h1>
      <PageSelector onSelectPage={setSelectedPage} currentPage={selectedPage} />
      <QuranPageDisplay
        page={quranData}
        currentVerse={currentVerse}
        recognizedWords={recognizedWords}
      />
      <RecitationControl
        isRecording={isRecording}
        onStartRecitation={handleStartRecitation}
        onStopRecitation={handleStopRecitation}
        currentVerse={currentVerse}
        progress={progress}
      />
      <ErrorLog errors={errors} currentPage={selectedPage} />
    </div>
  );
};

const playSuccessSound = () => {
  const audio = new Audio(
    "https://assets.mixkit.co/sfx/preview/mixkit-correct-answer-tone-2870.mp3"
  );
  audio.play();
};

const playErrorSound = () => {
  const audio = new Audio(
    "https://assets.mixkit.co/sfx/preview/mixkit-wrong-answer-fail-notification-946.mp3"
  );
  audio.play();
};

export default App;
