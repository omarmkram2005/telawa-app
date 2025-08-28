import React, { useState, useRef } from "react";

const WIT_API = "https://api.wit.ai/speech?v=20240828";
const WIT_TOKEN = "WMFB2ARELBKH5LPN3U3RO65WNJFZ2UN7";

function App() {
  const [transcript, setTranscript] = useState("مستني تسجيل 🎤");
  const [debug, setDebug] = useState(""); // عشان نعرض الريسبونس
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  const convertToWav = async (blob) => {
    const arrayBuffer = await blob.arrayBuffer();
    const audioCtx = new AudioContext();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    const wavBuffer = audioBufferToWav(audioBuffer);
    return new Blob([wavBuffer], { type: "audio/wav" });
  };

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
    setUint32(0x46464952);
    setUint32(length - 8);
    setUint32(0x45564157);
    setUint32(0x20746d66);
    setUint32(16);
    setUint16(1);
    setUint16(numOfChan);
    setUint32(buffer.sampleRate);
    setUint32(buffer.sampleRate * 2 * numOfChan);
    setUint16(numOfChan * 2);
    setUint16(16);
    setUint32(0x61746164);
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

  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorderRef.current = new MediaRecorder(stream);
    chunksRef.current = [];

    mediaRecorderRef.current.ondataavailable = (e) => {
      chunksRef.current.push(e.data);
    };

    mediaRecorderRef.current.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });

      setDebug(`WebM size: ${blob.size}`);

      const wavBlob = await convertToWav(blob);

      setDebug((prev) => prev + ` | WAV size: ${wavBlob.size}`);

      try {
        const res = await fetch(WIT_API, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${WIT_TOKEN}`,
            "Content-Type": "audio/wav",
          },
          body: wavBlob,
        });

        const text = await res.text();
        setDebug((prev) => prev + ` | Raw: ${text}`);

        const lines = text.split("\n").filter((l) => l.trim() !== "");

        let finalTranscript = "";
        lines.forEach((line) => {
          try {
            const data = JSON.parse(line);
            if (data.type === "FINAL_TRANSCRIPTION") {
              finalTranscript = data.text;
            }
          } catch (err) {
            setDebug((prev) => prev + " | JSON parse failed line");
          }
        });

        setTranscript(finalTranscript || "❌ مفيش كلام متعرف عليه");
      } catch (err) {
        setTranscript("❌ حصل Error");
        setDebug("Fetch Error: " + err.message);
      }
    };

    mediaRecorderRef.current.start();

    setTranscript("🎤 جاري التسجيل...");

    setTimeout(() => {
      mediaRecorderRef.current.stop();
    }, 5000); // زودتها 5 ثواني
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

      <div className="mt-4 p-2 bg-gray-200 text-sm text-left break-words">
        <strong>🔍 Debug:</strong>
        <p>{debug}</p>
      </div>
    </div>
  );
}

export default App;
