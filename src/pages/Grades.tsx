import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  RefreshCw,
  Sparkles,
  User,
  History,
} from "lucide-react";
import { supabase } from "../lib/supabaseClient";

/* ================================================================== */
/*  Types                                                             */
/* ================================================================== */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;
type PageStatus = "loading" | "ready" | "no-user" | "error";
type GradeState = "passed" | "review" | "failed";

interface Attempt {
  id: number;
  score: number;
  maxScore: number;
  percentage: number;
  state: GradeState;
  feedback: string;
  submittedAt: string;
}

interface GroupedGrade {
  quizId: any;
  courseName: string;
  instructor: string;
  category: string;
  attempts: Attempt[];
  bestScore: number;
  maxScore: number;
}

const PASS_MARK = 50;
const LOCALE = "ar-EG-u-nu-latn";

const STATE_STYLE: Record<GradeState, { label: string; className: string }> = {
  passed: { label: "ناجح", className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  review: { label: "قيد المراجعة", className: "border-amber-200 bg-amber-50 text-amber-700" },
  failed: { label: "لم يجتز", className: "border-rose-200 bg-rose-50 text-rose-700" },
};

/* ================================================================== */
/*  Helpers                                                           */
/* ================================================================== */

const cx = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(" ");

const errorMessage = (err: unknown): string => {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object" && "message" in err) {
    return String((err as { message: unknown }).message);
  }
  return String(err);
};

const formatDate = (value?: string | null) => {
  if (!value) return "";
  const t = Date.parse(String(value).replace(" ", "T"));
  return Number.isNaN(t) ? String(value) : new Date(t).toLocaleDateString(LOCALE, { dateStyle: "medium" });
};

/* ================================================================== */
/*  Page                                                              */
/* ================================================================== */

