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
        let sample = Math.max(-1, Math.min(1, channels[i][offset])); // clamp
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

  // معالجة الصوت وإرساله لـ Wit.ai
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

      const text = await response.text();
      console.log("Wit.ai response:", text);
      setTranscript(text);
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
