import React, { useEffect, useState, useRef } from "react";

function App() {
  const [page, setPage] = useState(1);
  const [ayahs, setAyahs] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  // 1. جلب الصفحة من API
  useEffect(() => {
    fetch(`https://api.alquran.cloud/v1/page/${page}/quran-uthmani`)
      .then((res) => res.json())
      .then((data) => setAyahs(data.data.ayahs));
  }, [page]);

  // تحويل Blob -> WAV
  const blobToWav = async (blob) => {
    const arrayBuffer = await blob.arrayBuffer();
    return new Blob([arrayBuffer], { type: "audio/wav" });
  };

  // 2. بدء التسجيل
  const startRecording = async () => {
    setIsRecording(true);
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorderRef.current = new MediaRecorder(stream);

    mediaRecorderRef.current.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };

    mediaRecorderRef.current.onstop = async () => {
      const audioBlob = new Blob(chunksRef.current, { type: "audio/webm" });
      chunksRef.current = [];
      const wavBlob = await blobToWav(audioBlob);
      await sendToWit(wavBlob);

      if (isRecording) startRecording(); // إعادة التسجيل تلقائي
    };

    mediaRecorderRef.current.start();
    setTimeout(() => {
      if (mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stop();
      }
    }, 5000); // كل 5 ثواني يقطع ويبعت
  };

  // 3. وقف التسجيل
  const stopRecording = () => {
    setIsRecording(false);
    if (mediaRecorderRef.current) mediaRecorderRef.current.stop();
  };

  // 4. إرسال لـ Wit.ai
  const sendToWit = async (audioBlob) => {
    const res = await fetch("https://api.wit.ai/speech?v=20240828", {
      method: "POST",
      headers: {
        Authorization: "Bearer WMFB2ARELBKH5LPN3U3RO65WNJFZ2UN7",
        "Content-Type": "audio/wav",
      },
      body: audioBlob,
    });

    const data = await res.json();
    if (data.text) {
      setTranscript(data.text);
    } else {
      console.log("Wit.ai response:", data);
    }
  };

  // 5. مقارنة الكلمات
  const renderAyah = (ayah) => {
    const spokenWords = transcript.split(" ");
    return ayah.text.split(" ").map((word, i) => {
      const correct = spokenWords[i] === word;
      return (
        <span
          key={i}
          style={{
            backgroundColor: spokenWords[i]
              ? correct
                ? "lightgreen"
                : "salmon"
              : "transparent",
            margin: "2px",
            padding: "2px",
            borderRadius: "4px",
          }}
        >
          {word}{" "}
        </span>
      );
    });
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
          <p key={a.number}>{renderAyah(a)}</p>
        ))}
      </div>

      <div>
        {!isRecording ? (
          <button onClick={startRecording}>🎤 ابدأ التسجيل</button>
        ) : (
          <button onClick={stopRecording}>⏹️ أوقف التسجيل</button>
        )}
      </div>

      <h3>النص اللي اتعرف عليه Wit.ai:</h3>
      <p>{transcript}</p>
    </div>
  );
}

export default App;