export default function GradesPage() {
  const [status, setStatus] = useState<PageStatus>("loading");
  const [loadError, setLoadError] = useState("");
  const [groupedGrades, setGroupedGrades] = useState<GroupedGrade[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setStatus("loading");

    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        setStatus("no-user");
        return;
      }

      const { data: subs, error } = await supabase
        .from("student_submissions")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;

      const rows = subs ?? [];
      const quizIds = [...new Set(rows.map((r: Row) => r.quiz_id).filter(Boolean))];

      let quizzes: Row[] = [];
      let courses: Row[] = [];
      if (quizIds.length > 0) {
        const { data: q } = await supabase.from("quizzes").select("*").in("id", quizIds);
        quizzes = q ?? [];
        const courseIds = [...new Set(quizzes.map((x) => x.course_id).filter(Boolean))];
        if (courseIds.length > 0) {
          const { data: c } = await supabase.from("courses").select("*").in("id", courseIds);
          courses = c ?? [];
        }
      }

      const quizMap = new Map(quizzes.map((q) => [q.id, q]));
      const courseMap = new Map(courses.map((c) => [c.id, c]));

      // تجميع المحاولات حسب quiz_id
      const mapByQuiz = new Map<any, GroupedGrade>();

      rows.forEach((row: Row) => {
        const quizId = row.quiz_id || "general";
        const quiz = quizMap.get(row.quiz_id);
        const course = quiz ? courseMap.get(quiz.course_id) : undefined;

        const score = Number(row.score) || 0;
        const maxScore = Number(row.max_score) > 0 ? Number(row.max_score) : 100;
        const percentage = Math.round((score / maxScore) * 100);
        const graded = row.status === "تم التصحيح" || row.status === "graded" || row.score != null;
        const state: GradeState = !graded ? "review" : percentage >= PASS_MARK ? "passed" : "failed";

        const attempt: Attempt = {
          id: row.id,
          score,
          maxScore,
          percentage,
          state,
          feedback: row.feedback || row.notes || "",
          submittedAt: row.submission_time || row.created_at || "",
        };

        if (!mapByQuiz.has(quizId)) {
          mapByQuiz.set(quizId, {
            quizId,
            courseName: row.course_name || quiz?.course_name || course?.course_name || "غير مححدد",
            instructor: quiz?.teacher_name || quiz?.instructor || course?.instructor || "غير محدد",
            category: row.specialty || course?.course_specialty || quiz?.course_specialty || "عام",
            attempts: [],
            bestScore: score,
            maxScore,
          });
        }

        const group = mapByQuiz.get(quizId)!;
        group.attempts.push(attempt);
        if (score > group.bestScore) {
          group.bestScore = score;
        }
      });

      setGroupedGrades(Array.from(mapByQuiz.values()));
      setStatus("ready");
    } catch (err) {
      console.error("خطأ في جلب الدرجات:", err);
      setLoadError(errorMessage(err));
      setStatus("error");
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const summary = useMemo(() => {
    let totalAttempts = 0;
    let passedCount = 0;
    let reviewCount = 0;

    groupedGrades.forEach((g) => {
      totalAttempts += g.attempts.length;
      if (g.attempts.some((a) => a.state === "passed")) passedCount++;
      if (g.attempts.some((a) => a.state === "review")) reviewCount++;
    });

    return {
      totalQuizzes: groupedGrades.length,
      totalAttempts,
      passedCount,
      reviewCount,
    };
  }, [groupedGrades]);

  return (
    <div className="mx-auto min-h-screen w-full space-y-6 text-slate-800 sm:space-y-8" dir="rtl">
      {/* ------------------------------ Header ------------------------------ */}
      <header className="relative overflow-hidden rounded-2xl border border-white/20 bg-gradient-to-br from-emerald-600 via-blue-600 to-indigo-700 p-5 text-white shadow-xl sm:rounded-3xl sm:p-8">
        <div aria-hidden className="pointer-events-none absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <div className="relative flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
          <div className="space-y-2 sm:space-y-3">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-white/20 px-3 py-1 text-[11px] font-bold text-white shadow-xs backdrop-blur-md sm:text-xs">
              <Sparkles size={14} />
              لوحة متابعة الدرجات والمحاولات، منصة
              <span dir="ltr" className="tracking-[0.3em]">
                ZED
              </span>
            </span>
            <h1 className="text-xl font-black leading-tight tracking-tight sm:text-3xl lg:text-4xl">
              سجل إنجازاتك ومحاولاتك الفعلية 📊
            </h1>
            <p className="max-w-2xl text-xs leading-relaxed text-blue-100 sm:text-sm">
              يتم تجميع كافة محاولاتك لكل اختبار داخل كرت موحد لتتمكن من متابعة تطور مستواك بكل سهولة.
            </p>
          </div>

          <Link
            to="/courses"
            className="flex shrink-0 items-center justify-center gap-2 self-stretch rounded-xl bg-white px-4 py-2.5 text-xs font-black text-blue-700 shadow-md transition-all hover:bg-blue-50 active:scale-95 sm:self-auto sm:rounded-2xl sm:px-5 sm:py-3"
          >
            <ArrowRight size={16} />
            العودة للكورسات
          </Link>
        </div>
      </header>

      {/* ------------------------------ Summary ------------------------------ */}
      {status === "ready" && groupedGrades.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          {(
            [
              ["الاختبارات المُجتازة", String(summary.totalQuizzes), "text-slate-900"],
              ["إجمالي المحاولات", String(summary.totalAttempts), "text-blue-600"],
              ["اختار بنجاح", String(summary.passedCount), "text-emerald-600"],
              ["قيد المراجعة", String(summary.reviewCount), "text-amber-600"],
            ] as const
          ).map(([label, value, color]) => (
            <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
              <p className={cx("text-2xl font-black tabular-nums", color)}>{value}</p>
              <p className="mt-0.5 text-[11px] font-bold text-slate-500">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* ------------------------------ List ------------------------------ */}
      <section className="space-y-4 sm:space-y-6">
        <div className="flex items-center justify-between gap-3 px-1">
          <h2 className="flex items-center gap-2 text-base font-black text-slate-800 sm:text-lg">
            <FileText size={20} className="text-blue-600" />
            سجل الاختبارات والمحاولات المسجلة
          </h2>
          {status === "ready" && (
            <button
              type="button"
              onClick={() => void load(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw size={13} className={refreshing ? "animate-spin" : undefined} />
              تحديث
            </button>
          )}
        </div>

        {status === "loading" ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-slate-200 bg-white py-20 text-center shadow-xs">
            <Loader2 size={36} className="animate-spin text-blue-600" />
            <p className="text-xs font-bold text-slate-600">جاري جلب درجاتك...</p>
          </div>
        ) : status === "no-user" ? (
          <div className="space-y-3 rounded-3xl border border-slate-200 bg-white px-4 py-16 text-center shadow-xs">
            <AlertTriangle size={40} className="mx-auto text-amber-500" />
            <p className="text-sm font-bold text-slate-700">يجب تسجيل الدخول لعرض درجاتك.</p>
          </div>
        ) : status === "error" ? (
          <div className="space-y-3 rounded-3xl border border-slate-200 bg-white px-4 py-16 text-center shadow-xs">
            <AlertTriangle size={40} className="mx-auto text-rose-500" />
            <p className="text-sm font-bold text-slate-700">تعذّر جلب الدرجات.</p>
            <p className="mx-auto max-w-md text-xs text-slate-500">{loadError}</p>
            <button
              type="button"
              onClick={() => void load()}
              className="rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-blue-700"
            >
              إعادة المحاولة
            </button>
          </div>
        ) : groupedGrades.length === 0 ? (
          <div className="space-y-3 rounded-3xl border border-slate-200 bg-white px-4 py-16 text-center shadow-xs">
            <BarChart3 size={40} className="mx-auto text-blue-400" />
            <p className="text-sm font-bold text-slate-700">لا توجد درجات مسجلة حتى الآن.</p>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 sm:gap-6">
            {groupedGrades.map((group, idx) => {
              return (
                <li
                  key={idx}
                  className="group flex flex-col justify-between space-y-4 rounded-2xl border-2 border-slate-200/80 bg-white p-4 shadow-sm transition-all duration-300 hover:border-blue-500 hover:shadow-xl sm:space-y-5 sm:rounded-3xl sm:p-6"
                >
                  <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <span className="max-w-[130px] truncate rounded-lg border border-slate-200 bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-700">
                      {group.category}
                    </span>
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-black text-blue-700">
                      <History size={12} />
                      عدد المحاولات: {group.attempts.length}
                    </span>
                  </div>

                  <div className="flex-1 space-y-3">
                    <div className="space-y-1">
                      <span className="block text-[10px] font-bold text-slate-400">اسم المادة / الكورس</span>
                      <h3 className="text-sm font-black leading-snug text-slate-900 transition-colors group-hover:text-blue-600 sm:text-base">
                        {group.courseName}
                      </h3>
                    </div>

                    <div className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 p-2.5 text-xs text-slate-600">
                      <User size={14} className="shrink-0 text-blue-500" />
                      <span className="text-[10px] text-slate-400">المعلم:</span>
                      <span className="truncate font-bold text-slate-700">{group.instructor}</span>
                    </div>
                  </div>

                  {/* تفاصيل المحاولات المتعددة داخل نفس الكرت */}
                  <div className="space-y-2.5 border-t border-slate-100 pt-3 text-xs font-semibold">
                    <span className="block text-[11px] font-black text-slate-700">سجل المحاولات ({group.attempts.length}):</span>
                    
                    <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                      {group.attempts.map((att, attIdx) => {
                        const style = STATE_STYLE[att.state];
                        return (
                          <div key={att.id || attIdx} className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2 text-[11px]">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-slate-700">المحاولة #{group.attempts.length - attIdx}</span>
                              <span className={cx("px-2 py-0.5 rounded-full border text-[10px] font-black", style.className)}>
                                {att.state === "review" ? <Clock size={10} className="inline ml-1" /> : <CheckCircle2 size={10} className="inline ml-1" />}
                                {style.label}
                              </span>
                            </div>

                            {att.state !== "review" && (
                              <div className="flex items-center justify-between text-slate-600">
                                <span>الدرجة:</span>
                                <strong className="text-blue-700 font-black">{att.score} / {att.maxScore}</strong>
                              </div>
                            )}

                            {att.feedback && (
                              <p className="text-amber-800 bg-amber-50 p-1.5 rounded border border-amber-200">
                                <strong>ملاحظات:</strong> {att.feedback}
                              </p>
                            )}

                            {att.submittedAt && (
                              <p className="text-[9px] text-slate-400">التاريخ: {formatDate(att.submittedAt)}</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
