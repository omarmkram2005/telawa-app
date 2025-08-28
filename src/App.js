import React, { useEffect, useState, useRef } from "react";

function App() {
  const [page, setPage] = useState(1);
  const [ayahs, setAyahs] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState("");
  const [errors, setErrors] = useState(0);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  // 1. جلب بيانات القرآن من API
  useEffect(() => {
    fetch(`https://api.alquran.cloud/v1/page/${page}/quran-uthmani`)
      .then((res) => res.json())
      .then((data) => {
        setAyahs(data.data.ayahs);
      });
  }, [page]);

  // 2. بدء التسجيل
  const startRecording = async () => {
    setIsRecording(true);
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorderRef.current = new MediaRecorder(stream, {
      mimeType: "audio/webm",
    });

    mediaRecorderRef.current.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };

    mediaRecorderRef.current.onstop = async () => {
      const audioBlob = new Blob(chunksRef.current, { type: "audio/webm" });
      chunksRef.current = [];
      await sendToWit(audioBlob);
      if (isRecording) startRecording(); // restart auto
    };

    mediaRecorderRef.current.start();
    setTimeout(() => {
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state === "recording"
      ) {
        mediaRecorderRef.current.stop();
      }
    }, 5000); // كل 5 ثواني نبعته لـ Wit.ai
  };

  // 3. وقف التسجيل
  const stopRecording = () => {
    setIsRecording(false);
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
    }
  };

  // 4. إرسال الصوت لـ Wit.ai
  const sendToWit = async (audioBlob) => {
    const res = await fetch("https://api.wit.ai/speech?v=20240331", {
      method: "POST",
      headers: {
        Authorization: "Bearer WMFB2ARELBKH5LPN3U3RO65WNJFZ2UN7",
        "Content-Type": "audio/webm",
      },
      body: audioBlob,
    });

    const data = await res.json();
    if (data.text) {
      setCurrentTranscript(data.text);
      compareTranscript(data.text);
    }
  };

  // 5. مقارنة القراءة بالآية
  const compareTranscript = (transcript) => {
    if (!ayahs.length) return;

    let expectedWords = ayahs
      .map((a) => a.text)
      .join(" ")
      .split(" ");
    let spokenWords = transcript.split(" ");

    let wrongs = 0;
    expectedWords.forEach((word, i) => {
      if (spokenWords[i] && spokenWords[i] === word) {
        // صح
      } else if (spokenWords[i]) {
        wrongs++;
      }
    });

    setErrors((prev) => prev + wrongs);
  };

  return (
    <div style={{ direction: "rtl", padding: "20px", fontFamily: "Cairo" }}>
      <h1>📖 تلاوة القرآن</h1>

      <div>
        <label>رقم الصفحة: </label>
        <input
          type="number"
          value={page}
          onChange={(e) => setPage(Number(e.target.value))}
        />
      </div>

      <div>
        {ayahs.map((a) => (
          <p key={a.number}>{a.text}</p>
        ))}
      </div>

      <div>
        {!isRecording ? (
          <button onClick={startRecording}>🎤 ابدأ التسجيل</button>
        ) : (
          <button onClick={stopRecording}>⏹️ أوقف التسجيل</button>
        )}
      </div>

      <h3>نص مقروء:</h3>
      <p>{currentTranscript}</p>

      <h3>عدد الأخطاء: {errors}</h3>
    </div>
  );
}

export default App;
