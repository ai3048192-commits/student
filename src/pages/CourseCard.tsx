import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  BookOpen,
  Search,
  PlayCircle,
  GraduationCap,
  Sparkles,
  Star,
  Layers,
  X,
  Smartphone,
  Building2,
  Upload,
  Check,
  ShieldCheck,
  FileCheck,
  CreditCard,
  User,
  Hash,
  Copy
} from "lucide-react";
import { supabase } from "../lib/supabaseClient";

export default function CoursesPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedCourseToSubscribe, setSelectedCourseToSubscribe] = useState<any>(null);
  const [paymentMethod, setPaymentMethod] = useState("vodafone");
  const [studentNameInput, setStudentNameInput] = useState("");
  const [paymentNumberInput, setPaymentNumberInput] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedText, setCopiedText] = useState("");

  const [teacherPaymentInfo, setTeacherPaymentInfo] = useState({
    name: "المعلم",
    vodafone_cash_number: "غير محدد",
    instapay_username: "غير محدد"
  });

  const fetchSupabaseCourses = async () => {
    try {
      setLoading(true);

      const { data: coursesData, error: coursesError } = await supabase
        .from("courses")
        .select("*")
        .order("id", { ascending: false });
      
      if (coursesError) throw coursesError;

      const { data: teacherData, error: teacherError } = await supabase
        .from("teachers_profile")
        .select("name, vodafone_cash_number, instapay_username")
        .maybeSingle();

      if (teacherError) console.error("Error fetching teacher profile:", teacherError.message);
      
      if (teacherData) {
        setTeacherPaymentInfo({
          name: teacherData.name || "المعلم",
          vodafone_cash_number: teacherData.vodafone_cash_number || "غير محدد",
          instapay_username: teacherData.instapay_username || "غير محدد"
        });
      }

      const realTeacherName = teacherData?.name || "المعلم";

      const { data: subsData, error: subsError } = await supabase
        .from("subscriptions")
        .select("course_id, status");

      if (subsError) console.error("Error fetching subscriptions:", subsError.message);

      const activeCourseIds = new Set(
        (subsData || [])
          .filter((sub: any) => sub.status === "active")
          .map((sub: any) => sub.course_id)
      );

      if (coursesData) {
        const formattedSupabaseCourses = coursesData.map((item: any) => {
          let displayPrice = "مجاني بالكامل";
          let rawPriceValue = item.price || "0";
          if (!item.is_free) {
            displayPrice = item.price !== null && item.price !== undefined && item.price !== "" 
              ? `${item.price} ج.م` 
              : "مدفوع برسوم";
          }

          const isEnrolled = activeCourseIds.has(item.id);
          const courseInstructor = item.instructor && item.instructor !== "المعلم" ? item.instructor : realTeacherName;

          return {
            id: item.id,
            courseName: item.course_name || "بدون اسم",
            description: item.description || "لا يوجد وصف مضاف لهذا الكورس حالياً.",
            instructor: courseInstructor,
            category: item.course_specialty || "عام",
            categoryName: item.course_specialty || "عام",
            duration: item.show_times || "مفتوح دائماً",
            totalLessons: item.video_count || 0,
            status: isEnrolled ? "enrolled" : "available",
            imageBg: "from-blue-600 to-indigo-700",
            rating: 4.8,
            price: displayPrice,
            rawPrice: rawPriceValue,
            isFree: item.is_free,
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

  const handleCreateSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentNameInput || !paymentNumberInput || !receiptFile) {
      alert("الرجاء إكمال جميع البيانات وإرفاق صورة الإيصال");
      return;
    }

    try {
      setIsSubmitting(true);

      const fileExt = receiptFile.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('payment-receipts')
        .upload(filePath, receiptFile);

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from('payment-receipts')
        .getPublicUrl(filePath);

      const { error: insertError } = await supabase.from('subscriptions').insert([
        {
          course_id: selectedCourseToSubscribe.id,
          course_name: selectedCourseToSubscribe.courseName,
          student_name: studentNameInput,
          student_code: "N/A",
          payment_method: paymentMethod,
          sender_number: paymentNumberInput,
          receipt_image_url: publicUrlData.publicUrl,
          status: 'pending'
        }
      ]);

      if (insertError) throw insertError;

      setSuccessMessage(`تم تقديم طلب الاشتراك في كورس "${selectedCourseToSubscribe.courseName}" بنجاح، وفي انتظار مراجعة المعلم وتفعيله! 🎉`);
      setSelectedCourseToSubscribe(null);
      setStudentNameInput("");
      setPaymentNumberInput("");
      setReceiptFile(null);
      setTimeout(() => setSuccessMessage(""), 6000);
    } catch (error: any) {
      console.error("Detailed Error:", error);
      alert(`خطأ تقني: ${error.message || "تأكد من إعدادات التخزين وصلاحيات Supabase"}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyText = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(""), 2000);
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
    <div className="space-y-6 text-slate-800 min-h-screen" dir="rtl">
      
      {/* رأس الصفحة */}
      <div className="relative overflow-hidden bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-900 rounded-3xl p-6 sm:p-8 shadow-xl text-white border border-blue-400/20">
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <span className="px-3.5 py-1.5 bg-white/15 backdrop-blur-md text-white text-xs font-bold rounded-full inline-flex items-center gap-1.5 border border-white/20 shadow-inner">
              <Sparkles size={14} className="text-amber-300" />
              أكاديمية الكورسات المتكاملة - منصة Z E D 
            </span>
            <h1 className="text-2xl sm:text-3xl font-black tracking-wide leading-tight">
              دليلك الشامل لجميع الكورسات والمواد 📚
            </h1>
            <p className="text-xs sm:text-sm text-blue-100 max-w-2xl leading-relaxed">
              استعرض الكورسات المتاحة، اشترك بسهولة عبر وسائل الدفع المعتمدة، وتابع محتواك فور اعتماد المعلم.
            </p>
          </div>

          <div className="flex items-center justify-center gap-3 bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/20 shrink-0 shadow-sm">
            <div className="text-center px-3">
              <span className="block text-2xl font-black text-amber-300">{courses.length}</span>
              <span className="text-[11px] text-blue-100 font-medium">إجمالي الكورسات</span>
            </div>
          </div>
        </div>
      </div>

      {successMessage && (
        <div className="p-4 bg-emerald-50 border-2 border-emerald-300 text-emerald-900 rounded-2xl flex items-center gap-3 text-xs font-bold shadow-md animate-in fade-in">
          <Check size={20} className="text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* شريط البحث والفلاتر */}
      <div className="bg-white border-2 border-slate-200/80 rounded-3xl p-5 space-y-4 shadow-sm">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="relative w-full md:w-96">
            <span className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none text-blue-600">
              <Search size={18} />
            </span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ابحث باسم الكورس، التخصص، أو المحاضر..."
              className="w-full pr-11 pl-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-2xl text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white transition-all shadow-2xs"
            />
          </div>

          <div className="grid grid-cols-3 gap-1.5 bg-slate-100 p-1.5 rounded-2xl border border-slate-200 w-full md:w-auto">
            <button
              onClick={() => setFilterStatus("all")}
              className={`py-2 px-4 rounded-xl text-xs font-black transition-all text-center ${filterStatus === "all" ? "bg-blue-600 text-white shadow-md" : "text-slate-600 hover:bg-slate-200"}`}
            >
              الكل
            </button>
            <button
              onClick={() => setFilterStatus("enrolled")}
              className={`py-2 px-4 rounded-xl text-xs font-black transition-all text-center ${filterStatus === "enrolled" ? "bg-blue-600 text-white shadow-md" : "text-slate-600 hover:bg-slate-200"}`}
            >
              المفعلة
            </button>
            <button
              onClick={() => setFilterStatus("available")}
              className={`py-2 px-4 rounded-xl text-xs font-black transition-all text-center ${filterStatus === "available" ? "bg-blue-600 text-white shadow-md" : "text-slate-600 hover:bg-slate-200"}`}
            >
              المتاحة
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-2 pt-3 border-t border-slate-100">
          <span className="text-xs font-black text-slate-500 flex items-center gap-1.5 shrink-0 ml-2">
            <Layers size={16} className="text-blue-600" /> التخصصات:
          </span>
          {dynamicCategories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setFilterCategory(cat.id)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
                filterCategory === cat.id
                  ? "bg-blue-600 text-white shadow-md scale-105"
                  : "bg-slate-50 text-slate-600 border-2 border-slate-200 hover:bg-slate-100"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="py-24 text-center text-slate-400 text-sm font-bold bg-white border-2 border-slate-200 rounded-3xl shadow-sm">
          جاري تحميل الكورسات والتحقق من الاشتراكات...
        </div>
      ) : filteredCourses.length === 0 ? (
        <div className="py-24 text-center space-y-3 bg-white border-2 border-slate-200 rounded-3xl shadow-sm">
          <BookOpen size={48} className="text-blue-600 mx-auto" />
          <p className="text-sm font-bold text-slate-700">عذراً، لم نتمكن من العثور على كورسات تطابق بحثك.</p>
          <button
            onClick={() => { setSearchTerm(""); setFilterCategory("all"); setFilterStatus("all"); }}
            className="text-xs font-black text-blue-600 underline hover:text-blue-800"
          >
            إعادة تعيين الفلاتر وبحث جديد
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCourses.map((course) => (
            <div
              key={course.id}
              className="bg-white border-2 border-slate-200/90 rounded-3xl overflow-hidden shadow-sm hover:border-blue-500 hover:shadow-xl transition-all duration-300 flex flex-col justify-between group"
            >
              {/* كارد الكورس المطور بتصميم انسيابي ومتناسق */}
              <div className="flex flex-col h-full">
                <div className="p-5 bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 text-white relative overflow-hidden">
                  <div className="absolute -top-10 -left-10 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />
                  
                  <div className="flex items-center justify-between gap-2 mb-3 relative z-10">
                    <span className="px-3 py-1 bg-white/10 backdrop-blur-md rounded-xl text-[11px] font-black border border-white/15 text-blue-200">
                      {course.categoryName}
                    </span>
                    <span className="px-3 py-1 bg-amber-400/20 text-amber-300 backdrop-blur-md rounded-xl text-[11px] font-black border border-amber-400/30 flex items-center gap-1">
                      <Star size={12} className="fill-amber-300" /> {course.rating}
                    </span>
                  </div>

                  <h3 className="text-base sm:text-lg font-black tracking-wide line-clamp-2 leading-snug relative z-10 text-white">
                    {course.courseName}
                  </h3>
                </div>

                <div className="p-5 space-y-4 flex-1 flex flex-col justify-between text-xs bg-white">
                  <div className="space-y-3">
                    <p className="text-slate-600 line-clamp-2 leading-relaxed bg-slate-50 p-3 rounded-2xl border border-slate-100">
                      {course.description}
                    </p>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col">
                        <span className="text-slate-400 font-bold text-[10px]">المحاضر</span>
                        <span className="font-black text-slate-800 truncate">{course.instructor}</span>
                      </div>

                      <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col">
                        <span className="text-slate-400 font-bold text-[10px]">حجم المحتوى</span>
                        <span className="font-black text-blue-600 flex items-center gap-1">
                          <PlayCircle size={13} /> {course.totalLessons} فيديو
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100 font-bold">
                      <span className="text-slate-500">حالة الكورس:</span>
                      <span className={`px-3 py-1 rounded-xl border font-black ${course.status === 'enrolled' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                        {course.status === 'enrolled' ? 'مشترك ومفعل ✓' : course.price}
                      </span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100">
                    {course.status === 'enrolled' ? (
                      <Link
                        to={`/videos?courseId=${course.id}`}
                        className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl transition-all flex items-center justify-center gap-2 font-black shadow-md hover:shadow-lg"
                      >
                        <PlayCircle size={18} />
                        <span>مشاهدة محتوى الكورس</span>
                      </Link>
                    ) : (
                      <button
                        onClick={() => setSelectedCourseToSubscribe(course)}
                        className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl transition-all flex items-center justify-center gap-2 font-black shadow-md hover:shadow-lg cursor-pointer"
                      >
                        <GraduationCap size={18} />
                        <span>الدفع والاشتراك الآن</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* نافذة الدفع بتصميم منسق وآمن داخل إطار الشاشة تماماً بدون خروج */}
      {selectedCourseToSubscribe && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full max-h-[92vh] flex flex-col shadow-2xl relative border border-slate-200 animate-in fade-in zoom-in-95 duration-200 overflow-hidden" dir="rtl">
            
            {/* رأس النافذة المنبثقة (ثابت لا يتحرك) */}
            <div className="p-4 sm:p-5 bg-slate-900 text-white flex items-center justify-between shrink-0 border-b border-slate-800">
              <div className="space-y-0.5 pr-2">
                <span className="text-[10px] font-black text-blue-400 uppercase tracking-wider block">
                  بوابة الدفع الآمنة
                </span>
                <h3 className="text-sm sm:text-base font-black text-white truncate max-w-[280px] sm:max-w-sm">
                  {selectedCourseToSubscribe.courseName}
                </h3>
              </div>
              <button
                onClick={() => setSelectedCourseToSubscribe(null)}
                className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all cursor-pointer shrink-0"
              >
                <X size={16} />
              </button>
            </div>

            {/* محتوى النوافذ القابل للتمرير بأمان */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs">
              <form onSubmit={handleCreateSubscription} id="subscription-form" className="space-y-4">
                
                {/* شريط المبلغ المطلوب */}
                <div className="p-3.5 bg-gradient-to-l from-emerald-50 to-teal-50 border-2 border-emerald-200/80 rounded-2xl flex items-center justify-between shadow-2xs">
                  <span className="font-black text-emerald-900 flex items-center gap-2">
                    <CreditCard size={16} className="text-emerald-700" /> المبلغ المستحق:
                  </span>
                  <span className="text-base font-black text-emerald-700">{selectedCourseToSubscribe.price}</span>
                </div>

                {/* اسم الطالب */}
                <div className="space-y-1.5">
                  <label className="font-black text-slate-700 flex items-center gap-1.5">
                    <User size={14} className="text-blue-600" /> اسم الطالب الثلاثي:
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="أدخل اسمك كاملاً للمتابعة"
                    value={studentNameInput}
                    onChange={(e) => setStudentNameInput(e.target.value)}
                    className="w-full p-3 bg-slate-50 border-2 border-slate-200 rounded-2xl font-bold text-slate-800 focus:outline-none focus:border-blue-600 focus:bg-white transition-all shadow-2xs"
                  />
                </div>

                {/* اختيار وسيلة الدفع بتصميم جمالي حديث */}
                <div className="space-y-2">
                  <label className="font-black text-slate-700 flex items-center gap-1.5">
                    <CreditCard size={14} className="text-blue-600" /> اختر طريقة التحويل:
                  </label>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod("vodafone")}
                      className={`p-3 rounded-2xl border-2 font-black flex items-center justify-center gap-2 transition-all cursor-pointer ${
                        paymentMethod === "vodafone"
                          ? "border-red-500 bg-red-50/80 text-red-700 shadow-sm"
                          : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      <Smartphone size={18} className="text-red-600 shrink-0" />
                      <span>فودافون كاش</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentMethod("instapay")}
                      className={`p-3 rounded-2xl border-2 font-black flex items-center justify-center gap-2 transition-all cursor-pointer ${
                        paymentMethod === "instapay"
                          ? "border-purple-500 bg-purple-50/80 text-purple-700 shadow-sm"
                          : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      <Building2 size={18} className="text-purple-600 shrink-0" />
                      <span>إنستاباي</span>
                    </button>
                  </div>
                </div>

                {/* كارت عرض بيانات التحويل المخصص (شكل أنيق للغاية للرقم أو الحساب مع زر نسخ) */}
                <div className="p-4 bg-gradient-to-br from-blue-900 to-indigo-900 text-white rounded-2xl space-y-2.5 shadow-md relative overflow-hidden border border-blue-400/20">
                  <div className="absolute top-0 left-0 w-24 h-24 bg-white/5 rounded-full blur-xl pointer-events-none" />
                  
                  <div className="flex items-center justify-between text-[11px] font-bold text-blue-200 border-b border-white/10 pb-2">
                    <span>{paymentMethod === "vodafone" ? "رقم فودافون كاش المعتمد للتحويل" : "عنوان إنستاباي (InstaPay) المعتمد"}</span>
                    <span className="px-2 py-0.5 bg-white/15 rounded-lg text-[10px] text-amber-300">مباشر</span>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1">
                    <span className="text-sm sm:text-base font-black tracking-wider text-white select-all font-mono">
                      {paymentMethod === "vodafone" ? teacherPaymentInfo.vodafone_cash_number : teacherPaymentInfo.instapay_username}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyText(paymentMethod === "vodafone" ? teacherPaymentInfo.vodafone_cash_number : teacherPaymentInfo.instapay_username)}
                      className="px-3 py-1.5 bg-white text-blue-950 hover:bg-blue-50 rounded-xl font-black text-xs flex items-center gap-1.5 transition-all shadow-sm shrink-0 cursor-pointer"
                    >
                      {copiedText === (paymentMethod === "vodafone" ? teacherPaymentInfo.vodafone_cash_number : teacherPaymentInfo.instapay_username) ? (
                        <>
                          <Check size={14} className="text-emerald-600" />
                          <span className="text-emerald-700">تم النسخ</span>
                        </>
                      ) : (
                        <>
                          <Copy size={14} />
                          <span>نسخ</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* رقم الهاتف المحول منه */}
                <div className="space-y-1.5">
                  <label className="font-black text-slate-700 flex items-center gap-1.5">
                    <Hash size={14} className="text-blue-600" /> رقم هاتفك المحول منه:
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="اكتب الرقم الذي قمت بالتحويل منه بدقة"
                    value={paymentNumberInput}
                    onChange={(e) => setPaymentNumberInput(e.target.value)}
                    className="w-full p-3 bg-slate-50 border-2 border-slate-200 rounded-2xl font-bold text-slate-800 focus:outline-none focus:border-blue-600 focus:bg-white transition-all shadow-2xs"
                  />
                </div>

                {/* رفع الإيصال */}
                <div className="space-y-1.5">
                  <label className="font-black text-slate-700 flex items-center gap-1.5">
                    <FileCheck size={14} className="text-blue-600" /> إرفاق صورة إيصال التحويل:
                  </label>
                  
                  <div className={`border-2 border-dashed rounded-2xl p-4 text-center transition-all relative cursor-pointer ${receiptFile ? 'border-emerald-400 bg-emerald-50/40' : 'border-slate-300 bg-slate-50/50 hover:border-blue-400 hover:bg-blue-50/20'}`}>
                    <input
                      type="file"
                      accept="image/*"
                      required
                      onChange={(e) => setReceiptFile(e.target.files ? e.target.files[0] : null)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    
                    <div className="space-y-1.5 pointer-events-none">
                      {receiptFile ? (
                        <div className="flex items-center justify-center gap-2 text-emerald-800 font-black">
                          <Check size={16} className="text-emerald-600" />
                          <span className="truncate max-w-[240px]">{receiptFile.name}</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-1 text-slate-500">
                          <Upload size={18} className="text-blue-600" />
                          <span className="font-bold text-slate-700">اضغط هنا لرفع صورة الإيصال أو اسحبها</span>
                          <span className="text-[10px] text-slate-400">PNG, JPG حتى لو كانت لقطة شاشة (Screenshot)</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

              </form>
            </div>

            {/* ذيل النافذة (أزرار الإجراء ثابتة في الأسفل) */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setSelectedCourseToSubscribe(null)}
                className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-black transition-all cursor-pointer text-xs"
              >
                إلغاء
              </button>
              <button
                type="submit"
                form="subscription-form"
                disabled={isSubmitting}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-xl font-black shadow-md transition-all cursor-pointer flex items-center gap-2 text-xs"
              >
                <ShieldCheck size={16} />
                <span>{isSubmitting ? "جاري الإرسال..." : "تأكيد وإرسال الإيصال"}</span>
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}