import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  BookOpen,
  FileCheck,
  UploadCloud,
  Sparkles,
  Clock,
  Bell,
  Loader2,
  Trash2,
  RefreshCw,
  CheckCheck,
  ArrowRight,
  BookMarked,
  AlertCircle,
  PlayCircle,
  CheckCircle2,
} from "lucide-react";
import { supabase } from "../lib/supabaseClient";

export default function HomePage() {
  const [assignments, setAssignments] = useState<any[]>([]);
  const [submissionsCount, setSubmissionsCount] = useState<number>(0);
  const [enrolledCourses, setEnrolledCourses] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState<boolean>(true);
  const [exhaustedQuizzes, setExhaustedQuizzes] = useState<{
    [key: number]: boolean;
  }>({});

  // معرف الطالب الثابت أو المرتبط بالجلسة (مطابق لملف Profile و Header)
  const [studentId] = useState(1);

  // حالة لتخزين اسم المستخدم الحقيقي
  const [userName, setUserName] = useState<string>("جاري التحميل...");

  // حالة الإشعارات المجلوبة من جدول my_notifications
  const [notifications, setNotifications] = useState<any[]>([]);

  useEffect(() => {
    const savedExhausted = localStorage.getItem("exhausted_quizzes");
    if (savedExhausted) {
      try {
        setExhaustedQuizzes(JSON.parse(savedExhausted));
      } catch (e) {
        console.error(e);
      }
    }
    fetchHomeData();

    // الاستماع للتحديثات الفورية للاسم في جدول students_profile
    const channel = supabase
      .channel('public:students_profile_home')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'students_profile', filter: `id=eq.${studentId}` },
        (payload) => {
          if (payload.new && payload.new.name) {
            setUserName(payload.new.name);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [studentId]);

  const fetchHomeData = async () => {
    try {
      setLoadingData(true);

      // 0. جلب بيانات الطالب الحقيقي من جدول students_profile بناءً على الـ studentId
      const { data: studentProfile, error: profileError } = await supabase
        .from("students_profile")
        .select("name")
        .eq("id", studentId)
        .single();

      if (studentProfile && !profileError && studentProfile.name) {
        setUserName(studentProfile.name);
      } else {
        // بديل في حال عدم وجود سجل
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session?.user) {
          const metaName = session.user.user_metadata?.full_name;
          setUserName(metaName || session.user.email?.split("@")[0] || "طالب ZED");
        } else {
          setUserName("طالب ZED");
        }
      }

      // 1. جلب الواجبات والاختبارات
      const { data: quizzesData, error: quizzesError } = await supabase
        .from("quizzes")
        .select("*");

      if (quizzesError) throw quizzesError;
      if (quizzesData) {
        setAssignments(quizzesData);
      }

      // 2. جلب عدد الواجبات المسلمة
      const { count, error: countError } = await supabase
        .from("student_submissions")
        .select("*", { count: "exact", head: true });

      if (!countError && count !== null) {
        setSubmissionsCount(count);
      }

      // 3. جلب الإشعارات الخاصة بالطلاب
      const { data: notifsData, error: notifsError } = await supabase
        .from("my_notifications")
        .select("*")
        .eq("recipient_type", "students")
        .order("id", { ascending: false });

      if (!notifsError && notifsData) {
        const formattedNotifs = notifsData.map((item) => ({
          ...item,
          source: item.recipient_label || "منصة zed التعليمية",
          created_at: item.time || "حديثاً",
        }));
        setNotifications(formattedNotifs);
      }

      // 4. جلب الكورسات والاشتراكات النشطة
      const { data: coursesData, error: coursesError } = await supabase
        .from("courses")
        .select("*")
        .order("id", { ascending: false });

      if (coursesError) throw coursesError;

      const { data: subsData, error: subsError } = await supabase
        .from("subscriptions")
        .select("course_id, status");

      if (subsError)
        console.error("Error fetching subscriptions:", subsError.message);

      const approvedCourseIds = new Set(
        (subsData || [])
          .filter((sub: any) => sub.status === "active")
          .map((sub: any) => sub.course_id),
      );

      if (coursesData) {
        const myEnrolled = coursesData
          .filter((item: any) => approvedCourseIds.has(item.id))
          .map((item: any) => ({
            id: item.id,
            courseName: item.course_name || "بدون اسم",
            instructor: item.instructor || "المعلم",
            category: item.course_specialty || "عام",
            nextLesson: item.show_times || "متاح للمشاهدة",
            progress: 50,
            status: "مسجل ومفعل",
          }));

        setEnrolledCourses(myEnrolled);
      }
    } catch (error) {
      console.error("خطأ في جلب بيانات الرئيسية من Supabase:", error);
    } finally {
      setLoadingData(false);
    }
  };

  const [refreshing, setRefreshing] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchHomeData().finally(() => setRefreshing(false));
  };

  const handleDeleteNotification = (id: number) => {
    if (!window.confirm("هل أنت متأكد من حذف هذا الإشعار؟")) return;
    setDeletingId(id);
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      setDeletingId(null);
    }, 400);
  };

  const stats = [
    {
      title: "الكورسات المشترك بها",
      value: loadingData ? "..." : String(enrolledCourses.length),
      change: "نشط حالياً",
      period: "المواد الدراسية",
      icon: BookOpen,
      color: "text-blue-600",
      bg: "bg-blue-50 border-blue-200",
    },
    {
      title: "الاختبارات المعلقة",
      value: loadingData
        ? "..."
        : String(assignments.length - Object.keys(exhaustedQuizzes).length),
      change: "تتطلب حل",
      period: "متاحة الآن",
      icon: FileCheck,
      color: "text-blue-500",
      bg: "bg-blue-50 border-blue-200",
    },
    {
      title: "الواجبات المسلمة",
      value: String(submissionsCount),
      change: "تم التقييم",
      period: "الأداء العام",
      icon: UploadCloud,
      color: "text-indigo-600",
      bg: "bg-indigo-50 border-indigo-200",
    },
    {
      title: "التنبيهات الجديدة",
      value: loadingData ? "..." : String(notifications.length),
      change: "غير مقروءة",
      period: "سجل الإشعارات",
      icon: Bell,
      color: "text-blue-700",
      bg: "bg-blue-50 border-blue-200",
    },
  ];

  return (
    <div
      className="space-y-8 pb-12 bg-white text-slate-800 min-h-screen"
      dir="rtl"
    >
      <div className="relative overflow-hidden bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-700 rounded-3xl p-6 sm:p-8 shadow-xl text-white border border-blue-500/20">
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3.5 py-1 bg-white/20 backdrop-blur-md text-white text-xs font-bold rounded-full flex items-center gap-1.5 border border-white/25">
                <Sparkles size={13} />
                بوابة الطالب الأكاديمية - منصة Z E D
              </span>
            </div>

            <h1 className="text-2xl sm:text-4xl font-black tracking-wide">
              أهلاً بك مجدداً، {userName}
            </h1>

            <p className="text-sm text-blue-100 max-w-2xl leading-relaxed">
              جميع كورساتك، واجباتك، واختباراتك مرتبة بعناية هنا لتابع تقدمك
              الأكاديمي أولاً بأول نحو القمة.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((item, index) => {
          const Icon = item.icon;
          return (
            <div
              key={index}
              className="bg-white border-2 border-blue-100/80 rounded-2xl p-5 hover:border-blue-400 hover:shadow-lg transition-all duration-300 group shadow-xs"
            >
              <div className="flex items-center justify-between mb-4">
                <div
                  className={`p-3 rounded-xl border ${item.bg} ${item.color}`}
                >
                  <Icon size={22} />
                </div>
                <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200">
                  {item.change}
                </span>
              </div>
              <h3 className="text-3xl font-black text-slate-900 tracking-wider mb-1">
                {item.value}
              </h3>
              <p className="text-xs font-bold text-slate-700">{item.title}</p>
              <span className="text-[11px] text-blue-600/80 font-medium block mt-1">
                {item.period}
              </span>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* عمود المهام */}
        <div className="bg-white border-2 border-blue-100 rounded-3xl p-6 shadow-xs lg:col-span-1 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-blue-100">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-200">
                <AlertCircle size={18} />
              </div>
              <h3 className="text-sm font-bold text-slate-900">
                المهام والاختبارات العاجلة
              </h3>
            </div>
            <span className="text-[10px] bg-blue-600 text-white font-bold px-2.5 py-0.5 rounded-full">
              {assignments.length} إجمالي
            </span>
          </div>

          <div className="space-y-3 max-h-[380px] overflow-y-auto">
            {loadingData ? (
              <div className="text-center py-8 text-xs text-blue-600 font-bold">
                جاري التحميل... 🔄
              </div>
            ) : assignments.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-500">
                لا توجد اختبارات أو واجبات مضافة حالياً.
              </div>
            ) : (
              assignments.map((assignment) => {
                const isDone = exhaustedQuizzes[assignment.id];

                return (
                  <div
                    key={assignment.id}
                    className={`p-3.5 border rounded-2xl space-y-2 transition-all ${
                      isDone
                        ? "bg-emerald-50/50 border-emerald-200 opacity-90"
                        : "bg-blue-50/40 border-blue-100 hover:border-blue-300"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${isDone ? "bg-emerald-600 text-white" : "bg-blue-600 text-white"}`}
                      >
                        {isDone ? "تم الحل بنجاح ✅" : "اختبار / واجب حي"}
                      </span>
                      <span className="text-[10px] text-slate-500 font-semibold flex items-center gap-1">
                        <Clock size={12} className="text-blue-600" />{" "}
                        {assignment.due_date || "قريباً"}
                      </span>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">
                        {assignment.course_name}
                      </h4>
                      <p className="text-[11px] text-blue-700 font-medium mt-0.5">
                        التخصص: {assignment.course_specialty || "عام"}
                      </p>
                    </div>
                    <div className="pt-1 flex items-center justify-between">
                      {isDone ? (
                        <span className="text-[11px] text-emerald-700 font-bold flex items-center gap-1">
                          <CheckCircle2 size={13} /> تم إكمال المحاولات
                        </span>
                      ) : (
                        <Link
                          to="/assignments"
                          className="text-[11px] text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1"
                        >
                          <span>حل الاختبار الآن</span>
                          <ArrowRight size={12} />
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* قسم متابعة الكورسات الحالية */}
        <div className="bg-white border-2 border-blue-100 rounded-3xl p-6 shadow-xs lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-blue-100">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-200">
                <BookMarked size={18} />
              </div>
              <h3 className="text-sm font-bold text-slate-900">
                متابعة الكورسات الحالية ومشاهدة الدروس
              </h3>
            </div>
            <Link
              to="/courses"
              className="text-xs text-blue-600 hover:text-blue-700 font-bold flex items-center gap-1"
            >
              <span>عرض كل الكورسات</span>
              <ArrowRight size={14} />
            </Link>
          </div>

          {loadingData ? (
            <div className="text-center py-12 text-xs text-blue-600 font-bold">
              جاري تحميل الكورسات المشترك بها...
            </div>
          ) : enrolledCourses.length === 0 ? (
            <div className="text-center py-12 space-y-3 bg-blue-50/30 border border-blue-100 rounded-2xl">
              <BookOpen size={32} className="text-blue-500 mx-auto" />
              <p className="text-xs font-bold text-slate-700">
                ليس لديك أي كورسات مفعلة حالياً.
              </p>
              <Link
                to="/courses"
                className="inline-block px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold shadow-xs hover:bg-blue-700 transition-all"
              >
                استكشف الكورسات المتاحة واشترك
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {enrolledCourses.map((course) => (
                <div
                  key={course.id}
                  className="p-4 bg-blue-50/30 border border-blue-100 rounded-2xl flex flex-col justify-between gap-3 hover:border-blue-300 transition-all"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-100 text-blue-700 rounded-md">
                        {course.category}
                      </span>
                      <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        {course.status}
                      </span>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 line-clamp-1">
                        {course.courseName}
                      </h4>
                      <span className="text-[11px] text-blue-600 font-medium block mt-0.5">
                        {course.instructor}
                      </span>
                    </div>

                    <div className="space-y-1 pt-1">
                      <div className="flex justify-between text-[10px] font-bold text-slate-600">
                        <span>نسبة التقدم</span>
                        <span>{course.progress}%</span>
                      </div>
                      <div className="w-full bg-blue-100 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-blue-600 h-full rounded-full transition-all duration-500"
                          style={{ width: `${course.progress}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-blue-100/60 flex items-center justify-end">
                    <Link
                      to={`/videos?courseId=${course.id}`}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all w-full justify-center"
                    >
                      <PlayCircle size={14} />
                      <span>مشاهدة الدروس</span>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* قسم سجل الإشعارات والتنبيهات المربوط بقاعدة البيانات */}
      <div className="bg-white border-2 border-blue-100 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-blue-100">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-blue-50 text-blue-600 border border-blue-200">
              <Bell size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">
                  سجل الإشعارات والتنبيهات
                </h3>
                <span className="text-[10px] bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-full border border-blue-200 font-bold">
                  {notifications.length} إشعار نشط
                </span>
              </div>
              <span className="text-xs text-slate-500">
                تابع نتائج اختباراتك والمحاضرات المضافة أولاً بأول
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-250 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all disabled:opacity-50"
            >
              <RefreshCw
                size={14}
                className={refreshing ? "animate-spin text-blue-600" : ""}
              />
              <span>تحديث البيانات</span>
            </button>
          </div>
        </div>

        {notifications.length === 0 ? (
          <div className="py-12 text-center space-y-2 bg-blue-50/40 border border-blue-100 rounded-2xl">
            <CheckCheck size={28} className="text-blue-600 mx-auto" />
            <p className="text-sm font-bold text-slate-700">
              لا توجد إشعارات جديدة حالياً.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {notifications.map((notil) => (
              <div
                key={notil.id}
                className="bg-blue-50/30 border border-blue-100 rounded-2xl p-4 shadow-xs flex flex-col justify-between hover:border-blue-300 transition-all space-y-3"
              >
                <div className="flex items-center justify-between pb-2.5 border-b border-blue-100">
                  <span className="text-[11px] font-bold text-blue-700 bg-white px-2.5 py-1 rounded-lg border border-blue-200">
                    {notil.source}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400 font-medium">
                      {notil.created_at}
                    </span>
                    <button
                      onClick={() => handleDeleteNotification(notil.id)}
                      disabled={deletingId === notil.id}
                      className="p-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg transition-all"
                    >
                      {deletingId === notil.id ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <Trash2 size={13} />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-slate-900 mb-1">
                    {notil.title}
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {notil.message}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* زر التوجيه إلى صفحة الإشعارات */}
        <div className="pt-2 flex justify-end">
          <Link
            to="/notifications"
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all"
          >
            <span>عرض كل الإشعارات</span>
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </div>
  );
}