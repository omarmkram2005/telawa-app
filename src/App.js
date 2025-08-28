import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mic,
  MicOff,
  Volume2,
  Loader2,
  ChevronRight,
  ChevronLeft,
  BookOpen,
  RefreshCw,
  ListFilter,
  Info,
} from "lucide-react";

// --- UI helpers (Tailwind + minimal shadcn-like primitives)
const Button = ({
  className = "",
  disabled,
  onClick,
  children,
  type = "button",
  variant = "default",
}) => (
  <button
    type={type}
    disabled={disabled}
    onClick={onClick}
    className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-medium shadow-sm transition active:scale-[.98]
      ${
        variant === "default"
          ? "bg-black text-white hover:bg-black/90"
          : "bg-white border border-black/10 hover:bg-black/5"
      }
      disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
  >
    {children}
  </button>
);

const Card = ({ className = "", children }) => (
  <div
    className={`rounded-3xl border border-black/10 bg-white shadow-sm ${className}`}
  >
    {children}
  </div>
);

const CardContent = ({ className = "", children }) => (
  <div className={`p-4 md:p-6 ${className}`}>{children}</div>
);

const Label = ({ htmlFor, children }) => (
  <label
    htmlFor={htmlFor}
    className="text-xs font-semibold text-gray-600 tracking-wide"
  >
    {children}
  </label>
);

