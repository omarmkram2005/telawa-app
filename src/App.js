import React, { useState, useRef } from "react";

const WIT_API = "https://api.wit.ai/speech?v=20240828";
const WIT_TOKEN = "WMFB2ARELBKH5LPN3U3RO65WNJFZ2UN7"; // السيرفر توكن بتاعك

function App() {
  const [transcript, setTranscript] = useState("");
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  // Helper: تحويل WebM → WAV
  const convertToWav = async (blob) => {
    const arrayBuffer = await blob.arrayBuffer();
    const audioCtx = new AudioContext();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

    const wavBuffer = audioBufferToWav(audioBuffer);
    return new Blob([wavBuffer], { type: "audio/wav" });
  };

  // تحويل AudioBuffer → WAV
  function audioBufferToWav(buffer) {
    const numOfChan = buffer.numberOfChannels;
    const length = buffer.length * numOfChan * 2 + 44;
    const bufferArray = new ArrayBuffer(length);
    const view = new DataView(bufferArray);
    const channels = [];
    let offset = 0;
    let pos = 0;

    function setUint16(data) {
      view.setUint16(pos, data, true);
      pos += 2;
    }
    function setUint32(data) {
      view.setUint32(pos, data, true);
      pos += 4;
    }

    // WAV header
    setUint32(0x46464952); // "RIFF"
    setUint32(length - 8);
    setUint32(0x45564157); // "WAVE"

    setUint32(0x20746d66); // "fmt "
    setUint32(16);
    setUint16(1);
    setUint16(numOfChan);
    setUint32(buffer.sampleRate);
    setUint32(buffer.sampleRate * 2 * numOfChan);
    setUint16(numOfChan * 2);
    setUint16(16);

    setUint32(0x61746164); // "data"
    setUint32(length - pos - 4);

    for (let i = 0; i < numOfChan; i++) channels.push(buffer.getChannelData(i));

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
  }

  // بدء التسجيل
  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorderRef.current = new MediaRecorder(stream);
    chunksRef.current = [];

    mediaRecorderRef.current.ondataavailable = (e) => {
      chunksRef.current.push(e.data);
    };

    mediaRecorderRef.current.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      const wavBlob = await convertToWav(blob);

      // إرسال لـ Wit
      const res = await fetch(WIT_API, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${WIT_TOKEN}`,
          "Content-Type": "audio/wav",
        },
        body: wavBlob,
      });

      const data = await res.json();
      console.log("🎤 Wit.ai Response:", data);
      setTranscript(data.text || "❌ مفيش كلام متعرف عليه");
    };

    mediaRecorderRef.current.start();

    // تسجيل 3 ثواني وبعدين وقف
    setTimeout(() => {
      mediaRecorderRef.current.stop();
    }, 3000);
  };

  return (
    <div className="p-6 text-center">
      <h1 className="text-xl font-bold mb-4">🎤 Quran Recitation App</h1>
      <button
        onClick={startRecording}
        className="px-6 py-2 bg-blue-600 text-white rounded-lg"
      >
        ▶️ Start Recording
      </button>
      <h1 className="mt-6 text-green-600 font-bold text-2xl">{transcript}</h1>
    </div>
  );
}

export default App;
