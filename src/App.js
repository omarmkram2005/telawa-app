import React, { useState, useEffect, useRef } from "react";

const WIT_API_KEY = "WMFB2ARELBKH5LPN3U3RO65WNJFZ2UN7";

export default function QuranRecitationApp() {
  const [page, setPage] = useState(1);
  const [ayahs, setAyahs] = useState([]);
  const [recognized, setRecognized] = useState("");
  const [recording, setRecording] = useState(false);
  const [highlighted, setHighlighted] = useState([]);

  const mediaRecorderRef = useRef(null);
  const chunks = useRef([]);

  // ✅ Fetch page from alquran.cloud
  useEffect(() => {
    const fetchPage = async () => {
      const res = await fetch(
        `https://api.alquran.cloud/v1/page/${page}/quran-uthmani`
      );
      const data = await res.json();
      if (data?.data?.ayahs) {
        setAyahs(data.data.ayahs);
      }
    };
    fetchPage();
  }, [page]);

  // 🎙️ Start recording
  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorderRef.current = new MediaRecorder(stream, {
      mimeType: "audio/webm",
    });

    mediaRecorderRef.current.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.current.push(e.data);
    };

    mediaRecorderRef.current.onstop = async () => {
      const blob = new Blob(chunks.current, { type: "audio/webm" });
      chunks.current = [];
      const wavBlob = await convertToWav(blob);
      sendToWit(wavBlob);
    };

    mediaRecorderRef.current.start();
    setRecording(true);
  };

  // ⏹️ Stop recording
  const stopRecording = () => {
    mediaRecorderRef.current.stop();
    setRecording(false);
  };

  // 🔄 Convert WebM → WAV
  const convertToWav = (webmBlob) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsArrayBuffer(webmBlob);
      reader.onloadend = () => {
        const audioContext = new (window.AudioContext ||
          window.webkitAudioContext)();
        audioContext.decodeAudioData(reader.result, (buffer) => {
          const wavBuffer = audioBufferToWav(buffer);
          resolve(new Blob([wavBuffer], { type: "audio/wav" }));
        });
      };
    });
  };

  // Helper: convert PCM → WAV
  const audioBufferToWav = (buffer) => {
    const numOfChan = buffer.numberOfChannels,
      length = buffer.length * numOfChan * 2 + 44,
      bufferArr = new ArrayBuffer(length),
      view = new DataView(bufferArr),
      channels = [],
      sampleRate = buffer.sampleRate;

    let offset = 0;
    function writeString(str) {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
      offset += str.length;
    }

    writeString("RIFF");
    view.setUint32(offset, 36 + buffer.length * 2, true);
    offset += 4;
    writeString("WAVE");
    writeString("fmt ");
    view.setUint32(offset, 16, true);
    offset += 4;
    view.setUint16(offset, 1, true);
    offset += 2;
    view.setUint16(offset, numOfChan, true);
    offset += 2;
    view.setUint32(offset, sampleRate, true);
    offset += 4;
    view.setUint32(offset, sampleRate * 2 * numOfChan, true);
    offset += 4;
    view.setUint16(offset, numOfChan * 2, true);
    offset += 2;
    view.setUint16(offset, 16, true);
    offset += 2;
    writeString("data");
    view.setUint32(offset, buffer.length * 2, true);
    offset += 4;

    for (let i = 0; i < numOfChan; i++) channels.push(buffer.getChannelData(i));

    let interleaved = new Float32Array(buffer.length * numOfChan);
    for (let i = 0; i < buffer.length; i++) {
      for (let c = 0; c < numOfChan; c++) {
        interleaved[i * numOfChan + c] = channels[c][i];
      }
    }

    for (let i = 0; i < interleaved.length; i++, offset += 2) {
      let s = Math.max(-1, Math.min(1, interleaved[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }

    return bufferArr;
  };

  // 🚀 Send to Wit.ai
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
        highlightAyah(data.text);
      }
    } catch (err) {
      console.error("Error parsing response", err);
    }
  };

  // ✅ Compare text with ayah
  const highlightAyah = (recText) => {
    const words = ayahs[0]?.text.split(" ") || [];
    const recWords = recText.split(" ");
    const result = words.map((w, i) => ({
      word: w,
      correct: recWords[i] && w.includes(recWords[i]),
    }));
    setHighlighted(result);
  };

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">📖 Quran Recitation</h1>

      <div className="mb-4">
        <button onClick={() => setPage((p) => Math.max(1, p - 1))}>
          ⬅️ Prev
        </button>
        <button onClick={() => setPage((p) => p + 1)}>Next ➡️</button>
      </div>

      <div className="mb-6">
        {highlighted.length > 0
          ? highlighted.map((w, i) => (
              <span
                key={i}
                style={{ color: w.correct ? "green" : "red", marginRight: 5 }}
              >
                {w.word}
              </span>
            ))
          : ayahs.map((a) => <p key={a.number}>{a.text}</p>)}
      </div>

      {!recording ? (
        <button onClick={startRecording}>🎙️ Start</button>
      ) : (
        <button onClick={stopRecording}>⏹️ Stop</button>
      )}

      <p className="mt-4">Recognized: {recognized}</p>
    </div>
  );
}
