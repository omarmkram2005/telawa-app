import React, { useEffect, useMemo, useRef, useState } from "react";

/** --------- Arabic Normalization --------- **/
const AR_DIACRITICS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g;
const PUNCT = /[^\u0600-\u06FF\s]/g; // غير العربي
const TATWEEL = /\u0640/g;

function normalizeArabic(s) {
  return s
    .replace(AR_DIACRITICS, "")
    .replace(TATWEEL, "")
    .replace(PUNCT, " ")
    .replace(/[إأآا]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(a, b) {
  const m = a.length,
    n = b.length;
  if (!m) return n;
  if (!n) return m;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[m][n];
}

function similarityChars(a, b) {
  a = normalizeArabic(a);
  b = normalizeArabic(b);
  const maxLen = Math.max(a.length, b.length) || 1;
  const dist = levenshtein(a, b);
  return 1 - dist / maxLen;
}

/** --------- المكون الرئيسي --------- **/
export default function App() {
  const [pageNumber, setPageNumber] = useState(1);
  const [ayahs, setAyahs] = useState([]);
  const [isRecording, setIsRecording] = useState(false);

  const [ayahIdx, setAyahIdx] = useState(0);
  const [wordIdx, setWordIdx] = useState(0);

  const [wordStates, setWordStates] = useState([]);
  const [liveWord, setLiveWord] = useState(""); // الكلمة اللي بتتقال حالياً

  const recRef = useRef(null);
  const beepRef = useRef(null);

  const wordsByAyah = useMemo(() => {
    return ayahs.map((a) => normalizeArabic(a.text).split(" ").filter(Boolean));
  }, [ayahs]);

  // تحميل الآيات
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(
          `https://api.alquran.cloud/v1/page/${pageNumber}/quran-uthman`
        );
        const data = await res.json();
        if (data?.code === 200) {
          setAyahs(data.data.ayahs || []);
          const initStates = (data.data.ayahs || []).map((a) =>
            new Array(
              normalizeArabic(a.text).split(" ").filter(Boolean).length
            ).fill("pending")
          );
          setWordStates(initStates);
          setAyahIdx(0);
          setWordIdx(0);
        }
      } catch (e) {
        console.error("Fetch error:", e);
      }
    })();
  }, [pageNumber]);

  // beep بسيط
  useEffect(() => {
    const audio = new Audio(
      "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABYAAAACAAAAPwAA"
    );
    beepRef.current = audio;
  }, []);

  // تشغيل التعرف
  const start = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      alert("المتصفح لا يدعم التعرف على الصوت (جرّب Chrome).");
      return;
    }
    const rec = new SR();
    rec.lang = "ar-SA";
    rec.continuous = true;
    rec.interimResults = true;

    rec.onresult = (e) => {
      const r = e.results[e.results.length - 1];
      const text = r[0]?.transcript || "";
      const norm = normalizeArabic(text);

      if (!r.isFinal) {
        // interim: أظلل الكلمة الحالية
        const live = norm.split(" ").filter(Boolean).pop();
        setLiveWord(live || "");
      } else {
        // النتيجة النهائية
        setLiveWord("");
        const heardWords = norm.split(" ").filter(Boolean);
        heardWords.forEach((hw) => {
          processWord(hw);
        });
      }
    };

    rec.onend = () => {
      if (isRecording) {
        try {
          rec.start();
        } catch {}
      }
    };

    try {
      rec.start();
      recRef.current = rec;
      setIsRecording(true);
    } catch (err) {
      console.error(err);
    }
  };

  const stop = () => {
    setIsRecording(false);
    setLiveWord("");
    try {
      recRef.current && recRef.current.stop();
    } catch {}
  };

  const processWord = (heardWord) => {
    if (!wordsByAyah.length) return;

    let aIdx = ayahIdx;
    let wIdx = wordIdx;

    let expected = wordsByAyah[aIdx]?.[wIdx];
    if (!expected) return;

    const score = similarityChars(heardWord, expected);
    const pass = score >= 0.78;

    setWordStates((prev) => {
      const copy = prev.map((arr) => arr.slice());
      copy[aIdx][wIdx] = pass ? "correct" : "wrong";
      return copy;
    });

    if (pass) {
      const nextWordIdx = wIdx + 1;
      if (nextWordIdx < wordsByAyah[aIdx].length) {
        setWordIdx(nextWordIdx);
      } else {
        const nextAyahIdx = aIdx + 1;
        if (nextAyahIdx < wordsByAyah.length) {
          setAyahIdx(nextAyahIdx);
          setWordIdx(0);
        } else {
          setPageNumber((p) => Math.min(604, p + 1));
        }
      }
    } else {
      try {
        navigator.vibrate && navigator.vibrate(120);
      } catch {}
      try {
        if (beepRef.current) {
          beepRef.current.currentTime = 0;
          beepRef.current.play().catch(() => {});
        }
      } catch {}
    }
  };

  const isCurrent = (iAyah, iWord) => iAyah === ayahIdx && iWord === wordIdx;

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-3 text-center">
        📖 تطبيق تلاوة القرآن
      </h1>

      <div className="flex items-center justify-center gap-3 mb-4">
        <button
          className="px-3 py-1 rounded bg-gray-200"
          onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
        >
          ⬅️ السابق
        </button>
        <div className="flex items-center gap-2">
          <span>الصفحة</span>
          <input
            type="number"
            min={1}
            max={604}
            value={pageNumber}
            onChange={(e) =>
              setPageNumber(Math.min(604, Math.max(1, +e.target.value || 1)))
            }
            className="w-24 border rounded px-2 py-1 text-center"
          />
          <span>من 604</span>
        </div>
        <button
          className="px-3 py-1 rounded bg-gray-200"
          onClick={() => setPageNumber((p) => Math.min(604, p + 1))}
        >
          التالي ➡️
        </button>
      </div>

      <div className="flex justify-center mb-4">
        {!isRecording ? (
          <button
            onClick={start}
            className="px-5 py-2 rounded bg-green-600 text-white font-semibold"
          >
            🎙️ بدء التسجيل
          </button>
        ) : (
          <button
            onClick={stop}
            className="px-5 py-2 rounded bg-red-600 text-white font-semibold"
          >
            ⏹️ إيقاف
          </button>
        )}
      </div>

      <div
        dir="rtl"
        className="border rounded p-4 text-2xl leading-loose text-right"
        style={{ wordSpacing: "0.4em" }}
      >
        {ayahs.length === 0 ? (
          <p>جارٍ تحميل الصفحة...</p>
        ) : (
          ayahs.map((a, iAyah) => (
            <div key={a.number} className="mb-3">
              {a.text
                .split(" ")
                .filter(Boolean)
                .map((w, iWord) => {
                  const state = wordStates[iAyah]?.[iWord] || "pending";
                  const current = isCurrent(iAyah, iWord);

                  let classes = "";
                  if (state === "correct")
                    classes = "bg-green-200 rounded px-1";
                  else if (state === "wrong")
                    classes = "bg-red-200 rounded px-1";
                  else if (current) classes = "underline decoration-2";

                  // تظليل حي (أزرق فاتح) لو الكلمة اللي بتتقال دلوقتي
                  const expected = normalizeArabic(w);
                  if (
                    current &&
                    liveWord &&
                    similarityChars(liveWord, expected) > 0.5
                  ) {
                    classes = "bg-blue-200 rounded px-1";
                  }

                  return (
                    <span
                      key={iWord}
                      className={classes}
                      style={{ marginInline: 3 }}
                    >
                      {w}
                    </span>
                  );
                })}
              <span className="opacity-60"> ﴿{iAyah + 1}﴾</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
