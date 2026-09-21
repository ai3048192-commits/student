import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  BookOpen,
  Search,
  PlayCircle,
  Clock,
  GraduationCap,
  Sparkles,
  Star,
  Layers,
  DollarSign,
} from "lucide-react";
import { supabase } from "../lib/supabaseClient";

export default function CoursesPage() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSupabaseCourses = async () => {
    try {
      setLoading(true);

      // 1. جلب الكورسات
      const { data: coursesData, error: coursesError } = await supabase
        .from("courses")
        .select("*")
        .order("id", { ascending: false });
      
      if (coursesError) throw coursesError;

      // 2. جلب بيانات المعلم الشخصية (الاسم الكامل) من جدول teachers_profile
      const { data: teacherData, error: teacherError } = await supabase
        .from("teachers_profile")
        .select("name")
        .maybeSingle();

      if (teacherError) console.error("Error fetching teacher profile:", teacherError.message);
      
      // الاسم الكامل الحقيقي المستخرج من الملف المهني الشخصي
      const realTeacherName = teacherData?.name || "المعلم";

      // 3. جلب الاشتراكات
      const { data: subsData, error: subsError } = await supabase
        .from("subscriptions")
        .select("course_id, status");

      if (subsError) console.error("Error fetching subscriptions:", subsError.message);

      const approvedCourseIds = new Set(
        (subsData || [])
          .filter((sub: any) => sub.status === "active")
          .map((sub: any) => sub.course_id)
      );

      if (coursesData) {
        const formattedSupabaseCourses = coursesData.map((item: any) => {
          let displayPrice = "مجاني بالكامل";
          let rawPriceValue = item.price || 0;
          if (!item.is_free) {
            displayPrice = item.price !== null && item.price !== undefined && item.price !== "" 
              ? `${item.price} ج.م` 
              : "مدفوع برسوم";
          }

          const isReallyEnrolled = approvedCourseIds.has(item.id);

          return {
            id: item.id,
            courseName: item.course_name || "بدون اسم",
            description: item.description || "لا يوجد وصف مضاف لهذا الكورس حالياً.",
            // وضع الاسم الكامل القادم من ملف Profile الشخصي ليظهر بداخل الكرت مباشرة
            instructor: item.instructor && item.instructor !== "المعلم" ? item.instructor : realTeacherName,
            instructorRole: "محاضر معتمد",
            category: item.course_specialty || "عام",
            categoryName: item.course_specialty || "عام",
            level: "متوسط",
            duration: item.show_times || "مفتوح دائماً",
            totalLessons: item.video_count || 0,
            status: isReallyEnrolled ? "enrolled" : "available",
            imageBg: "from-blue-700 via-indigo-700 to-slate-900",
            rating: 4.8,
            reviewsCount: 15,
            hasCertificate: true,
            price: displayPrice,
            rawPrice: rawPriceValue,
            isFree: item.is_free,
            videosList: item.videos_list || [],
          };
        });

        setCourses(formattedSupabaseCourses);
      }
    } catch (err: any) {
      console.error("Error fetching courses:", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSupabaseCourses();

    const coursesChannel = supabase
      .channel("public:courses")
      .on("postgres_changes", { event: "*", schema: "public", table: "courses" }, () => fetchSupabaseCourses())
      .subscribe();

    const subsChannel = supabase
      .channel("public:subscriptions")
      .on("postgres_changes", { event: "*", schema: "public", table: "subscriptions" }, () => fetchSupabaseCourses())
      .subscribe();

    return () => {
      supabase.removeChannel(coursesChannel);
      supabase.removeChannel(subsChannel);
    };
  }, []);

  const handleSubscribeClick = (course: any) => {
    navigate("/subscriptions", {
      state: {
        selectedCourse: {
          id: course.id,
          name: course.courseName,
          price: course.rawPrice,
          displayPrice: course.price,
          category: course.categoryName,
        }
      }
    });
  };

  const dynamicCategories = [
    { id: "all", name: "كل الأقسام" },
    ...Array.from(new Set(courses.map((c) => c.category))).map((cat) => ({
      id: cat,
      name: cat,
    })),
  ];

  const filteredCourses = courses.filter((course) => {
    const matchesSearch =
      course.courseName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      course.instructor.toLowerCase().includes(searchTerm.toLowerCase()) ||
      course.description.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = filterCategory === "all" || course.category === filterCategory;
    
    const matchesStatus =
      filterStatus === "all" ||
      (filterStatus === "enrolled" && course.status === "enrolled") ||
      (filterStatus === "available" && course.status === "available");

    return matchesSearch && matchesCategory && matchesStatus;
  });

  return (
    <div className="space-y-6 text-slate-900 min-h-screen max-w-9xl mx-auto" dir="rtl">
      
      <div className="relative overflow-hidden bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 rounded-3xl p-6 sm:p-10 shadow-xl text-white border border-blue-500/30">
        <div className="absolute -top-24 -right-24 w-80 h-80 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3">
            <span className="px-3.5 py-1.5 bg-white/10 backdrop-blur-md text-blue-200 text-xs font-extrabold rounded-full inline-flex items-center gap-2 border border-white/15 shadow-inner">
              <Sparkles size={14} className="text-amber-300" />
              أكاديمية الكورسات المتكاملة - منصة Z E D 
            </span>
            <h1 className="text-2xl sm:text-4xl font-black tracking-wide leading-tight">
              دليلك الشامل لجميع الكورسات والمواد التعليمية
            </h1>
            <p className="text-xs sm:text-sm text-blue-100/90 max-w-2xl leading-relaxed">
              استعرض موادك المسجلة، تابع تقدمك الدراسي، أو استكشف مسارات تدريبية واشترك بكل سهولة.
            </p>
          </div>
          <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md p-3 rounded-2xl border border-white/20 shrink-0 self-start md:self-auto shadow-lg">
            <div className="w-10 h-10 rounded-xl bg-blue-600/50 flex items-center justify-center text-white font-bold border border-blue-400/30">
              <BookOpen size={20} />
            </div>
            <div className="text-right">
              <span className="block text-xl font-black tracking-tight">{courses.length}</span>
              <span className="text-[11px] text-blue-200 font-medium">إجمالي الكورسات المضافة</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200/80 rounded-3xl p-4 sm:p-6 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
          <div className="relative w-full lg:w-[420px]">
            <span className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none text-blue-600">
              <Search size={18} />
            </span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ابحث باسم الكورس، المحاضر، أو تفاصيل الوصف..."
              className="w-full pr-11 pl-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white transition-all shadow-2xs"
            />
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-1.5 rounded-2xl border border-slate-200/60 w-full lg:w-auto justify-center overflow-x-auto">
            <button
              onClick={() => setFilterStatus("all")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${filterStatus === "all" ? "bg-blue-600 text-white shadow-md" : "text-slate-600 hover:text-blue-600"}`}
            >
              الكل ({courses.length})
            </button>
            <button
              onClick={() => setFilterStatus("enrolled")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${filterStatus === "enrolled" ? "bg-blue-600 text-white shadow-md" : "text-slate-600 hover:text-blue-600"}`}
            >
              كورساتي المسجلة
            </button>
            <button
              onClick={() => setFilterStatus("available")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${filterStatus === "available" ? "bg-blue-600 text-white shadow-md" : "text-slate-600 hover:text-blue-600"}`}
            >
              المتاحة للاشتراك
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-2 pt-2 border-t border-slate-100 scrollbar-none">
          <span className="text-xs font-bold text-slate-500 flex items-center gap-1.5 shrink-0 ml-2">
            <Layers size={15} className="text-blue-600" /> التخصصات:
          </span>
          {dynamicCategories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setFilterCategory(cat.id)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 border ${
                filterCategory === cat.id
                  ? "bg-slate-900 text-white border-slate-900 shadow-md"
                  : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="py-24 text-center text-slate-500 text-xs font-bold flex flex-col items-center justify-center gap-3">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          جاري جلب محتوى الكورسات...
        </div>
      ) : filteredCourses.length === 0 ? (
        <div className="py-20 text-center space-y-4 bg-white border border-slate-200 rounded-3xl shadow-sm p-6">
          <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto border border-blue-100">
            <BookOpen size={26} />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-black text-slate-800">عذراً، لم نتمكن من العثور على كورسات مطابقة لبحثك.</p>
            <p className="text-xs text-slate-500">جرب البحث بكلمات أخرى أو إعادة ضبط الفلاتر المتاحة.</p>
          </div>
          <button
            onClick={() => { setSearchTerm(""); setFilterCategory("all"); setFilterStatus("all"); }}
            className="px-5 py-2.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl text-xs font-bold transition-all border border-blue-200 inline-block"
          >
            إعادة تعيين الفلاتر
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredCourses.map((course) => (
            <div
              key={course.id}
              className="bg-white border border-slate-200/90 rounded-3xl overflow-hidden shadow-xs hover:shadow-xl hover:border-blue-300 transition-all duration-300 flex flex-col justify-between group"
            >
              <div className={`p-5 bg-gradient-to-br ${course.imageBg} text-white relative`}>
                <div className="absolute top-4 left-4 flex items-center gap-1.5">
                  <span className="px-2.5 py-1 bg-white/15 backdrop-blur-md rounded-xl text-[10px] font-black border border-white/20 tracking-wider">
                    {course.level}
                  </span>
                </div>

                <div className="space-y-2.5 mb-3">
                  <span className="text-[10px] font-extrabold px-3 py-1 bg-white/15 backdrop-blur-md rounded-xl border border-white/20 inline-block">
                    {course.categoryName}
                  </span>
                  <h3 className="text-base sm:text-lg font-black tracking-wide leading-snug line-clamp-2">
                    {course.courseName}
                  </h3>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-white/15 text-xs text-slate-200">
                  <div className="space-y-0.5">
                    <span className="font-extrabold block text-white text-[13px]">{course.instructor}</span>
                    <span className="text-[10px] opacity-80">{course.instructorRole}</span>
                  </div>
                  <div className="flex items-center gap-1 bg-white/15 backdrop-blur-md px-2.5 py-1.5 rounded-xl text-xs font-black shrink-0 border border-white/20">
                    <Star size={13} className="fill-amber-400 text-amber-400" />
                    <span>{course.rating}</span>
                  </div>
                </div>
              </div>

              <div className="p-5 space-y-4 flex-1 flex flex-col justify-between">
                <div className="space-y-3.5">
                  <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                    {course.description}
                  </p>

                  <div className="flex flex-col gap-2 pt-3 border-t border-slate-100 text-[11px] text-slate-600 font-bold">
                    <div className="flex items-center justify-between w-full py-1.5 px-3 bg-slate-50 rounded-xl border border-slate-200/60">
                      <span className="flex items-center gap-2 text-slate-500">
                        <Clock size={14} className="text-blue-600 shrink-0" /> مدة الكورس / الحصص:
                      </span>
                      <span className="text-slate-800 font-black">{course.duration} ({course.totalLessons} فيديو)</span>
                    </div>

                    <div className="flex items-center justify-between w-full py-1.5 px-3 bg-slate-50 rounded-xl border border-slate-200/60">
                      <span className="flex items-center gap-2 text-slate-500">
                        <DollarSign size={14} className="text-blue-600 shrink-0" /> حالة وحجم الاشتراك:
                      </span>
                      <span className={`font-black px-2 py-0.5 rounded-lg border text-[10px] ${
                        course.status === 'enrolled' 
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                          : 'bg-blue-50 text-blue-700 border-blue-200'
                      }`}>
                        {course.status === 'enrolled' ? 'مسجل ومفعل رسمياً' : course.price}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100">
                  {course.status === 'enrolled' ? (
                    <Link
                      to={`/videos?courseId=${course.id}`}
                      className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl transition-all flex items-center justify-center gap-2 text-xs font-black shadow-md hover:shadow-lg active:scale-98"
                    >
                      <PlayCircle size={16} />
                      <span>مشاهدة محتوى الحصص (مفعل)</span>
                    </Link>
                  ) : (
                    <button
                      onClick={() => handleSubscribeClick(course)}
                      className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl transition-all flex items-center justify-center gap-2 text-xs font-black shadow-md hover:shadow-lg active:scale-98"
                    >
                      <GraduationCap size={16} />
                      <span>اشترك الآن (دفع وإرفاق إيصال)</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}