// ---- App ----
export default function QuranLiveRecitationApp() {
  const [apiBase, setApiBase] = useState("https://api.quran.com/api/v4");
  const [chapters, setChapters] = useState([]); // [{id, name_arabic, name_simple, pages?: [start, end]}]
  const [selectedChapterId, setSelectedChapterId] = useState(1);

  const [page, setPage] = useState(1); // Mushaf Madani typically 604 pages
  const [maxPages, setMaxPages] = useState(604);

  const [verses, setVerses] = useState([]); // list with words
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [listening, setListening] = useState(false);
  const [mistakes, setMistakes] = useState(0);
  const [startedAt, setStartedAt] = useState(null);

  // word stream management
  const flatWords = useMemo(() => {
    // Flatten all words across verses while keeping pointers
    const arr = [];
    verses.forEach((v, vi) => {
      if (v.words && v.words.length) {
        v.words.forEach((w, wi) => {
          const text =
            w.text || w.text_uthmani || w.text_indopak || w.code_v1 || "";
          if (!text) return;
          arr.push({
            vi,
            wi,
            verse_key: v.verse_key,
            page: v.page_number || page,
            text: text,
            status: "pending", // pending | correct | incorrect
          });
        });
      } else if (v.text_uthmani) {
        v.text_uthmani.split(/\s+/).forEach((word, wi) => {
          arr.push({
            vi,
            wi,
            verse_key: v.verse_key,
            page: v.page_number || page,
            text: word,
            status: "pending",
          });
        });
      } else if (v.text_imlaei_simple) {
        v.text_imlaei_simple.split(/\s+/).forEach((word, wi) => {
          arr.push({
            vi,
            wi,
            verse_key: v.verse_key,
            page: v.page_number || page,
            text: word,
            status: "pending",
          });
        });
      }
    });
    return arr;
  }, [verses, page]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const currentWord = flatWords[currentIndex] || null;

  // Speech Recognition setup
  const recognitionRef = useRef(null);
  const transcriptRef = useRef("");

  // Helpers
  const beep = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g);
      g.connect(ctx.destination);
      o.type = "sine";
      o.frequency.value = 440;
      g.gain.value = 0.05;
      o.start();
      setTimeout(() => {
        o.stop();
        ctx.close();
      }, 180);
    } catch {}
  };

  const vibrate = (ms = 120) => {
    if (navigator.vibrate) navigator.vibrate(ms);
  };

  const stripDiacritics = (str) =>
    (str || "")
      .normalize("NFKD")
      .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, "") // harakat + Quran marks
      .replace(/[\u0640]/g, "") // tatweel
      .replace(/[\u0610-\u061A\u06F0-\u06F9\u0660-\u0669]/g, (d) => {
        // Eastern Arabic digits -> western digits (not strictly needed here)
        const map = {
          "\u06F0": "0",
          "\u06F1": "1",
          "\u06F2": "2",
          "\u06F3": "3",
          "\u06F4": "4",
          "\u06F5": "5",
          "\u06F6": "6",
          "\u06F7": "7",
          "\u06F8": "8",
          "\u06F9": "9",
          "\u0660": "0",
          "\u0661": "1",
          "\u0662": "2",
          "\u0663": "3",
          "\u0664": "4",
          "\u0665": "5",
          "\u0666": "6",
          "\u0667": "7",
          "\u0668": "8",
          "\u0669": "9",
        };
        return map[d] || "";
      })
      .replace(/[\u061B\u061F\u060C\,\.;:!«»\(\)\[\]\-\–\—\?\!\"\'\،\؛]/g, "")
      .replace(/\s+/g, " ")
      .trim();

  const wordsEqual = (a, b) => stripDiacritics(a) === stripDiacritics(b);

  const pickLastWord = (str) => {
    const s = stripDiacritics(str);
    const parts = s.split(/\s+/).filter(Boolean);
    return parts[parts.length - 1] || "";
  };

  // Fetch chapters (surah list)
  useEffect(() => {
    const fetchChapters = async () => {
      try {
        const res = await fetch(`${apiBase}/chapters?language=ar`);
        const data = await res.json();
        if (data?.chapters) {
          setChapters(data.chapters);
        }
      } catch (e) {
        /* ignore */
      }
    };
    fetchChapters();
  }, [apiBase]);

  // Fetch verses for page
  useEffect(() => {
    const controller = new AbortController();
    const run = async () => {
      setLoading(true);
      setError("");
      try {
        const url = `${apiBase}/verses/by_page/${page}?language=ar&words=true&word_fields=text_uthmani,text_indopak,code_v1&fields=page_number,verse_key`;
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setVerses(data?.verses || []);
        setCurrentIndex(0);
        setMistakes(0);
        setStartedAt(Date.now());
      } catch (e) {
        setError("تعذر تحميل آيات الصفحة. جرّب صفحة أخرى أو تأكد من الاتصال.");
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    run();
    return () => controller.abort();
  }, [apiBase, page]);

  // Handle recognition lifecycle
  const startListening = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      alert("متصفحك لا يدعم التعرف على الكلام (Web Speech API). جرّب كروم.");
      return;
    }
    const rec = new SR();
    rec.lang = "ar-EG"; // Arabic (Egypt). You may switch to "ar-SA" depending on your recitation.
    rec.continuous = true;
    rec.interimResults = true;

    rec.onstart = () => {
      transcriptRef.current = "";
      setListening(true);
      if (!startedAt) setStartedAt(Date.now());
    };
    rec.onerror = (e) => {
      console.error(e);
    };
    rec.onend = () => {
      setListening(false);
    };

    rec.onresult = (ev) => {
      let interim = "";
      let finalText = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const res = ev.results[i];
        if (res.isFinal) finalText += res[0].transcript + " ";
        else interim += res[0].transcript + " ";
      }
      const spoken = (finalText || interim).trim();
      transcriptRef.current = spoken;

      if (!currentWord) return;

      const expected = currentWord.text;
      const lastSpokenWord = pickLastWord(spoken);

      if (!lastSpokenWord) return;

      if (wordsEqual(expected, lastSpokenWord)) {
        // mark correct and advance
        setCurrentIndex((idx) => {
          const next = idx + 1;
          if (next >= flatWords.length) {
            // Reached end of page -> auto advance page and keep mic
            setTimeout(() => {
              setPage((p) => (p < maxPages ? p + 1 : 1));
            }, 250);
          }
          return next;
        });
      } else if (finalText) {
        // Only count mistakes on finalized chunks to avoid noisy interim
        setMistakes((m) => m + 1);
        vibrate(100);
        beep();
      }
    };

    recognitionRef.current = rec;
    try {
      rec.start();
    } catch {
      /* sometimes throws if already started */
    }
  };

  const stopListening = () => {
    try {
      recognitionRef.current?.stop();
    } catch {}
    setListening(false);
  };

  const toggleMic = () => (listening ? stopListening() : startListening());

  const goNextPage = () => setPage((p) => (p < maxPages ? p + 1 : p));
  const goPrevPage = () => setPage((p) => (p > 1 ? p - 1 : p));

  const progressPct = useMemo(
    () =>
      flatWords.length
        ? Math.min(100, Math.round((currentIndex / flatWords.length) * 100))
        : 0,
    [currentIndex, flatWords.length]
  );

  const elapsed = useMemo(() => {
    if (!startedAt) return "—";
    const sec = Math.floor((Date.now() - startedAt) / 1000);
    const m = Math.floor(sec / 60),
      s = sec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }, [startedAt, currentIndex, page]);

  const onSelectChapter = async (id) => {
    setSelectedChapterId(id);
    // Try to jump to the first page of the surah if API provides that.
    try {
      const res = await fetch(`${apiBase}/chapters/${id}?language=ar`);
      const data = await res.json();
      const ch = data?.chapter;
      if (ch?.pages && Array.isArray(ch.pages)) {
        const start = Array.isArray(ch.pages) ? ch.pages[0] : null;
        if (start) setPage(start);
      }
    } catch {}
  };

  // decorate verses words with status from flatWords
  const versesWithStatus = useMemo(() => {
    const map = new Map();
    flatWords.forEach((w, idx) => {
      map.set(`${w.vi}-${w.wi}`, idx);
    });
    return verses.map((v, vi) => {
      const words = (
        v.words && v.words.length
          ? v.words
          : (v.text_uthmani || "").split(/\s+/).map((t) => ({ text: t }))
      ).map((w, wi) => {
        const idx = map.get(`${vi}-${wi}`);
        let status = "pending";
        if (typeof idx === "number") {
          if (idx < currentIndex) status = "correct";
          else if (idx === currentIndex && transcriptRef.current) {
            const last = pickLastWord(transcriptRef.current);
            status = wordsEqual(w.text || "", last) ? "correct" : "pending";
          }
        }
        return { ...w, status };
      });
      return { ...v, words };
    });
  }, [verses, flatWords, currentIndex]);

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-gray-50 to-white text-gray-900">
      <div className="mx-auto max-w-6xl px-4 md:px-6 py-6 md:py-10">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <BookOpen className="w-8 h-8" />
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
                تلاوة القرآن – فحص لحظي
              </h1>
              <p className="text-sm text-gray-600">
                اقرأ وتتبّع الكلمات كلمةً بكلمة، مع تمييز الأخطاء و الانتقال
                التلقائي بين الصفحات.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={toggleMic}
              variant={listening ? "default" : "default"}
              className={listening ? "bg-green-600 hover:bg-green-600/90" : ""}
            >
              {listening ? (
                <Mic className="w-4 h-4" />
              ) : (
                <MicOff className="w-4 h-4" />
              )}
              {listening ? "الميكروفون يعمل" : "تشغيل الميكروفون"}
            </Button>
            <Button
              onClick={() => {
                setCurrentIndex(0);
                setMistakes(0);
                setStartedAt(Date.now());
              }}
              variant="outline"
            >
              <RefreshCw className="w-4 h-4" />
              إعادة تعيين الصفحة
            </Button>
          </div>
        </div>

        {/* Controls */}
        <Card className="mt-6">
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6 items-end">
              <div className="md:col-span-4">
                <Label htmlFor="surah">اختر السورة</Label>
                <div className="flex items-center gap-2">
                  <select
                    id="surah"
                    className="w-full rounded-2xl border border-black/10 p-2.5 bg-white focus:outline-none"
                    value={selectedChapterId}
                    onChange={(e) => onSelectChapter(Number(e.target.value))}
                  >
                    {chapters.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name_arabic} ({c.name_simple})
                      </option>
                    ))}
                  </select>
                  <ListFilter className="w-5 h-5 text-gray-500" />
                </div>
              </div>

              <div className="md:col-span-3">
                <Label htmlFor="page">رقم الصفحة (حفص/المدينة)</Label>
                <input
                  id="page"
                  type="number"
                  min={1}
                  max={maxPages}
                  value={page}
                  onChange={(e) =>
                    setPage(
                      Math.max(
                        1,
                        Math.min(maxPages, Number(e.target.value) || 1)
                      )
                    )
                  }
                  className="w-full rounded-2xl border border-black/10 p-2.5 bg-white focus:outline-none"
                />
              </div>

              <div className="md:col-span-3">
                <Label htmlFor="api">رابط الـ API</Label>
                <input
                  id="api"
                  type="text"
                  value={apiBase}
                  onChange={(e) => setApiBase(e.target.value)}
                  className="w-full rounded-2xl border border-black/10 p-2.5 bg-white focus:outline-none"
                />
                <p className="text-[11px] text-gray-500 mt-1">
                  افتراضي: api.quran.com/api/v4
                </p>
              </div>

              <div className="md:col-span-2 flex items-center gap-2 md:justify-end">
                <Button onClick={goPrevPage} variant="outline">
                  <ChevronRight className="w-4 h-4" />
                  السابقة
                </Button>
                <Button onClick={goNextPage} variant="outline">
                  اللاحقة
                  <ChevronLeft className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardContent>
              <div className="text-xs text-gray-500">التقدم</div>
              <div className="mt-1 h-2 w-full rounded-full bg-gray-200 overflow-hidden">
                <div
                  className="h-full bg-black"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <div className="mt-2 text-sm">{progressPct}%</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <div className="text-xs text-gray-500">عدد الأخطاء</div>
              <div className="text-xl font-bold">{mistakes}</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <div className="text-xs text-gray-500">الزمن المنقضي</div>
              <div className="text-xl font-bold">{elapsed}</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <div className="text-xs text-gray-500">الحالة</div>
              <div className="flex items-center gap-2 mt-1">
                {listening ? (
                  <Mic className="w-4 h-4" />
                ) : (
                  <MicOff className="w-4 h-4" />
                )}
                <span className="text-sm">
                  {listening ? "يسجّل الآن" : "متوقّف"}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Content */}
        <Card className="mt-6">
          <CardContent>
            {loading ? (
              <div className="flex items-center gap-3 text-gray-600">
                <Loader2 className="w-4 h-4 animate-spin" /> تحميل آيات الصفحة…
              </div>
            ) : error ? (
              <div className="text-red-600 text-sm">{error}</div>
            ) : (
              <div
                className="space-y-6 leading-[2.4] text-xl md:text-2xl font-[650] text-gray-900 selection:bg-black selection:text-white"
                dir="rtl"
              >
                {versesWithStatus.map((v, vi) => (
                  <div key={vi} className="">
                    <div className="text-sm text-gray-500 mb-1">
                      {v.verse_key}
                    </div>
                    <div className="">
                      {v.words.map((w, wi) => (
                        <motion.span
                          key={wi}
                          layout
                          className={`px-1 rounded-md inline-block mr-1 mb-1 transition
                            ${
                              w.status === "correct"
                                ? "bg-green-200"
                                : w.status === "incorrect"
                                ? "bg-red-200"
                                : "hover:bg-gray-100"
                            }
                          `}
                        >
                          {w.text || w.text_uthmani || w.text_indopak || ""}
                        </motion.span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Legend */}
        <div className="flex items-start gap-2 mt-4 text-xs text-gray-600">
          <Info className="w-4 h-4 mt-0.5" />
          <div>
            <div>
              الكلمة الصحيحة = أخضر. عند عدم التطابق سيظهر اهتزاز/صوت وتظل
              الكلمة التالية مطلوبة.
            </div>
            <div>
              عند نهاية الصفحة ينتقل التطبيق تلقائيًا للصفحة التالية مع بقاء
              الميكروفون يعمل.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-10 text-center text-xs text-gray-500">
          ملاحظة: يتطلب التعرف على الكلام دعم متصفحك لـ Web Speech API (كروم
          مفضّل). جودة المطابقة تعتمد على وضوح النطق واللهجة.
        </div>
      </div>
    </div>
  );
}
