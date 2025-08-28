import React, { useState, useRef, useEffect } from "react";

export default function App() {
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [quranText, setQuranText] = useState([]);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const intervalRef = useRef(null);
  const pageNumber = 2; // صفحة للتجربة

  // جلب بيانات الصفحة من API
  useEffect(() => {
    fetch(`https://api.alquran.cloud/v1/page/${pageNumber}/quran-uthman`)
      .then((res) => res.json())
      .then((data) => {
        if (data.data && data.data.ayahs) {
          setQuranText(data.data.ayahs);
        }
      })
      .catch((err) => console.error(err));
  }, []);

  // بدء التسجيل
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        processAudio();
      };

      mediaRecorderRef.current.start();

      // تقسيم التسجيل كل ثانيتين
      intervalRef.current = setInterval(() => {
        if (
          mediaRecorderRef.current &&
          mediaRecorderRef.current.state === "recording"
        ) {
          mediaRecorderRef.current.stop();
          mediaRecorderRef.current.start();
        }
      }, 2000);

      setRecording(true);
    } catch (err) {
      console.error("Microphone error:", err);
    }
  };

  // إيقاف التسجيل
  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      clearInterval(intervalRef.current);
    }
    setRecording(false);
  };

  // معالجة الصوت وإرساله لـ Wit.ai
  const processAudio = async () => {
    const blob = new Blob(audioChunksRef.current, { type: "audio/webm" }); // جرب webm
    audioChunksRef.current = [];

    const formData = new FormData();
    formData.append("file", blob, "speech.webm");

    try {
      const response = await fetch("https://api.wit.ai/speech?v=20210928", {
        method: "POST",
        headers: {
          Authorization: "Bearer WMFB2ARELBKH5LPN3U3RO65WNJFZ2UN7",
        },
        body: blob, // نبعت البودي مباشرة
      });

      const text = await response.text();
      console.log("Wit.ai response:", text);
      setTranscript(text); // علشان يظهر في h1
    } catch (err) {
      console.error("Wit.ai error:", err);
    }
  };

  return (
    <div className="p-4">
      <h1>📖 Quran Page {pageNumber}</h1>
      {quranText.map((ayah) => (
        <p key={ayah.number} style={{ direction: "rtl", fontSize: "20px" }}>
          {ayah.text}
        </p>
      ))}

      <div className="mt-4">
        {!recording ? (
          <button
            onClick={startRecording}
            className="bg-green-500 text-white px-4 py-2 rounded"
          >
            ▶️ ابدأ التسجيل
          </button>
        ) : (
          <button
            onClick={stopRecording}
            className="bg-red-500 text-white px-4 py-2 rounded"
          >
            ⏹️ إيقاف التسجيل
          </button>
        )}
      </div>

      <h1 className="mt-4">🎤 Wit.ai Response:</h1>
      <pre style={{ whiteSpace: "pre-wrap" }}>{transcript}</pre>
    </div>
  );
}
