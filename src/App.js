import React, { useState, useRef } from "react";

export default function QuranRecitationApp() {
  const [isRecording, setIsRecording] = useState(false);
  const [recognizedText, setRecognizedText] = useState("");
  const [quranText, setQuranText] = useState("");
  const [highlightedText, setHighlightedText] = useState("");
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  // 🔹 1. Load Quran text from API (مثال: سورة البقرة 1-5)
  const fetchQuranText = async () => {
    try {
      const res = await fetch("https://api.alquran.cloud/v1/ayah/2:1-5");
      const data = await res.json();
      const text = data.data.map((ayah) => ayah.text).join(" ");
      setQuranText(text);
    } catch (err) {
      console.error("❌ Quran API error:", err);
    }
  };

  // 🔹 2. Convert WebM to WAV
  const webmToWav = async (webmBlob) => {
    const audioCtx = new AudioContext();
    const arrayBuffer = await webmBlob.arrayBuffer();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    const wavBuffer = audioBufferToWav(audioBuffer);
    return new Blob([wavBuffer], { type: "audio/wav" });
  };

  const audioBufferToWav = (buffer) => {
    const numOfChan = buffer.numberOfChannels;
    const length = buffer.length * numOfChan * 2 + 44;
    const bufferArray = new ArrayBuffer(length);
    const view = new DataView(bufferArray);
    let offset = 0;

    const writeString = (s) => {
      for (let i = 0; i < s.length; i++) {
        view.setUint8(offset + i, s.charCodeAt(i));
      }
      offset += s.length;
    };

    // WAV header
    writeString("RIFF");
    view.setUint32(offset, 36 + buffer.length * numOfChan * 2, true);
    offset += 4;
    writeString("WAVE");
    writeString("fmt ");
    view.setUint32(offset, 16, true);
    offset += 4;
    view.setUint16(offset, 1, true);
    offset += 2;
    view.setUint16(offset, numOfChan, true);
    offset += 2;
    view.setUint32(offset, buffer.sampleRate, true);
    offset += 4;
    view.setUint32(offset, buffer.sampleRate * numOfChan * 2, true);
    offset += 4;
    view.setUint16(offset, numOfChan * 2, true);
    offset += 2;
    view.setUint16(offset, 16, true);
    offset += 2;
    writeString("data");
    view.setUint32(offset, buffer.length * numOfChan * 2, true);
    offset += 4;

    // PCM samples
    const channels = [];
    for (let i = 0; i < numOfChan; i++) {
      channels.push(buffer.getChannelData(i));
    }
    let interleaved = new Float32Array(buffer.length * numOfChan);
    for (let i = 0; i < buffer.length; i++) {
      for (let c = 0; c < numOfChan; c++) {
        interleaved[i * numOfChan + c] = channels[c][i];
      }
    }
    let idx = 44;
    const volume = 1;
    for (let i = 0; i < interleaved.length; i++) {
      let s = Math.max(-1, Math.min(1, interleaved[i] * volume));
      view.setInt16(idx, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      idx += 2;
    }
    return bufferArray;
  };

  // 🔹 3. Start Recording
  const startRecording = async () => {
    setRecognizedText("");
    setHighlightedText("");
    await fetchQuranText();

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorderRef.current = new MediaRecorder(stream);
    audioChunksRef.current = [];

    mediaRecorderRef.current.ondataavailable = (event) => {
      audioChunksRef.current.push(event.data);
    };

    mediaRecorderRef.current.onstop = async () => {
      const webmBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
      const wavBlob = await webmToWav(webmBlob);

      const formData = new FormData();
      formData.append("file", wavBlob, "speech.wav");

      // 🔹 4. Send to Wit.ai
      const res = await fetch("https://api.wit.ai/speech?v=20230215", {
        method: "POST",
        headers: { Authorization: "Bearer YOUR_WITAI_TOKEN" },
        body: wavBlob,
      });

      const text = await res.text();
      console.log("🔍 Wit.ai Raw:", text);

      try {
        const parsed = JSON.parse(text);
        const finalText = parsed.text || "";
        setRecognizedText(finalText);

        // 🔹 5. Highlight Quran match
        if (quranText && finalText) {
          const regex = new RegExp(`(${finalText})`, "gi");
          const highlighted = quranText.replace(regex, `<mark>$1</mark>`);
          setHighlightedText(highlighted);
        }
      } catch (err) {
        console.error("❌ JSON parse error:", err);
      }
    };

    mediaRecorderRef.current.start();
    setIsRecording(true);
  };

  // 🔹 6. Stop Recording
  const stopRecording = () => {
    mediaRecorderRef.current.stop();
    setIsRecording(false);
  };

  return (
    <div className="p-6 text-center">
      <h1 className="text-2xl font-bold mb-4">🎤 Quran Recitation App</h1>

      <button
        onClick={isRecording ? stopRecording : startRecording}
        className={`px-6 py-2 rounded text-white ${
          isRecording ? "bg-red-600" : "bg-green-600"
        }`}
      >
        {isRecording ? "⏹ Stop Recording" : "▶ Start Recording"}
      </button>

      <p className="mt-4 text-gray-700">
        {recognizedText
          ? `✅ متعرف عليه: ${recognizedText}`
          : "❌ مفيش كلام متعرف عليه"}
      </p>

      <div
        className="mt-6 p-4 border rounded text-right leading-loose"
        dir="rtl"
        dangerouslySetInnerHTML={{
          __html: highlightedText || quranText || "📖 جاري تحميل النص...",
        }}
      />
    </div>
  );
}
