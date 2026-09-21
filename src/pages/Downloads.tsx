import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  FileText,
  Download,
  Search,
  BookOpen,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  FolderArchive,
  AlertCircle,
  Lock,
  GraduationCap
} from "lucide-react";
import { supabase } from "../lib/supabaseClient";

export default function DownloadsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [downloadingFileKey, setDownloadingFileKey] = useState<string | null>(null);

  const [downloadsRecords, setDownloadsRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDownloadsAndSubscriptions();
  }, []);

  const fetchDownloadsAndSubscriptions = async () => {
    setLoading(true);
    try {
      // 1. جلب الملفات المرفقة بالكورسات
      const { data: filesData, error: filesError } = await supabase
        .from("course_files")
        .select("*")
        .order("id", { ascending: false });

      if (filesError) throw filesError;

      // 2. جلب الكورسات لمعرفة ما إذا كانت مجانية أم مدفوعة ومعرفة الـ IDs
      const { data: coursesData, error: coursesError } = await supabase
        .from("courses")
        .select("id, course_name, is_free");

      if (coursesError) throw coursesError;

      // 3. جلب الاشتراكات الفعالة للطالب
      const { data: subsData, error: subsError } = await supabase
        .from("subscriptions")
        .select("course_id, status");

      if (subsError) console.error("Error fetching subscriptions:", subsError);

      const activeCourseIds = new Set(
        (subsData || [])
          .filter((sub: any) => sub.status === "active")
          .map((sub: any) => sub.course_id)
      );

      // ربط الملفات بمعلومات الكورس وحالة الاشتراك
      if (filesData) {
        const formatted = filesData.map((item) => {
          // محاولة مطابقة الملف بالكورس عبر course_id أو مطابقة بالاسم
          const matchedCourse = (coursesData || []).find(
            (c: any) => c.id === item.course_id || c.course_name === item.course_name
          );

          const courseId = matchedCourse ? matchedCourse.id : null;
          const isFree = matchedCourse ? matchedCourse.is_free : false;
          const isEnrolled = courseId ? activeCourseIds.has(courseId) : false;

          // يمكن التحميل إذا كان الكورس مجانياً أو كان الطالب مشتركاً وتم قبول اشتراكه
          const hasAccess = isFree || isEnrolled;

          return {
            id: item.id,
            title: item.title,
            courseName: item.course_name,
            category: item.specialty || "عام",
            description: item.description,
            filesInfo: item.files_info || [],
            courseId: courseId,
            isFree: isFree,
            hasAccess: hasAccess, // هل مسموح له بالتحميل؟
            date: new Date(item.created_at).toLocaleDateString("ar-EG", {
              day: "numeric",
              month: "long",
              year: "numeric",
            }),
          };
        });
        setDownloadsRecords(formatted);
      }
    } catch (err: any) {
      console.error("خطأ في جلب الملفات والاشتراكات:", err.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredDownloads = downloadsRecords.filter((item) => {
    const matchesSearch =
      item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.courseName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.category && item.category.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesCategory = filterCategory === "all" || item.category === filterCategory;

    return matchesSearch && matchesCategory;
  });

  const handleDownloadSingleFile = (fileObj: any, record: any, fileKey: string) => {
    // التحقق مرة أخرى أماناً قبل التحميل
    if (!record.hasAccess) {
      alert("عذراً، يجب عليك الاشتراك في الكورس أولاً ودفع الرسوم لتتمكن من تحميل هذه الملفات.");
      return;
    }

    setDownloadingFileKey(fileKey);
    setTimeout(() => {
      if (fileObj.data) {
        const a = document.createElement("a");
        a.href = fileObj.data;
        a.download = fileObj.name || "downloaded_file";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
      setDownloadingFileKey(null);
    }, 600);
  };

  const uniqueCategories = Array.from(
    new Set(downloadsRecords.map((item) => item.category).filter(Boolean))
  );

  return (
    <div className="space-y-6 sm:space-y-8 text-slate-800 min-h-screen" dir="rtl">
      
      <div className="relative overflow-hidden bg-gradient-to-br from-blue-700 via-indigo-700 to-blue-900 rounded-2xl sm:rounded-3xl p-5 sm:p-8 shadow-xl text-white border border-white/10">
        <div className="absolute -top-12 -right-12 w-64 h-64 sm:w-96 sm:h-96 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-64 h-64 sm:w-96 sm:h-96 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-2.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/15 backdrop-blur-md text-white text-[11px] sm:text-xs font-bold rounded-full border border-white/20 shadow-xs">
              <Sparkles size={13} className="text-blue-200" />
              مركز التحميل والمصادر التعليمية - منصة Z E D
            </span>
            <h1 className="text-xl sm:text-3xl font-black tracking-wide leading-snug">
              المذكرات والملفات والمستندات الدراسية 📂
            </h1>
            <p className="text-xs sm:text-sm text-blue-100 max-w-2xl leading-relaxed">
              تظهر هنا جميع ملفات الكورسات المضافة. تتطلب الكورسات المدفوعة اشتراكاً مفَعلاً لتنزيل محتوياتها.
            </p>
          </div>

          <Link
            to="/courses"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 sm:px-5 sm:py-3 bg-white text-blue-700 hover:bg-blue-50 active:scale-95 rounded-xl sm:rounded-2xl text-xs font-black shadow-md transition-all self-start md:self-auto border border-blue-100"
          >
            <ArrowRight size={15} />
            <span>العودة للكورسات</span>
          </Link>
        </div>
      </div>

      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="relative flex-1">
            <span className="absolute inset-y-0 right-0 flex items-center pr-3.5 pointer-events-none text-blue-600">
              <Search size={18} />
            </span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ابحث باسم الملف، المستند، أو اسم الكورس..."
              className="w-full pr-10 pl-4 py-3 bg-slate-50/70 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white transition-all shadow-2xs"
            />
          </div>

          <div className="text-xs font-bold text-slate-500 bg-slate-100/70 px-4 py-2.5 rounded-xl border border-slate-200/60 text-center shrink-0">
            الحزم المتوفرة: <span className="text-blue-600 font-black">{filteredDownloads.length}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1.5 pt-2 border-t border-slate-100 scrollbar-none">
          <span className="text-xs font-bold text-slate-400 shrink-0 ml-1">التصنيف:</span>
          <button
            onClick={() => setFilterCategory("all")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 border ${
              filterCategory === "all"
                ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            }`}
          >
            كل التخصصات
          </button>
          {uniqueCategories.map((cat, idx) => (
            <button
              key={idx}
              onClick={() => setFilterCategory(cat)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 border ${
                filterCategory === cat
                  ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="py-24 text-center text-slate-400 text-xs font-bold space-y-2">
          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p>جاري تحميل المصادر والملفات التعليمية...</p>
        </div>
      ) : filteredDownloads.length === 0 ? (
        <div className="py-20 text-center space-y-3 bg-white border border-slate-200 rounded-3xl p-6">
          <AlertCircle size={40} className="text-blue-600 mx-auto" />
          <p className="text-sm font-bold text-slate-700">عذراً، لا توجد ملفات مطابقة لخيارات البحث أو الفلترة.</p>
          <button
            onClick={() => { setSearchTerm(""); setFilterCategory("all"); }}
            className="text-xs font-bold text-blue-600 underline hover:text-blue-800 transition-colors"
          >
            إعادة تعيين خيارات البحث
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
          {filteredDownloads.map((record) => (
            <div
              key={record.id}
              className="bg-white border-2 border-slate-200/90 rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-xs hover:border-blue-500 hover:shadow-xl transition-all duration-300 flex flex-col justify-between space-y-4 group"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="p-2.5 rounded-2xl bg-blue-50 text-blue-600 border border-blue-200/80 shadow-2xs shrink-0">
                    <FolderArchive size={20} />
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-xl border ${
                      record.hasAccess 
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                        : 'bg-rose-50 text-rose-700 border-rose-200'
                    }`}>
                      {record.hasAccess ? (record.isFree ? 'مجاني متاح' : 'مسجل ومفعل') : 'غير مشترك (مقفل)'}
                    </span>
                    <span className="text-[11px] font-bold px-3 py-1 bg-indigo-50 text-indigo-700 rounded-xl border border-indigo-200/80 truncate">
                      {record.category}
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <h3 className="text-sm sm:text-base font-black text-slate-900 group-hover:text-blue-600 transition-colors leading-snug">
                    {record.title}
                  </h3>
                  <p className="text-xs text-blue-600 font-bold flex items-center gap-1.5">
                    <BookOpen size={14} className="shrink-0" />
                    <span className="truncate">الكورس: {record.courseName}</span>
                  </p>
                </div>

                {record.description && (
                  <p className="text-xs text-slate-500 bg-slate-50/80 p-3 rounded-xl border border-slate-200/60 font-medium leading-relaxed">
                    {record.description}
                  </p>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 space-y-2.5">
                <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                  <span>الملفات المرفقة:</span>
                  <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md text-[10px]">
                    {record.filesInfo?.length || 0} ملفات
                  </span>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto pr-0.5 scrollbar-thin">
                  {record.filesInfo && record.filesInfo.map((file: any, fIndex: number) => {
                    const fileKey = `${record.id}-${fIndex}`;
                    const isDownloading = downloadingFileKey === fileKey;

                    return (
                      <div 
                        key={fIndex} 
                        className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 bg-slate-50/90 hover:bg-blue-50/70 p-3 rounded-xl border border-slate-200/80 text-xs transition-all"
                      >
                        <div className="flex items-center gap-2.5 truncate">
                          <div className="p-2 bg-white rounded-lg border border-slate-200 text-blue-600 shrink-0">
                            <FileText size={16} />
                          </div>
                          <div className="flex flex-col truncate">
                            <span className="font-bold text-slate-800 truncate" title={file.name}>
                              {file.name}
                            </span>
                            <span className="text-[10px] text-slate-400 font-semibold">
                              {file.size || "مستند تعليمي"}
                            </span>
                          </div>
                        </div>

                        {record.hasAccess ? (
                          <button
                            onClick={() => handleDownloadSingleFile(file, record, fileKey)}
                            disabled={isDownloading}
                            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-xl font-bold text-xs shadow-xs transition-all shrink-0 cursor-pointer"
                          >
                            {isDownloading ? (
                              <>
                                <CheckCircle2 size={14} className="animate-spin" />
                                <span>جاري التحميل...</span>
                              </>
                            ) : (
                              <>
                                <Download size={14} />
                                <span>تحميل الملف</span>
                              </>
                            )}
                          </button>
                        ) : (
                          <Link
                            to="/courses"
                            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-bold text-xs transition-all shrink-0"
                          >
                            <Lock size={13} className="text-rose-600" />
                            <span>يجب الاشتراك (مغلق)</span>
                          </Link>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          ))}
        </div>
      )}

    </div>
  );
}