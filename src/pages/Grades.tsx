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
  BookOpen,
  Trash2
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
  passed: { label: "ناجح", className: "border-emerald-200 bg-emerald-50 text-emerald-700", icon: CheckCircle2 },
  review: { label: "مراجعة", className: "border-amber-200 bg-amber-50 text-amber-700", icon: Clock },
  failed: { label: "راسب", className: "border-rose-200 bg-rose-50 text-rose-700", icon: AlertTriangle },
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
  return Number.isNaN(t) ? String(value) : new Date(t).toLocaleDateString(LOCALE, { dateStyle: "short" });
};

/* ================================================================== */
/*  Page                                                              */
/* ================================================================== */

export default function GradesPage() {
  const [status, setStatus] = useState<PageStatus>("loading");
  const [loadError, setLoadError] = useState("");
  const [groupedGrades, setGroupedGrades] = useState<GroupedGrade[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [deletingId, setDeletingId] = useState<any>(null);

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

  const handleDeleteGroup = async (quizId: any) => {
    if (!window.confirm("هل أنت متأكد من حذف هذا الاختبار وكل محاولاته؟")) return;

    try {
      setDeletingId(quizId);
      
      let query = supabase.from("student_submissions").delete();
      if (quizId === "general") {
        query = query.is("quiz_id", null);
      } else {
        query = query.eq("quiz_id", quizId);
      }

      const { error } = await query;
      if (error) throw error;

      setGroupedGrades((prev) => prev.filter((g) => g.quizId !== quizId));
    } catch (err) {
      console.error("خطأ أثناء حذف الاختبار:", err);
      alert("حدث خطأ أثناء محاولة الحذف.");
    } finally {
      setDeletingId(null);
    }
  };

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
    <div className="mx-auto min-h-screen w-full space-y-6 text-slate-800 sm:space-y-8 pb-12 px-4 sm:px-6 max-w-7xl" dir="rtl">
      
      {/* ------------------------------ Header ------------------------------ */}
      <header className="relative overflow-hidden rounded-3xl border border-white/20 bg-gradient-to-l from-indigo-900 via-slate-900 to-blue-950 p-6 sm:p-8 text-white shadow-xl">
        <div aria-hidden className="pointer-events-none absolute -bottom-10 -left-10 h-56 w-56 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="relative flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
          <div className="space-y-3">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/10 px-3.5 py-1 text-xs font-semibold text-indigo-200 backdrop-blur-md">
              <Sparkles size={14} className="text-amber-400" />
              منصة Z E D - لوحة متابعة إنجازاتك
            </span>
            <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
              سجل اختباراتك ومحاولاتك الذكية 📊
            </h1>
            <p className="max-w-2xl text-xs leading-relaxed text-slate-300 sm:text-sm">
              متابعة شاملة لتطور مستواك الأكاديمي ببطاقات مدمجة ومنظمة.
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
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "الاختبارات", value: String(summary.totalQuizzes), color: "text-indigo-600", bg: "bg-indigo-50/80 border-indigo-100", icon: BookOpen },
            { label: "المحاولات", value: String(summary.totalAttempts), color: "text-blue-600", bg: "bg-blue-50/80 border-blue-100", icon: History },
            { label: "المجتازة", value: String(summary.passedCount), color: "text-emerald-600", bg: "bg-emerald-50/80 border-emerald-100", icon: CheckCircle2 },
            { label: "قيد المراجعة", value: String(summary.reviewCount), color: "text-amber-600", bg: "bg-amber-50/80 border-amber-100", icon: Clock },
          ].map(({ label, value, color, bg, icon: Icon }) => (
            <div key={label} className={cx("relative overflow-hidden rounded-2xl border p-4 shadow-xs", bg)}>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <p className={cx("text-2xl font-black tabular-nums tracking-tight", color)}>{value}</p>
                  <p className="text-[11px] font-bold text-slate-600">{label}</p>
                </div>
                <div className={cx("rounded-xl p-2.5 bg-white shadow-2xs", color)}>
                  <Icon size={18} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ------------------------------ List (Small Compact Cards) ------------------------------ */}
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3 px-1">
          <h2 className="flex items-center gap-2 text-base font-black text-slate-800">
            <FileText size={18} className="text-indigo-600" />
            بطاقات الاختبارات المصغرة
          </h2>
          {status === "ready" && (
            <button
              type="button"
              onClick={() => void load(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 transition-all hover:bg-slate-50 disabled:opacity-50 cursor-pointer shadow-2xs"
            >
              <RefreshCw size={12} className={refreshing ? "animate-spin" : undefined} />
              <span>تحديث</span>
            </button>
          )}
        </div>

        {status === "loading" ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-slate-200 bg-white py-20 text-center shadow-xs">
            <Loader2 size={32} className="animate-spin text-indigo-600" />
            <p className="text-xs font-bold text-slate-600">جاري تحميل السجل...</p>
          </div>
        ) : status === "no-user" ? (
          <div className="space-y-3 rounded-3xl border border-slate-200 bg-white px-4 py-16 text-center shadow-xs">
            <AlertTriangle size={36} className="mx-auto text-amber-500" />
            <p className="text-xs font-bold text-slate-700">يجب تسجيل الدخول لعرض درجاتك.</p>
          </div>
        ) : status === "error" ? (
          <div className="space-y-3 rounded-3xl border border-slate-200 bg-white px-4 py-16 text-center shadow-xs">
            <AlertTriangle size={36} className="mx-auto text-rose-500" />
            <p className="text-xs font-bold text-slate-700">تعذّر جلب الدرجات: {loadError}</p>
            <button type="button" onClick={() => void load()} className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white">إعادة المحاولة</button>
          </div>
        ) : groupedGrades.length === 0 ? (
          <div className="space-y-3 rounded-3xl border border-slate-200 bg-white px-4 py-16 text-center shadow-xs">
            <BarChart3 size={36} className="mx-auto text-indigo-400" />
            <p className="text-xs font-bold text-slate-700">لا توجد اختبارات مسجلة حتى الآن.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {groupedGrades.map((group, idx) => {
              const bestAttempt = group.attempts.reduce((prev, current) => 
                (current.score > prev.score) ? current : prev, group.attempts[0]
              );
              const bestPercentage = bestAttempt ? bestAttempt.percentage : 0;
              const isDeleting = deletingId === group.quizId;

              return (
                <div
                  key={idx}
                  className="group relative bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs hover:shadow-lg hover:border-indigo-300 transition-all duration-300 flex flex-col justify-between space-y-4 overflow-hidden"
                >
                  {/* شريط تزييني علوي */}
                  <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-indigo-500 via-blue-500 to-emerald-400" />

                  {/* رأس الكرت المصغر */}
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-indigo-50 text-indigo-700 border border-indigo-100">
                        <BookOpen size={11} />
                        {group.category}
                      </span>
                      
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                          {group.attempts.length} محاولات
                        </span>
                        
                        {/* زر حذف الكرت بالكامل */}
                        <button
                          type="button"
                          onClick={() => handleDeleteGroup(group.quizId)}
                          disabled={isDeleting}
                          title="حذف الكرت بالكامل"
                          className="p-1 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 transition-all disabled:opacity-50 cursor-pointer"
                        >
                          {isDeleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                        </button>
                      </div>
                    </div>

                    <h3 className="text-sm font-black text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-1">
                      {group.courseName}
                    </h3>

                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                      <User size={12} className="text-indigo-500 shrink-0" />
                      <span>المعلم:</span>
                      <span className="font-bold text-slate-700">{group.instructor}</span>
                    </div>

                    {/* شريط أفضل نتيجة مصغر */}
                    <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-2.5 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Award size={15} className="text-amber-500 shrink-0" />
                        <span className="text-[11px] font-bold text-slate-600">الأفضل:</span>
                      </div>
                      <span className="text-xs font-black text-slate-900">
                        {bestAttempt?.score} / {bestAttempt?.maxScore} ({bestPercentage}%)
                      </span>
                    </div>
                  </div>

                  {/* سجل المحاولات السابقة (تظهر بشكل صف أفقي مصغر) */}
                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    <span className="block text-[11px] font-black text-slate-700">المحاولات السابقة:</span>
                    
                    <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-0.5">
                      {group.attempts.map((att, attIdx) => {
                        const style = STATE_STYLE[att.state];
                        const StatusIcon = style.icon;
                        
                        return (
                          <div 
                            key={att.id || attIdx} 
                            className="p-2.5 rounded-xl border border-slate-200/70 bg-slate-50/80 space-y-1.5 text-[11px] transition-all hover:bg-white hover:shadow-2xs"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-black text-slate-800 text-[10px]">
                                محاولة {group.attempts.length - attIdx}
                              </span>
                              <span className={cx("px-1.5 py-0.5 rounded-md border text-[9px] font-black flex items-center gap-0.5", style.className)}>
                                <StatusIcon size={10} />
                                {style.label}
                              </span>
                            </div>

                            <div className="font-bold text-indigo-700 text-[11px]">
                              {att.score} / {att.maxScore} <span className="text-[10px] text-slate-400">({att.percentage}%)</span>
                            </div>

                            {att.feedback && (
                              <p className="text-[10px] text-amber-900 bg-amber-50 p-1 rounded border border-amber-200 line-clamp-1" title={att.feedback}>
                                💬 {att.feedback}
                              </p>
                            )}

                            {att.submittedAt && (
                              <div className="text-[9px] text-slate-400 flex items-center gap-1 pt-0.5 border-t border-slate-200/40">
                                <Clock size={9} />
                                <span>{formatDate(att.submittedAt)}</span>
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
