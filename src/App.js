import React, { useState, useEffect, useRef } from "react";

const WIT_API_KEY = "WMFB2ARELBKH5LPN3U3RO65WNJFZ2UN7";

export default function QuranRecitationApp() {
  const [pageNumber, setPageNumber] = useState(1);
  const [ayahs, setAyahs] = useState([]);
  const [currentAyahIndex, setCurrentAyahIndex] = useState(0);
  const [recognized, setRecognized] = useState("");
  const [highlighted, setHighlighted] = useState([]);
  const [recording, setRecording] = useState(false);

  const mediaRecorderRef = useRef(null);
  const intervalRef = useRef(null);

  // ✅ Fetch full Quran page
  useEffect(() => {
    const fetchPage = async () => {
      const res = await fetch(
        `https://api.quran.com/v4/quran/verses/uthmani?page_number=${pageNumber}`
      );
      const data = await res.json();
      if (data?.verses) {
        setAyahs(data.verses);
        setCurrentAyahIndex(0);
      }
    };
    fetchPage();
  }, [pageNumber]);

  const currentAyah = ayahs[currentAyahIndex]?.text_uthmani || "";

  // 🎙️ Start recording
  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorderRef.current = new MediaRecorder(stream);

    mediaRecorderRef.current.ondataavailable = async (e) => {
      if (e.data.size > 0) {
        const audioBlob = e.data;
        await sendToWit(audioBlob);
      }
    };

    mediaRecorderRef.current.start();
    intervalRef.current = setInterval(() => {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.start();
    }, 3000);

    setRecording(true);
  };

  // ⏹️ Stop recording
  const stopRecording = () => {
    clearInterval(intervalRef.current);
    mediaRecorderRef.current.stop();
    setRecording(false);
  };

  // 🚀 Send audio to Wit.ai
  const sendToWit = async (audioBlob) => {
    const response = await fetch("https://api.wit.ai/speech?v=20230928", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WIT_API_KEY}`,
        "Content-Type": "audio/wav",
      },
      body: audioBlob,
    });

    try {
      const data = await response.json();
      if (data.text) {
        setRecognized(data.text);
        highlightWords(data.text);
      }
    } catch (err) {
      console.error("Error parsing response", err);
    }
  };

  // ✅ Compare recognized text with ayah
  const highlightWords = (recText) => {
    const ayahWords = currentAyah.split(" ");
    const recWords = recText.split(" ");
    const result = ayahWords.map((word, i) => {
      if (recWords[i] && word.includes(recWords[i])) {
        return { word, correct: true };
      } else {
        return { word, correct: false };
      }
    });
    setHighlighted(result);
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">📖 Quran Recitation Trainer</h1>

      <div className="mb-4">
        <button
          onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
          className="px-3 py-2 bg-gray-400 text-white rounded-lg mr-2"
        >
          ◀️ Prev Page
        </button>
        <button
          onClick={() => setPageNumber((p) => p + 1)}
          className="px-3 py-2 bg-gray-600 text-white rounded-lg"
        >
          Next Page ▶️
        </button>
      </div>

      <h2 className="text-xl mb-2">Page {pageNumber}</h2>

      <div className="space-y-6">
        {ayahs.map((ayah, i) => (
          <p
            key={ayah.id}
            className="text-2xl leading-loose cursor-pointer"
            onClick={() => setCurrentAyahIndex(i)}
          >
            {currentAyahIndex === i && highlighted.length > 0
              ? highlighted.map((w, j) => (
                  <span
                    key={j}
                    style={{
                      color: w.correct ? "green" : "red",
                      marginRight: 6,
                    }}
                  >
                    {w.word}
                  </span>
                ))
              : ayah.text_uthmani}
          </p>
        ))}
      </div>

      <div className="mt-6">
        {!recording ? (
          <button
            onClick={startRecording}
            className="px-4 py-2 bg-green-600 text-white rounded-lg"
          >
            🎙️ Start Reciting
          </button>
        ) : (
          <button
            onClick={stopRecording}
            className="px-4 py-2 bg-red-600 text-white rounded-lg"
          >
            ⏹️ Stop
          </button>
        )}
      </div>

      <p className="mt-4 text-gray-700">
        Recognized: <span className="font-mono">{recognized}</span>
      </p>
    </div>
  );
}
