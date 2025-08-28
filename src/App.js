import React, { useState, useRef, useEffect } from "react";

export default function App() {
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [quranText, setQuranText] = useState([]);
  const [pageNumber, setPageNumber] = useState(2);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const intervalRef = useRef(null);

  // جلب بيانات الصفحة
  useEffect(() => {
    fetch(`https://api.alquran.cloud/v1/page/${pageNumber}/quran-uthman`)
      .then((res) => res.json())
      .then((data) => {
        if (data.data && data.data.ayahs) {
          setQuranText(data.data.ayahs);
        }
      })
      .catch((err) => console.error(err));
  }, [pageNumber]);

  // بدء التسجيل
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType: "audio/webm",
      });
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

      // كل 5 ثواني يقسم التسجيل
      intervalRef.current = setInterval(() => {
        if (
          mediaRecorderRef.current &&
          mediaRecorderRef.current.state === "recording"
        ) {
          mediaRecorderRef.current.stop();
          mediaRecorderRef.current.start();
        }
      }, 5000);

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

  // تحويل webm → wav
  const convertToWav = async (webmBlob) => {
    const arrayBuffer = await webmBlob.arrayBuffer();
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

    const wavBuffer = audioBufferToWav(audioBuffer);
    return new Blob([wavBuffer], { type: "audio/wav" });
  };

  const audioBufferToWav = (buffer) => {
    let numOfChan = buffer.numberOfChannels,
      length = buffer.length * numOfChan * 2 + 44,
      bufferArray = new ArrayBuffer(length),
      view = new DataView(bufferArray),
      channels = [],
      sampleRate = buffer.sampleRate,
      offset = 0,
      pos = 0;

    const setUint16 = (data) => {
      view.setUint16(pos, data, true);
      pos += 2;
    };

    const setUint32 = (data) => {
      view.setUint32(pos, data, true);
      pos += 4;
    };

    // RIFF chunk descriptor
    setUint32(0x46464952); // "RIFF"
    setUint32(length - 8); // file length - 8
    setUint32(0x45564157); // "WAVE"

    // FMT sub-chunk
    setUint32(0x20746d66); // "fmt "
    setUint32(16); // size = 16
    setUint16(1); // PCM
    setUint16(numOfChan);
    setUint32(sampleRate);
    setUint32(sampleRate * 2 * numOfChan); // avg. bytes/sec
    setUint16(numOfChan * 2); // block-align
    setUint16(16); // 16-bit (hardcoded)

    // data sub-chunk
    setUint32(0x61746164); // "data"
    setUint32(length - pos - 4);

    // write interleaved data
    for (let i = 0; i < buffer.numberOfChannels; i++) {
      channels.push(buffer.getChannelData(i));
    }

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

    return bufferArray;
  };

  // إرسال الصوت لـ Wit.ai
  const processAudio = async () => {
    const webmBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
    audioChunksRef.current = [];

    const wavBlob = await convertToWav(webmBlob);

    try {
      const response = await fetch("https://api.wit.ai/speech?v=20210928", {
        method: "POST",
        headers: {
          Authorization: "Bearer WMFB2ARELBKH5LPN3U3RO65WNJFZ2UN7",
          "Content-Type": "audio/wav",
        },
        body: wavBlob,
      });

      const json = await response.json();
      console.log("Wit.ai response:", json);

      if (json.text) {
        setTranscript(json.text);
        checkAyahMatch(json.text);
      }
    } catch (err) {
      console.error("Wit.ai error:", err);
    }
  };

  // التحقق من التطابق
  const checkAyahMatch = (spoken) => {
    const normalizedSpoken = spoken.replace(/[\u064B-\u0652]/g, ""); // إزالة التشكيل
    const matchIndex = quranText.findIndex((ayah) =>
      ayah.text.replace(/[\u064B-\u0652]/g, "").includes(normalizedSpoken)
    );

    if (matchIndex !== -1) {
      const newQuranText = quranText.map((ayah, idx) => ({
        ...ayah,
        match: idx === matchIndex,
      }));
      setQuranText(newQuranText);

      // أوتوماتيك: لو آخر آية، انتقل للصفحة التالية
      if (matchIndex === quranText.length - 1) {
        setPageNumber((prev) => prev + 1);
      }
    }
  };

  return (
    <div className="p-4">
      <h1>📖 Quran Page {pageNumber}</h1>

      {quranText.map((ayah) => (
        <p
          key={ayah.number}
          style={{
            direction: "rtl",
            fontSize: "20px",
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

      <h2 className="mt-4">🎤 النص المتعرف عليه:</h2>
      <pre style={{ whiteSpace: "pre-wrap" }}>{transcript}</pre>
    </div>
  );
}
