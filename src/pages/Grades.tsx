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
  Award,
  BookOpen
} from "lucide-react";
import { supabase } from "../lib/supabaseClient";

/* ================================================================== */
/*  Types                                                             */
/* ================================================================== */

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

const STATE_STYLE: Record<GradeState, { label: string; className: string; icon: any }> = {
  passed: { label: "ناجح", className: "border-emerald-200 bg-emerald-50/80 text-emerald-700", icon: CheckCircle2 },
  review: { label: "قيد المراجعة", className: "border-amber-200 bg-amber-50/80 text-amber-700", icon: Clock },
  failed: { label: "لم يجتز", className: "border-rose-200 bg-rose-50/80 text-rose-700", icon: AlertTriangle },
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
            courseName: row.course_name || quiz?.course_name || course?.course_name || "غير محدد",
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
          group.maxScore = maxScore;
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
    <div className="mx-auto min-h-screen w-full space-y-6 text-slate-800 sm:space-y-8 pb-12" dir="rtl">
      
      {/* ------------------------------ Header ------------------------------ */}
      <header className="relative overflow-hidden rounded-3xl border border-white/20 bg-gradient-to-l from-indigo-900 via-slate-900 to-blue-950 p-6 sm:p-8 text-white shadow-xl">
        <div aria-hidden className="pointer-events-none absolute -bottom-10 -left-10 h-56 w-56 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="relative flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
          <div className="space-y-3">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/10 px-3.5 py-1 text-xs font-semibold text-indigo-200 backdrop-blur-md">
              <Sparkles size={14} className="text-amber-400" />
              منصة Z E D - لوحة متابعة إنجازاتك
            </span>
            <h1 className="text-2xl font-black tracking-tight sm:text-3xl lg:text-4xl">
              سجل اختباراتك ومحاولاتك الذكية 📊
            </h1>
            <p className="max-w-2xl text-xs leading-relaxed text-slate-300 sm:text-sm">
              متابعة شاملة لتطور مستواك الأكاديمي، يتم تجميع جميع محاولاتك لكل اختبار داخل بطاقة واحدة لسهولة المراجعة.
            </p>
          </div>

          <Link
            to="/courses"
            className="flex shrink-0 items-center justify-center gap-2 self-stretch rounded-2xl bg-white px-5 py-3 text-xs font-black text-indigo-950 shadow-md transition-all hover:bg-indigo-50 active:scale-95 sm:self-auto"
          >
            <ArrowRight size={16} />
            العودة للكورسات
          </Link>
        </div>
      </header>

      {/* ------------------------------ Summary ------------------------------ */}
      {status === "ready" && groupedGrades.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            {
              label: "الاختبارات المسجلة",
              value: String(summary.totalQuizzes),
              color: "text-indigo-600",
              bg: "bg-indigo-50/80 border-indigo-100",
              icon: BookOpen,
            },
            {
              label: "إجمالي المحاولات",
              value: String(summary.totalAttempts),
              color: "text-blue-600",
              bg: "bg-blue-50/80 border-blue-100",
              icon: History,
            },
            {
              label: "اختبارات مجتازة",
              value: String(summary.passedCount),
              color: "text-emerald-600",
              bg: "bg-emerald-50/80 border-emerald-100",
              icon: CheckCircle2,
            },
            {
              label: "قيد المراجعة",
              value: String(summary.reviewCount),
              color: "text-amber-600",
              bg: "bg-amber-50/80 border-amber-100",
              icon: Clock,
            },
          ].map(({ label, value, color, bg, icon: Icon }) => (
            <div
              key={label}
              className={cx(
                "relative overflow-hidden rounded-3xl border p-5 shadow-sm transition-all duration-300 hover:shadow-md",
                bg
              )}
            >
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className={cx("text-3xl font-black tabular-nums tracking-tight", color)}>
                    {value}
                  </p>
                  <p className="text-xs font-bold text-slate-600">{label}</p>
                </div>
                <div className={cx("rounded-2xl p-3 bg-white shadow-xs", color)}>
                  <Icon size={22} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ------------------------------ List ------------------------------ */}
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3 px-1">
          <h2 className="flex items-center gap-2 text-base font-black text-slate-800 sm:text-lg">
            <FileText size={20} className="text-indigo-600" />
            البطاقات المجمعة للاختبارات
          </h2>
          {status === "ready" && (
            <button
              type="button"
              onClick={() => void load(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 transition-all hover:bg-slate-50 disabled:opacity-50 cursor-pointer shadow-2xs"
            >
              <RefreshCw size={13} className={refreshing ? "animate-spin" : undefined} />
              <span>تحديث البيانات</span>
            </button>
          )}
        </div>

        {status === "loading" ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-slate-200 bg-white py-24 text-center shadow-xs">
            <Loader2 size={36} className="animate-spin text-indigo-600" />
            <p className="text-xs font-bold text-slate-600">جاري جلب سجل درجاتك...</p>
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
              className="rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-indigo-700"
            >
              إعادة المحاولة
            </button>
          </div>
        ) : groupedGrades.length === 0 ? (
          <div className="space-y-3 rounded-3xl border border-slate-200 bg-white px-4 py-16 text-center shadow-xs">
            <BarChart3 size={40} className="mx-auto text-indigo-400" />
            <p className="text-sm font-bold text-slate-700">لا توجد درجات أو اختبارات مسجلة حتى الآن.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {groupedGrades.map((group, idx) => {
              const bestAttempt = group.attempts.reduce((prev, current) => 
                (current.score > prev.score) ? current : prev, group.attempts[0]
              );
              const bestPercentage = bestAttempt ? bestAttempt.percentage : 0;

              return (
                <div
                  key={idx}
                  className="group relative bg-white border border-slate-200/90 rounded-3xl p-6 shadow-sm hover:shadow-2xl hover:border-indigo-400 transition-all duration-300 flex flex-col justify-between space-y-6 overflow-hidden"
                >
                  {/* شريط تزييني علوي */}
                  <div className="absolute top-0 right-0 left-0 h-1.5 bg-gradient-to-r from-indigo-500 via-blue-500 to-emerald-500" />

                  {/* رأس الكرت */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-black bg-indigo-50 text-indigo-700 border border-indigo-100 shadow-2xs">
                        <BookOpen size={13} />
                        {group.category}
                      </span>
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black bg-slate-100 text-slate-700 border border-slate-200">
                        <History size={13} className="text-indigo-600" />
                        {group.attempts.length} محاولات
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      <h3 className="text-base font-black text-slate-900 group-hover:text-indigo-600 transition-colors leading-snug">
                        {group.courseName}
                      </h3>
                      <div className="flex items-center gap-2 text-xs text-slate-500 pt-1">
                        <User size={14} className="text-indigo-500 shrink-0" />
                        <span>المعلم:</span>
                        <span className="font-bold text-slate-700">{group.instructor}</span>
                      </div>
                    </div>

                    {/* صندوق أفضل نتيجة بتصميم مميز */}
                    <div className="bg-gradient-to-br from-slate-50 to-indigo-50/30 border border-slate-200/80 rounded-2xl p-4 space-y-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-600 flex items-center gap-1.5">
                          <Award size={16} className="text-amber-500" /> أفضل نتيجة:
                        </span>
                        <span className="font-black text-slate-900 text-sm">
                          {bestAttempt?.score} <span className="text-xs text-slate-400">/ {bestAttempt?.maxScore}</span>
                        </span>
                      </div>

                      {/* شريط النسبة المئوية */}
                      <div className="w-full bg-slate-200/80 rounded-full h-2.5 overflow-hidden p-0.5">
                        <div 
                          className={cx(
                            "h-full rounded-full transition-all duration-500 shadow-xs",
                            bestPercentage >= 50 ? "bg-emerald-500" : "bg-rose-500"
                          )} 
                          style={{ width: `${Math.min(bestPercentage, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* سجل المحاولات التفصيلي */}
                  <div className="space-y-3 pt-3 border-t border-slate-100">
                    <span className="block text-xs font-black text-slate-800">سجل المحاولات السابقة:</span>
                    
                    <div className="max-h-56 overflow-y-auto space-y-2.5 pr-1 custom-scrollbar">
                      {group.attempts.map((att, attIdx) => {
                        const style = STATE_STYLE[att.state];
                        const StatusIcon = style.icon;
                        
                        return (
                          <div 
                            key={att.id || attIdx} 
                            className="p-3.5 rounded-2xl border border-slate-200/80 bg-slate-50/70 space-y-2 text-xs transition-all hover:bg-white hover:shadow-sm"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-black text-slate-800">
                                المحاولة ({group.attempts.length - attIdx})
                              </span>
                              <span className={cx("px-3 py-1 rounded-full border text-[11px] font-black inline-flex items-center gap-1.5 shadow-2xs", style.className)}>
                                <StatusIcon size={13} />
                                {style.label}
                              </span>
                            </div>

                            <div className="flex items-center justify-between text-slate-600 font-semibold pt-0.5">
                              <span>الدرجة المحققة:</span>
                              <span className="font-black text-indigo-700">{att.score} من {att.maxScore} ({att.percentage}%)</span>
                            </div>

                            {att.feedback && (
                              <div className="p-2.5 rounded-xl bg-amber-50/90 border border-amber-200 text-amber-900 text-[11px] leading-relaxed">
                                <strong className="block font-bold mb-0.5 flex items-center gap-1">
                                  <Sparkles size={12} className="text-amber-600" /> ملاحظات المعلم:
                                </strong>
                                {att.feedback}
                              </div>
                            )}

                            {att.submittedAt && (
                              <div className="text-[10px] text-slate-400 font-medium pt-1.5 border-t border-slate-200/50 flex items-center gap-1">
                                <Clock size={11} className="text-slate-400" />
                                <span>تاريخ التسليم: {formatDate(att.submittedAt)}</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
