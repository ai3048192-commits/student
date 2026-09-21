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
} from "lucide-react";
import { supabase } from "../lib/supabaseClient";

/* ================================================================== */
/*  Types                                                             */
/* ================================================================== */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;
type PageStatus = "loading" | "ready" | "no-user" | "error";
type GradeState = "passed" | "review" | "failed";

interface Grade {
  id: number;
  courseName: string;
  instructor: string;
  category: string;
  score: number;
  maxScore: number;
  percentage: number;
  state: GradeState;
  feedback: string;
  submittedAt: string;
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

// max_score بيتقرا من الجدول بدل ما نفترض 100 دايماً زي الكود القديم
const toGrade = (row: Row, quiz: Row | undefined, course: Row | undefined): Grade => {
  const score = Number(row.score) || 0;
  const maxScore = Number(row.max_score) > 0 ? Number(row.max_score) : 100;
  const percentage = Math.round((score / maxScore) * 100);
  const graded = row.status === "تم التصحيح" || row.status === "graded" || row.score != null;

  return {
    id: row.id,
    courseName: row.course_name || quiz?.course_name || course?.course_name || "غير محدد",
    instructor: quiz?.teacher_name || quiz?.instructor || course?.instructor || "غير محدد",
    category: row.specialty || course?.course_specialty || quiz?.course_specialty || "عام",
    score,
    maxScore,
    percentage,
    state: !graded ? "review" : percentage >= PASS_MARK ? "passed" : "failed",
    feedback: row.feedback || row.notes || "",
    submittedAt: row.submission_time || row.created_at || "",
  };
};

/* ================================================================== */
/*  Page                                                              */
/* ================================================================== */

export default function GradesPage() {
  const [status, setStatus] = useState<PageStatus>("loading");
  const [loadError, setLoadError] = useState("");
  const [grades, setGrades] = useState<Grade[]>([]);
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

      // مفيش .eq(user_id) هنا: سياسة RLS بترجّع تسليمات الطالب الحالي بس.
      // الكود القديم كان بيعمل select * من غير أي فلتر، فكل طالب كان بيشوف
      // درجات كل الطلاب.
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

      setGrades(
        rows.map((row: Row) => {
          const quiz = quizMap.get(row.quiz_id);
          return toGrade(row, quiz, quiz ? courseMap.get(quiz.course_id) : undefined);
        })
      );
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
    const graded = grades.filter((g) => g.state !== "review");
    const average = graded.length
      ? Math.round(graded.reduce((sum, g) => sum + g.percentage, 0) / graded.length)
      : null;
    return {
      total: grades.length,
      passed: grades.filter((g) => g.state === "passed").length,
      review: grades.filter((g) => g.state === "review").length,
      average,
    };
  }, [grades]);

  return (
    <div className="mx-auto min-h-screen w-full space-y-6 text-slate-800 sm:space-y-8" dir="rtl">
      {/* ------------------------------ Header ------------------------------ */}
      <header className="relative overflow-hidden rounded-2xl border border-white/20 bg-gradient-to-br from-emerald-600 via-blue-600 to-indigo-700 p-5 text-white shadow-xl sm:rounded-3xl sm:p-8">
        <div aria-hidden className="pointer-events-none absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <div className="relative flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
          <div className="space-y-2 sm:space-y-3">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-white/20 px-3 py-1 text-[11px] font-bold text-white shadow-xs backdrop-blur-md sm:text-xs">
              <Sparkles size={14} />
              لوحة متابعة الدرجات الفورية، منصة
              <span dir="ltr" className="tracking-[0.3em]">
                ZED
              </span>
            </span>
            <h1 className="text-xl font-black leading-tight tracking-tight sm:text-3xl lg:text-4xl">
              سجل إنجازاتك ودرجاتك الفعلية 📊
            </h1>
            <p className="max-w-2xl text-xs leading-relaxed text-blue-100 sm:text-sm">
              هنا تظهر درجاتك بشكل آلي فور الانتهاء من حل الواجبات والاختبارات واعتمادها من المدرس.
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
      {status === "ready" && grades.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          {(
            [
              ["إجمالي النتائج", String(summary.total), "text-slate-900"],
              ["نجحت فيها", String(summary.passed), "text-emerald-600"],
              ["قيد المراجعة", String(summary.review), "text-amber-600"],
              ["المتوسط العام", summary.average === null ? "—" : `${summary.average}%`, "text-blue-600"],
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
            نتائج الواجبات والاختبارات
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
            <p className="mx-auto max-w-md text-xs text-slate-500">
              درجاتك مرتبطة بحسابك الشخصي، ولا يمكن لأي طالب آخر الاطلاع عليها.
            </p>
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
        ) : grades.length === 0 ? (
          <div className="space-y-3 rounded-3xl border border-slate-200 bg-white px-4 py-16 text-center shadow-xs">
            <BarChart3 size={40} className="mx-auto text-blue-400" />
            <p className="text-sm font-bold text-slate-700">لا توجد درجات مسجلة حتى الآن.</p>
            <p className="mx-auto max-w-md text-xs text-slate-500">
              قم بحل الواجبات أو الاختبارات المتاحة لتظهر نتائجها هنا فوراً وتتبع مستواك الدراسي.
            </p>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 sm:gap-6">
            {grades.map((item) => {
              const style = STATE_STYLE[item.state];
              return (
                <li
                  key={item.id}
                  className="group flex flex-col justify-between space-y-4 rounded-2xl border-2 border-slate-200/80 bg-white p-4 shadow-sm transition-all duration-300 hover:border-blue-500 hover:shadow-xl sm:space-y-5 sm:rounded-3xl sm:p-6"
                >
                  <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <span className="max-w-[130px] truncate rounded-lg border border-slate-200 bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-700">
                      {item.category}
                    </span>
                    <span
                      className={cx(
                        "inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-black",
                        style.className
                      )}
                    >
                      {item.state === "review" ? <Clock size={12} /> : <CheckCircle2 size={12} />}
                      {style.label}
                    </span>
                  </div>

                  <div className="flex-1 space-y-3">
                    <div className="space-y-1">
                      <span className="block text-[10px] font-bold text-slate-400">اسم المادة / الكورس</span>
                      <h3 className="text-sm font-black leading-snug text-slate-900 transition-colors group-hover:text-blue-600 sm:text-base">
                        {item.courseName}
                      </h3>
                    </div>

                    <div className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 p-2.5 text-xs text-slate-600">
                      <User size={14} className="shrink-0 text-blue-500" />
                      <span className="text-[10px] text-slate-400">المعلم:</span>
                      <span className="truncate font-bold text-slate-700">{item.instructor}</span>
                    </div>
                  </div>

                  <div className="space-y-2.5 border-t border-slate-100 pt-3 text-xs font-semibold">
                    {item.state === "review" ? (
                      <p className="rounded-xl border border-amber-200/60 bg-amber-50/50 p-3 text-[11px] leading-relaxed text-amber-900">
                        تم استلام إجابتك، وفي انتظار تصحيح المعلم.
                      </p>
                    ) : (
                      <>
                        <div className="flex items-center justify-between rounded-xl border border-blue-100/60 bg-blue-50/60 p-2.5">
                          <span className="text-[11px] text-slate-600">درجة التقييم:</span>
                          <strong className="text-sm font-black tabular-nums text-blue-700">
                            {item.score} / {item.maxScore}
                          </strong>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className={cx(
                              "h-full rounded-full transition-all",
                              item.state === "passed" ? "bg-emerald-500" : "bg-rose-400"
                            )}
                            style={{ width: `${Math.min(100, Math.max(0, item.percentage))}%` }}
                          />
                        </div>
                      </>
                    )}

                    {item.feedback && (
                      <div className="space-y-0.5 rounded-xl border border-amber-200/60 bg-amber-50/50 p-3 text-[11px] text-amber-900">
                        <strong className="block text-[11px] font-black text-amber-800">ملاحظات المعلم:</strong>
                        <p className="text-[11px] leading-relaxed text-slate-600">{item.feedback}</p>
                      </div>
                    )}

                    {item.submittedAt && (
                      <p className="text-[10px] text-slate-400">تاريخ التسليم: {formatDate(item.submittedAt)}</p>
                    )}
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