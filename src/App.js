import React, { useState, useRef, useEffect } from "react";

export default function QuranApp() {
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [quranText, setQuranText] = useState([]);
  const [pageNumber, setPageNumber] = useState(2);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);

  // تحميل صفحة القرآن
  useEffect(() => {
    fetch(`https://api.alquran.cloud/v1/page/${pageNumber}/quran-uthman`)
      .then((res) => res.json())
      .then((data) => {
        if (data.data && data.data.ayahs) {
          setQuranText(data.data.ayahs.map((a) => ({ ...a, match: false })));
        }
      });
  }, [pageNumber]);

  // بدء التسجيل
  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorderRef.current = new MediaRecorder(stream, {
      mimeType: "audio/webm",
    });

    mediaRecorderRef.current.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunksRef.current.push(e.data);
    };

    mediaRecorderRef.current.onstop = () => {
      processAudio();
    };

    mediaRecorderRef.current.start();

    // يسجل 5 ثواني ويكرر
    timerRef.current = setInterval(() => {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.start();
    }, 5000);

    setRecording(true);
  };

  // إيقاف التسجيل
  const stopRecording = () => {
    clearInterval(timerRef.current);
    mediaRecorderRef.current.stop();
    setRecording(false);
  };

  // تحويل WebM → WAV
  const convertToWav = async (blob) => {
    const arrayBuffer = await blob.arrayBuffer();
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

    const wavBuffer = audioBufferToWav(audioBuffer);
    return new Blob([wavBuffer], { type: "audio/wav" });
  };

  const audioBufferToWav = (buffer) => {
    const numOfChan = buffer.numberOfChannels;
    const length = buffer.length * numOfChan * 2 + 44;
    const result = new ArrayBuffer(length);
    const view = new DataView(result);
    let pos = 0;

    const writeUint16 = (d) => {
      view.setUint16(pos, d, true);
      pos += 2;
    };
    const writeUint32 = (d) => {
      view.setUint32(pos, d, true);
      pos += 4;
    };

    // WAV header
    writeUint32(0x46464952);
    writeUint32(length - 8);
    writeUint32(0x45564157);
    writeUint32(0x20746d66);
    writeUint32(16);
    writeUint16(1);
    writeUint16(numOfChan);
    writeUint32(buffer.sampleRate);
    writeUint32(buffer.sampleRate * 2 * numOfChan);
    writeUint16(numOfChan * 2);
    writeUint16(16);
    writeUint32(0x61746164);
    writeUint32(length - pos - 4);

    const channels = [];
    for (let i = 0; i < numOfChan; i++) channels.push(buffer.getChannelData(i));

    let offset = 0;
    while (pos < length) {
      for (let i = 0; i < numOfChan; i++) {
        let sample = Math.max(-1, Math.min(1, channels[i][offset]));
        view.setInt16(
          pos,
          sample < 0 ? sample * 0x8000 : sample * 0x7fff,
          true
        );
        pos += 2;
      }
      offset++;
    }

    return result;
  };

  // إرسال لـ Wit.ai
  const processAudio = async () => {
    const webmBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
    audioChunksRef.current = [];
    const wavBlob = await convertToWav(webmBlob);

    try {
      const res = await fetch("https://api.wit.ai/speech?v=20210928", {
        method: "POST",
        headers: {
          Authorization: "Bearer WMFB2ARELBKH5LPN3U3RO65WNJFZ2UN7",
          "Content-Type": "audio/wav",
        },
        body: wavBlob,
      });

      const data = await res.json();
      console.log("🎤 Wit.ai Response:", data);

      if (data.text) {
        setTranscript(data.text);
        highlightAyah(data.text);
      }
    } catch (err) {
      console.error("Wit error:", err);
    }
  };

  // تظليل الآية المطابقة
  const highlightAyah = (spoken) => {
    const normalized = spoken.replace(/[\u064B-\u0652]/g, "");
    let found = false;

    const updated = quranText.map((ayah, i) => {
      const cleanAyah = ayah.text.replace(/[\u064B-\u0652]/g, "");
      if (cleanAyah.includes(normalized)) {
        found = true;
        if (i === quranText.length - 1) setPageNumber((p) => p + 1); // Auto nav
        return { ...ayah, match: true };
      }
      return { ...ayah, match: false };
    });

    if (found) setQuranText(updated);
  };

  return (
    <div className="p-4">
      <h1>📖 صفحة {pageNumber}</h1>

      {quranText.map((ayah) => (
        <p
          key={ayah.number}
          style={{
            direction: "rtl",
            fontSize: "22px",
            background: ayah.match ? "lightgreen" : "transparent",
          }}
        >
          {ayah.text}
        </p>
      ))}

      <div className="mt-4 space-x-2">
        {!recording ? (
          <button
            onClick={startRecording}
            className="bg-green-600 text-white px-4 py-2 rounded"
          >
            ▶️ تسجيل
          </button>
        ) : (
          <button
            onClick={stopRecording}
            className="bg-red-600 text-white px-4 py-2 rounded"
          >
            ⏹ إيقاف
          </button>
        )}

        <button
          onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
          className="bg-gray-500 text-white px-3 py-2 rounded"
        >
          ◀️ السابق
        </button>
        <button
          onClick={() => setPageNumber((p) => p + 1)}
          className="bg-gray-500 text-white px-3 py-2 rounded"
        >
          التالي ▶️
        </button>
      </div>

      <h2 className="mt-4">🎤 النص:</h2>
      <pre>{transcript}</pre>
    </div>
  );
}
