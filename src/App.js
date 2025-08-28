import React, { useEffect, useMemo, useRef, useState } from "react";

/** --------- أدوات Arabic Normalization & Similarity --------- **/
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
  const s = a,
    t = b;
  const m = s.length,
    n = t.length;
  if (!m) return n;
  if (!n) return m;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1, // delete
        dp[i][j - 1] + 1, // insert
        dp[i - 1][j - 1] + cost // replace
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
  return 1 - dist / maxLen; // 0..1
}

/** --------- المكون الرئيسي --------- **/
export default function App() {
  const [pageNumber, setPageNumber] = useState(1);
  const [ayahs, setAyahs] = useState([]); // [{number,text,...}]
  const [isRecording, setIsRecording] = useState(false);

  // مؤشر المكان الحالي: آية وكلمة
  const [ayahIdx, setAyahIdx] = useState(0);
  const [wordIdx, setWordIdx] = useState(0);

  // حالات تلوين الكلمات لكل آية: "pending" | "correct" | "wrong"
  const [wordStates, setWordStates] = useState([]); // [[state,...], [...], ...]

  const recRef = useRef(null);
  const finalBufferRef = useRef(""); // نجمع النص النهائي
  const beepRef = useRef(null);

  // تقسيم الآيات لكلمات مُطبَّعة
  const wordsByAyah = useMemo(() => {
    return ayahs.map((a) => normalizeArabic(a.text).split(" ").filter(Boolean));
  }, [ayahs]);

  // تحميل الصفحة من API (الصيغة اللي طلبتها)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `https://api.alquran.cloud/v1/page/${pageNumber}/quran-uthman`
        );
        const data = await res.json();
        if (!cancelled && data?.code === 200) {
          setAyahs(data.data.ayahs || []);
          // إعادة الضبط للمؤشرات والتلوين
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
    return () => {
      cancelled = true;
    };
  }, [pageNumber]);

  // إعداد صوت تنبيه للغلط
  useEffect(() => {
    const audio = new Audio(
      "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABYAAAACAAAAPwAA"
    ); // tiny silent/beep-ish placeholder (safe)
    beepRef.current = audio;
  }, []);

  // تشغيل/إيقاف التعرف على الصوت
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
      // آخر نتيجة
      const r = e.results[e.results.length - 1];
      const text = r[0]?.transcript || "";
      const norm = normalizeArabic(text);

      // لو نهائي: ضمّه للمخزن ونقارن
      if (r.isFinal) {
        finalBufferRef.current += (finalBufferRef.current ? " " : "") + norm;
        processTranscript(norm, true);
      } else {
        // interim: هنقارن برضه لكن بدون تثبيت حالة "wrong" النهائية
        processTranscript(norm, false);
      }
    };

    rec.onend = () => {
      // استمرار فعلي
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
    try {
      recRef.current && recRef.current.stop();
    } catch {}
  };

  // مقارنة كلمة بالكلمة
  const processTranscript = (normText, commit) => {
    if (!wordsByAyah.length) return;

    let aIdx = ayahIdx;
    let wIdx = wordIdx;

    let expected = wordsByAyah[aIdx]?.[wIdx];
    if (!expected) return;

    // ناخد آخر كلمة اتقالت في الـ transcript (أو كذا كلمة ونطابق الأقرب)
    const heardWords = normText.split(" ").filter(Boolean);
    const lastHeard = heardWords[heardWords.length - 1] || "";

    // تشابه أحرف (مرن)
    const score = similarityChars(lastHeard, expected); // 0..1
    const pass = score >= 0.78; // عتبة معقولة

    // تحديث تلوين الكلمة الحالية فقط عند commit=true (نهائي)
    if (commit) {
      setWordStates((prev) => {
        const copy = prev.map((arr) => arr.slice());
        copy[aIdx][wIdx] = pass ? "correct" : "wrong";
        return copy;
      });

      if (pass) {
        // الكلمة صح → نتقدم
        const nextWordIdx = wIdx + 1;
        const wordsCount = wordsByAyah[aIdx].length;
        if (nextWordIdx < wordsCount) {
          setWordIdx(nextWordIdx);
        } else {
          // خلصت آية → انتقل للآية التالية
          const nextAyahIdx = aIdx + 1;
          if (nextAyahIdx < wordsByAyah.length) {
            setAyahIdx(nextAyahIdx);
            setWordIdx(0);
          } else {
            // خلصت الصفحة → انتقل تلقائيًا
            setPageNumber((p) => Math.min(604, p + 1));
            // نسيب المايك شغال كما هو
          }
        }
      } else {
        // خطأ: نهز/نصدر صوت
        try {
          navigator.vibrate && navigator.vibrate(120);
        } catch {}
        try {
          if (beepRef.current) {
            // البعض يمنع التشغيل من غير تفاعل؛ فلو ما اشتغلتش مفيش مشكلة
            beepRef.current.currentTime = 0;
            beepRef.current.play().catch(() => {});
          }
        } catch {}
      }
    }
    // لو مش commit (interim): ممكن ندي لمسة UI خفيفة لاحقًا (مثلاً underline)،
    // بس علشان البساطة هنا هنسيب اللون ثابت لآخر نتيجة نهائية.
  };

  // UI مساعد لإبراز الكلمة الحالية
  const isCurrent = (iAyah, iWord) => iAyah === ayahIdx && iWord === wordIdx;

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-3 text-center">
        📖 تطبيق تلاوة القرآن
      </h1>

      {/* تنقل الصفحات */}
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

      {/* أزرار التسجيل */}
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

      {/* عرض الآيات كلمة بكلمة مع التلوين */}
      <div
        dir="rtl"
        className="border rounded p-4 text-2xl leading-loose text-right"
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
                  const classes =
                    state === "correct"
                      ? "bg-green-200 rounded px-1"
                      : state === "wrong"
                      ? "bg-red-200 rounded px-1"
                      : current
                      ? "underline decoration-2"
                      : "";

                  return (
                    <span
                      key={iWord}
                      className={classes}
                      style={{ marginInline: 2 }}
                    >
                      {w}
                    </span>
                  );
                })}
              {/* رقم الآية */}
              <span className="opacity-60"> ﴿{iAyah + 1}﴾</span>
            </div>
          ))
        )}
      </div>

      <p className="text-center mt-3 text-sm opacity-70">
        تلميح: لو لقيت التعرف وقف فجأة، الزر «بدء التسجيل» يعيد تشغيله فورًا.
      </p>
    </div>
  );
}
