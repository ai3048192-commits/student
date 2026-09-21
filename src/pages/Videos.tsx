import { useState, useEffect, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  PlayCircle,
  ArrowRight,
  BookOpen,
  Bookmark,
  Share2,
  Send,
  User,
  Star,
  Clock,
  Users,
  Award,
  Maximize,
  FileText,
  Download,
} from "lucide-react";
import { supabase } from "../lib/supabaseClient";

export default function VideosPage() {
  const [searchParams] = useSearchParams();
  const courseId = searchParams.get("courseId");

  const [courseData, setCourseData] = useState<any>(null);
  const [lessonsList, setLessonsList] = useState<any[]>([]);
  const [courseFiles, setCourseFiles] = useState<any[]>([]);
  const [currentLessonIndex, setCurrentLessonIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState("content");
  const [newComment, setNewComment] = useState("");
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [shareNotification, setShareNotification] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [comments, setComments] = useState([
    {
      id: 1,
      user: "طالب مميز",
      time: "منذ ساعة",
      text: "الشرح ممتاز والفيديو يعمل بوضوح تام، شكراً لجهودك.",
    },
  ]);

  const formatVideoUrl = (url: string) => {
    if (
      !url ||
      typeof url !== "string" ||
      url.startsWith("blob:") ||
      url.includes("localhost") ||
      url.trim() === ""
    ) {
      return "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4";
    }

    if (url.includes("youtube.com/watch?v=")) {
      const videoId = url.split("v=")[1]?.split("&")[0];
      return `https://www.youtube.com/embed/${videoId}`;
    }
    if (url.includes("youtu.be/")) {
      const videoId = url.split("youtu.be/")[1]?.split("?")[0];
      return `https://www.youtube.com/embed/${videoId}`;
    }

    return url;
  };

  const isYouTubeUrl = (url: string) => {
    return (
      url &&
      (url.includes("youtube.com/embed") ||
        url.includes("youtube.com") ||
        url.includes("youtu.be"))
    );
  };

  useEffect(() => {
    const fetchCourseAndVideos = async () => {
      if (!courseId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        // 1. جلب بيانات الكورس الأساسية
        const { data: courseItem, error: courseError } = await supabase
          .from("courses")
          .select("*")
          .eq("id", courseId)
          .single();

        if (courseError) throw courseError;

        if (courseItem) {
          setCourseData(courseItem);

          // معالجة الفيديوهات
          let rawVideos =
            courseItem.videos_list || courseItem.videos || courseItem.content;
          if (typeof rawVideos === "string") {
            try {
              rawVideos = JSON.parse(rawVideos);
            } catch (e) {
              rawVideos = [];
            }
          }

          if (Array.isArray(rawVideos) && rawVideos.length > 0) {
            const formattedLessons = rawVideos.map((item: any, idx: number) => {
              const foundKey =
                typeof item === "object" && item !== null
                  ? Object.keys(item).find((key) => {
                      const val = item[key];
                      return (
                        typeof val === "string" &&
                        (val.startsWith("http") ||
                          val.includes("blob:") ||
                          val.includes("/") ||
                          val.includes("."))
                      );
                    })
                  : null;

              const rawUrl =
                item.videoUrl ||
                item.mediaUrl ||
                item.url ||
                item.fileUrl ||
                item.link ||
                item.video ||
                item.src ||
                (foundKey ? item[foundKey] : "") ||
                (typeof item === "string" ? item : "");

              const finalUrl = formatVideoUrl(rawUrl);

              return {
                id: item.id || idx + 1,
                title:
                  item.title ||
                  item.fileName ||
                  item.name ||
                  `الدرس رقم ${idx + 1}`,
                duration: item.duration || "مفتوح",
                videoUrl: finalUrl,
                isYouTube: isYouTubeUrl(finalUrl),
              };
            });
            setLessonsList(formattedLessons);
          } else {
            const directVideo = courseItem.video_url || courseItem.link || "";
            const formattedDirectUrl = formatVideoUrl(directVideo);

            setLessonsList([
              {
                id: 1,
                title: courseItem.course_name || "الدرس الرئيسي للكورس",
                duration: "مفتوح",
                videoUrl: formattedDirectUrl,
                isYouTube: isYouTubeUrl(formattedDirectUrl),
              },
            ]);
          }

          // 2. جلب الملفات والمرفقات المرتبطة من جدول course_files بناءً على اسم الكورس (course_name)
          const { data: filesData, error: filesError } = await supabase
            .from("course_files")
            .select("*")
            .eq("course_name", courseItem.course_name);

          if (!filesError && filesData && filesData.length > 0) {
            // تجميع جميع الملفات الموجودة داخل حقل files_info لكل السجلات المرتبطة بهذا الكورس
            let allExtractedFiles: any[] = [];
            filesData.forEach((record: any) => {
              let fInfo = record.files_info;
              if (typeof fInfo === "string") {
                try {
                  fInfo = JSON.parse(fInfo);
                } catch (e) {
                  fInfo = [];
                }
              }
              if (Array.isArray(fInfo)) {
                fInfo.forEach((fileItem: any, fIdx: number) => {
                  allExtractedFiles.push({
                    id: fileItem.id || `${record.id}_${fIdx}`,
                    name:
                      fileItem.name ||
                      fileItem.fileName ||
                      fileItem.title ||
                      `ملف مرفق`,
                    url:
                      fileItem.data ||
                      fileItem.url ||
                      fileItem.fileUrl ||
                      fileItem.link ||
                      "#",
                    size: fileItem.size || "ملف تعليمي",
                  });
                });
              }
            });
            setCourseFiles(allExtractedFiles);
          } else {
            // كخيار احتياطي: فحص ما إذا كانت الملفات مخزنة مباشرة داخل جدول courses
            let rawFiles =
              courseItem.files_list ||
              courseItem.files ||
              courseItem.attachments ||
              courseItem.documents;
            if (typeof rawFiles === "string") {
              try {
                rawFiles = JSON.parse(rawFiles);
              } catch (e) {
                rawFiles = [];
              }
            }

            if (Array.isArray(rawFiles) && rawFiles.length > 0) {
              const formattedFiles = rawFiles.map(
                (fileItem: any, idx: number) => ({
                  id: fileItem.id || idx + 1,
                  name:
                    fileItem.name ||
                    fileItem.fileName ||
                    fileItem.title ||
                    `ملف مرفق ${idx + 1}`,
                  url:
                    fileItem.url ||
                    fileItem.fileUrl ||
                    fileItem.link ||
                    (typeof fileItem === "string" ? fileItem : "#"),
                  size: fileItem.size || "ملف تعليمي",
                }),
              );
              setCourseFiles(formattedFiles);
            } else {
              setCourseFiles([]);
            }
          }
        }
      } catch (err: any) {
        console.error("Error fetching course data:", err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchCourseAndVideos();
  }, [courseId]);

  const currentLesson = lessonsList[currentLessonIndex] || lessonsList[0];

  const handleFullScreen = () => {
    if (videoRef.current) {
      if (videoRef.current.requestFullscreen) {
        videoRef.current.requestFullscreen();
      } else if ((videoRef.current as any).webkitRequestFullscreen) {
        (videoRef.current as any).webkitRequestFullscreen();
      }
    }
  };

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    setComments([
      ...comments,
      {
        id: Date.now(),
        user: "أنت (طالب المنصة)",
        time: "الآن",
        text: newComment,
      },
    ]);
    setNewComment("");
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setShareNotification(true);
    setTimeout(() => setShareNotification(false), 3000);
  };

  if (loading) {
    return (
      <div
        className="py-20 text-center text-slate-500 font-bold text-xs"
        dir="rtl"
      >
        جاري تحميل بيانات الكورس والفيديو... ⏳
      </div>
    );
  }

  return (
    <div
      className="space-y-8 bg-white text-slate-800 min-h-screen pb-12 px-4 sm:px-6"
      dir="rtl"
    >
      {shareNotification && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-blue-600 text-white px-5 py-2.5 rounded-2xl shadow-xl text-xs font-bold animate-bounce">
          تم نسخ رابط الدرس بنجاح! 🔗
        </div>
      )}

      <div className="flex items-center justify-between bg-blue-50/50 border border-blue-100 rounded-2xl p-4">
        <div className="flex items-center gap-3">
          <Link
            to="/courses"
            className="p-2 bg-white hover:bg-blue-600 hover:text-white text-blue-600 rounded-xl border border-blue-200 transition-all shadow-xs flex items-center gap-1.5 text-xs font-bold"
          >
            <ArrowRight size={16} />
            <span>العودة للكورسات</span>
          </Link>
          <div className="h-5 w-px bg-blue-200 hidden sm:block" />
          <div>
            <span className="text-[10px] text-blue-600 font-bold block">
              {courseData?.course_name || "منصة التعليم"}
            </span>
            <h1 className="text-sm sm:text-base font-black text-slate-800">
              {currentLesson?.title || "الدرس الحالي"}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsBookmarked(!isBookmarked)}
            className={`p-2 rounded-xl border transition-all text-xs font-bold flex items-center gap-1 ${
              isBookmarked
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white hover:bg-blue-50 text-slate-600 border-blue-200"
            }`}
          >
            <Bookmark size={15} />
            <span className="hidden md:inline">
              {isBookmarked ? "محفوظ" : "حفظ"}
            </span>
          </button>
          <button
            onClick={handleShare}
            className="p-2 bg-white hover:bg-blue-50 text-slate-600 rounded-xl border border-blue-200 transition-all text-xs font-bold flex items-center gap-1"
          >
            <Share2 size={15} />
            <span className="hidden md:inline">مشاركة</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-blue-50/50 border border-blue-100 p-4 rounded-2xl flex items-center gap-3 shadow-xs">
          <div className="p-3 bg-blue-600 text-white rounded-xl shadow-xs">
            <Clock size={20} />
          </div>
          <div>
            <span className="text-[11px] text-slate-500 font-bold block">
              مواعيد الكورس
            </span>
            <span className="text-sm font-black text-slate-800">
              {courseData?.show_times || "مفتوح"}
            </span>
          </div>
        </div>
        <div className="bg-blue-50/50 border border-blue-100 p-4 rounded-2xl flex items-center gap-3 shadow-xs">
          <div className="p-3 bg-blue-600 text-white rounded-xl shadow-xs">
            <Users size={20} />
          </div>
          <div>
            <span className="text-[11px] text-slate-500 font-bold block">
              الطلاب المسجلين
            </span>
            <span className="text-sm font-black text-slate-800">
              {courseData?.students_count || 0} طالب
            </span>
          </div>
        </div>
        <div className="bg-blue-50/50 border border-blue-100 p-4 rounded-2xl flex items-center gap-3 shadow-xs">
          <div className="p-3 bg-blue-600 text-white rounded-xl shadow-xs">
            <Star size={20} className="fill-white" />
          </div>
          <div>
            <span className="text-[11px] text-slate-500 font-bold block">
              تقييم الكورس
            </span>
            <span className="text-sm font-black text-slate-800">4.9 / 5.0</span>
          </div>
        </div>
        <div className="bg-blue-50/50 border border-blue-100 p-4 rounded-2xl flex items-center gap-3 shadow-xs">
          <div className="p-3 bg-blue-600 text-white rounded-xl shadow-xs">
            <Award size={20} />
          </div>
          <div>
            <span className="text-[11px] text-slate-500 font-bold block">
              حالة التفعيل
            </span>
            <span className="text-sm font-black text-emerald-600">مفعل ✓</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-slate-900 rounded-3xl overflow-hidden shadow-xl border-2 border-blue-900/25 aspect-video relative flex items-center justify-center">
            {currentLesson?.videoUrl ? (
              currentLesson.isYouTube ? (
                <iframe
                  src={currentLesson.videoUrl}
                  title={currentLesson.title}
                  className="w-full h-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                ></iframe>
              ) : (
                <video
                  ref={videoRef}
                  key={currentLesson.videoUrl}
                  controls
                  playsInline
                  preload="auto"
                  className="w-full h-full object-contain bg-black"
                >
                  <source src={currentLesson.videoUrl} />
                  متصفحك لا يدعم تشغيل هذا الفيديو.
                </video>
              )
            ) : (
              <div className="text-white text-xs font-bold p-6 text-center">
                عذراً، لم يتم العثور على رابط فيديو لهذا الدرس.
              </div>
            )}

            {!currentLesson?.isYouTube && currentLesson?.videoUrl && (
              <button
                onClick={handleFullScreen}
                className="absolute top-4 left-4 p-2.5 bg-black/60 hover:bg-black/80 backdrop-blur-md text-white rounded-xl transition-all flex items-center gap-1.5 text-xs font-bold border border-white/20 shadow-lg z-10"
              >
                <Maximize size={16} />
                <span>ملء الشاشة</span>
              </button>
            )}
          </div>

          <div className="bg-white border-2 border-blue-100 rounded-3xl p-5 shadow-xs space-y-4">
            <div className="flex items-center gap-2 border-b border-blue-100 pb-3">
              <button
                onClick={() => setActiveTab("content")}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeTab === "content"
                    ? "bg-blue-600 text-white shadow-xs"
                    : "bg-blue-50/50 text-slate-600 hover:bg-blue-100"
                }`}
              >
                تفاصيل الكورس والمحتوى
              </button>
              <button
                onClick={() => setActiveTab("discussion")}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeTab === "discussion"
                    ? "bg-blue-600 text-white shadow-xs"
                    : "bg-blue-50/50 text-slate-600 hover:bg-blue-100"
                }`}
              >
                النقاشات ({comments.length})
              </button>
            </div>

            {activeTab === "content" && (
              <div className="space-y-6 text-xs text-slate-700 leading-relaxed">
                <div className="space-y-2">
                  <h3 className="text-sm font-black text-slate-900">
                    وصف ومحاور الكورس بالكامل:
                  </h3>
                  <p className="whitespace-pre-wrap leading-loose text-slate-600 bg-blue-50/30 p-4 rounded-2xl border border-blue-100/60">
                    {courseData?.description ||
                      courseData?.details ||
                      courseData?.overview ||
                      "لا يوجد وصف تفصيلي مسجل لهذا الكورس حتى الآن."}
                  </p>
                </div>

                {/* منطقة عرض الملفات والمرفقات المضافة للكورس (مربوطة بجدول course_files) */}
                <div className="space-y-3 pt-2 border-t border-blue-100">
                  <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                    <FileText size={18} className="text-blue-600" />
                    <span>ملفات ومرفقات الكورس التعليمية:</span>
                  </h3>

                  {courseFiles.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {courseFiles.map((file, idx) => (
                        <div
                          key={file.id || idx}
                          className="flex items-center justify-between p-3 bg-blue-50/40 border border-blue-100 rounded-2xl hover:border-blue-300 transition-all"
                        >
                          <div className="flex items-center gap-2.5 overflow-hidden">
                            <div className="p-2 bg-blue-600 text-white rounded-xl shrink-0">
                              <FileText size={16} />
                            </div>
                            <div className="truncate">
                              <span className="font-bold text-slate-800 block truncate text-xs">
                                {file.name}
                              </span>
                              <span className="text-[10px] text-slate-400 block">
                                {file.size}
                              </span>
                            </div>
                          </div>
                          <a
                            href={file.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            download={file.name}
                            className="p-2 bg-white text-blue-600 hover:bg-blue-600 hover:text-white border border-blue-200 rounded-xl transition-all shadow-xs shrink-0 flex items-center gap-1 font-bold text-[11px]"
                            title="تحميل الملف"
                          >
                            <Download size={14} />
                            <span>تحميل</span>
                          </a>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-400 bg-slate-50 p-4 rounded-2xl border border-slate-100 text-center">
                      لا توجد ملفات مرفقة مع هذا الكورس حالياً.
                    </p>
                  )}
                </div>
              </div>
            )}

            {activeTab === "discussion" && (
              <div className="space-y-4">
                <form onSubmit={handleAddComment} className="flex gap-2">
                  <input
                    type="text"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="اكتب استفسارك هنا..."
                    className="flex-1 px-4 py-2 bg-blue-50/40 border border-blue-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-blue-500"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-xs"
                  >
                    <Send size={14} />
                    <span>إرسال</span>
                  </button>
                </form>

                <div className="space-y-3 pt-2">
                  {comments.map((comment) => (
                    <div
                      key={comment.id}
                      className="p-3.5 bg-blue-50/30 border border-blue-100 rounded-2xl space-y-1.5"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-blue-900 flex items-center gap-1.5">
                          <User size={13} className="text-blue-600" />{" "}
                          {comment.user}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {comment.time}
                        </span>
                      </div>
                      <p className="text-xs text-slate-700 leading-relaxed pr-5">
                        {comment.text}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white border-2 border-blue-100 rounded-3xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-blue-100 pb-3">
              <h3 className="text-sm font-black text-slate-800 flex items-center gap-1.5">
                <BookOpen size5 size={16} className="text-blue-600" /> قائمة
                الدروس
              </h3>
              <span className="text-[10px] font-bold px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg border border-blue-200">
                {lessonsList.length} درس
              </span>
            </div>

            <div className="space-y-2 max-h-[500px] overflow-y-auto pl-1">
              {lessonsList.map((lesson, idx) => {
                const isSelected = idx === currentLessonIndex;
                return (
                  <button
                    key={lesson.id || idx}
                    onClick={() => setCurrentLessonIndex(idx)}
                    className={`w-full text-right p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                      isSelected
                        ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                        : "bg-white hover:bg-blue-50/50 text-slate-700 border-blue-100"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 overflow-hidden">
                      <PlayCircle
                        size={15}
                        className={`shrink-0 ${isSelected ? "text-white" : "text-blue-600"}`}
                      />
                      <div className="truncate">
                        <span className="text-xs font-bold block truncate">
                          {lesson.title}
                        </span>
                        <span
                          className={`text-[10px] block ${isSelected ? "text-blue-100" : "text-slate-400"}`}
                        >
                          {lesson.duration || "مفتوح"}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
