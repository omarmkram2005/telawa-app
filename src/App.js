import React, { useState, useEffect, useRef } from "react";

function App() {
  const [ayahs, setAyahs] = useState([]);
  const [pageNumber, setPageNumber] = useState(1);
  const [recording, setRecording] = useState(false);
  const [witResponse, setWitResponse] = useState(""); // ✅ نعرض رد Wit هنا
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  // ✅ جلب الصفحة من API القرآن
  useEffect(() => {
    const fetchPage = async () => {
      try {
        const res = await fetch(
          `https://api.alquran.cloud/v1/page/${pageNumber}/quran-uthmani`
        );
        const data = await res.json();
        setAyahs(data.data.ayahs);
      } catch (err) {
        console.error("Error fetching Quran page:", err);
      }
    };
    fetchPage();
  }, [pageNumber]);

  // ✅ إرسال التسجيل إلى Wit.ai
  const sendToWit = async (audioBlob) => {
    try {
      const res = await fetch("https://api.wit.ai/speech?v=20240801", {
        method: "POST",
        headers: {
          Authorization: "Bearer WMFB2ARELBKH5LPN3U3RO65WNJFZ2UN7",
          "Content-Type": "audio/wav",
        },
        body: audioBlob,
      });

      const text = await res.text(); // 👈 Wit بيرجع نص (JSON أو Error)
      setWitResponse(text); // 👈 نعرضه على الصفحة
    } catch (err) {
      console.error("Error sending to Wit:", err);
      setWitResponse("Error: " + err.message);
    }
  };

  // ✅ بدء التسجيل
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: "audio/wav",
        });
        sendToWit(audioBlob); // 👈 ابعت التسجيل لـ Wit.ai
      };

      mediaRecorder.start();
      setRecording(true);
    } catch (err) {
      console.error("Error accessing mic:", err);
    }
  };

  // ✅ إيقاف التسجيل
  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  };

  return (
    <div className="App" style={{ padding: 20, direction: "rtl" }}>
      <h2>القرآن الكريم - صفحة {pageNumber}</h2>
      <div style={{ marginBottom: 20 }}>
        {ayahs.map((ayah) => (
          <p key={ayah.number} style={{ fontSize: "20px", lineHeight: "2" }}>
            {ayah.text}
          </p>
        ))}
      </div>

      <button onClick={recording ? stopRecording : startRecording}>
        {recording ? "⏹️ إيقاف التسجيل" : "🎤 بدء التسجيل"}
      </button>

      <h3>رد Wit.ai:</h3>
      <h1
        style={{
          fontSize: "14px",
          direction: "ltr",
          whiteSpace: "pre-wrap",
          background: "#f4f4f4",
          padding: "10px",
          borderRadius: "8px",
        }}
      >
        {witResponse || "لم يصل أي رد بعد"}
      </h1>
    </div>
  );
}

export default App;
