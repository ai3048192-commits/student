import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabaseClient";
import {
  BookOpen,
  Radio,
  Users,
  MessageSquare,
  Send,
  Video,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  VideoOff,
  ExternalLink,
  Volume2,
  VolumeX,
  Lock,
  Globe,
  Clock
} from "lucide-react";

export default function CoursesAndLivePage() {
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLiveCourse, setSelectedLiveCourse] = useState<any | null>(null);

  // تخزين الحصص التي تم دخولها مسبقاً في المتصفح لمنع التكرار
  const [attendedSessions, setAttendedSessions] = useState<string[]>([]);

  const [chatMessage, setChatMessage] = useState("");
  const [chatHistory, setChatHistory] = useState<any[]>([]);
  const [viewerCount, setViewerCount] = useState(1);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    fetchLiveSessions();
    
    const savedAttended = localStorage.getItem("attended_live_sessions");
    if (savedAttended) {
      try {
        setAttendedSessions(JSON.parse(savedAttended));
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  const fetchLiveSessions = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('live_sessions')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error("خطأ في جلب الحصص:", error.message);
    } else {
      setCourses(data || []);
    }
    setLoading(false);
  };

  // دالة التعامل مع دخول الحصة مع التحقق الدقيق جداً من الوقت المحلي
  const handleEnterLive = (course: any) => {
    const courseIdStr = String(course.id);
    
    // 1. التحقق الصارم من الوقت والتاريخ
    if (!course.session_date || !course.session_time) {
      alert("عذراً، هذه الحصة ليس لها موعد محدد مسجل بدقة.");
      return;
    }

    const [year, month, day] = course.session_date.split('-').map(Number);
    const timeParts = course.session_time.split(':').map(Number);
    const hours = timeParts[0] || 0;
    const minutes = timeParts[1] || 0;
    
    const sessionDateTime = new Date(year, month - 1, day, hours, minutes);
    const now = new Date();

    if (now < sessionDateTime) {
      alert(`عذراً، لم يبدأ موعد الحصة بعد! ⏳\nالموعد المحدد هو: ${course.session_date} في تمام الساعة ${course.session_time}.`);
      return;
    }

    // 2. التأكد من عدم حضورها مسبقاً
    if (attendedSessions.includes(courseIdStr)) {
      alert("عذراً، لقد قمت بالدخول إلى هذا البث المباشر من قبل وخرجت منه. لا يمكنك الدخول إليه مرة أخرى.");
      return;
    }

    // 3. التحقق من البث الخارجي أو الداخلي
    const externalLink = course.url || course.meeting_url || course.external_link;
    const isExternal = course.is_internal === false || Boolean(externalLink);

    if (isExternal && externalLink) {
      const updatedAttended = [...attendedSessions, courseIdStr];
      setAttendedSessions(updatedAttended);
      localStorage.setItem("attended_live_sessions", JSON.stringify(updatedAttended));
      window.open(externalLink, "_blank");
      return;
    }

    setSelectedLiveCourse(course);
  };

  const handleLeaveLive = () => {
    if (selectedLiveCourse) {
      const courseIdStr = String(selectedLiveCourse.id);
      if (!attendedSessions.includes(courseIdStr)) {
        const updatedAttended = [...attendedSessions, courseIdStr];
        setAttendedSessions(updatedAttended);
        localStorage.setItem("attended_live_sessions", JSON.stringify(updatedAttended));
      }
    }
    setSelectedLiveCourse(null);
  };

  useEffect(() => {
    if (!selectedLiveCourse) return;

    const fetchMessages = async () => {
      const { data } = await supabase
        .from('live_chat_messages')
        .select('*')
        .eq('session_id', selectedLiveCourse.id)
        .order('created_at', { ascending: true });
      
      if (data) setMessagesFormatted(data);
    };

    fetchMessages();

    navigator.mediaDevices?.getUserMedia({ video: true, audio: true })
      .then((stream) => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      })
      .catch((err) => console.log("تعذر استقبال الكاميرا:", err));

    const channel = supabase
      .channel(`public:live_session_${selectedLiveCourse.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'live_chat_messages',
          filter: `session_id=eq.${selectedLiveCourse.id}`,
        },
        (payload) => {
          const newMsg = payload.new;
          setChatHistory((prev) => [
            ...prev,
            {
              sender: newMsg.sender_name || "مشارك",
              text: newMsg.message,
              time: new Date(newMsg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }
          ]);
        }
      )
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        setViewerCount(Object.keys(state).length || 1);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ online_at: new Date().toISOString() });
        }
      });

    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
      supabase.removeChannel(channel);
    };
  }, [selectedLiveCourse]);

  const setMessagesFormatted = (data: any[]) => {
    const formatted = data.map(msg => ({
      sender: msg.sender_name || "مشارك",
      text: msg.message,
      time: new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }));
    setChatHistory(formatted);
  };

  const handleSendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessage.trim() || !selectedLiveCourse) return;

    const messageText = chatMessage;
    setChatMessage("");

    await supabase.from('live_chat_messages').insert([
      {
        session_id: selectedLiveCourse.id,
        sender_name: "أنت (طالب)",
        message: messageText
      }
    ]);
  };

  return (
    <div className="space-y-8 bg-white text-slate-800 min-h-screen pb-16" dir="rtl">
      
      {/* هيدر الصفحة */}
      <div className="relative overflow-hidden bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-700 rounded-3xl p-6 sm:p-8 shadow-xl text-white border border-blue-500/20">
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3">
            <span className="px-3.5 py-1 bg-white/25 backdrop-blur-md text-white text-xs font-bold rounded-full inline-flex items-center gap-1.5 border border-white/30">
              <Sparkles size={13} />
              منصة Z E D  - قاعات الحصص المباشرة والتعليم التفاعلي
            </span>
            <h1 className="text-2xl sm:text-4xl font-black tracking-wide">
              {selectedLiveCourse ? `قاعة البث: ${selectedLiveCourse.title}` : "اختر الحصة وانطلق إلى البث المباشر 🚀"}
            </h1>
            <p className="text-sm text-blue-100 max-w-2xl leading-relaxed">
              {selectedLiveCourse 
                ? "أنت الآن داخل قاعة المحاضرة الحية. الشات يعمل بشكل فوري لحظي." 
                : "تنبيه: الأزرار ستعمل تلقائياً فقط عندما يحين موعد البث المحدد بدقة."}
            </p>
          </div>

          {selectedLiveCourse && (
            <button
              onClick={handleLeaveLive}
              className="px-5 py-3 bg-white text-blue-700 hover:bg-blue-50 rounded-2xl text-xs font-black shadow-lg transition-all flex items-center gap-2 self-start md:self-auto"
            >
              <ArrowRight size={16} />
              <span>الخروج والعودة لقائمة الحصص</span>
            </button>
          )}
        </div>
      </div>

      {!selectedLiveCourse ? (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
              <BookOpen size={20} className="text-blue-600" /> الحصص والكورسات المباشرة المتاحة ({courses.length})
            </h2>
          </div>

          {loading ? (
            <div className="py-16 text-center text-slate-500 font-bold text-sm">جاري جلب الحصص المباشرة من قاعدة البيانات...</div>
          ) : courses.length === 0 ? (
            <div className="py-16 text-center space-y-3 bg-slate-50 border border-slate-200 rounded-3xl">
              <VideoOff size={36} className="text-blue-500 mx-auto" />
              <p className="text-sm font-bold text-slate-700">لا توجد حصص مباشرة مسجلة حالياً من قبل المعلم.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {courses.map((course) => {
                const isAlreadyAttended = attendedSessions.includes(String(course.id));
                const externalLink = course.url || course.meeting_url || course.external_link;
                const isExternal = course.is_internal === false || Boolean(externalLink);

                // فحص هل حان الوقت أم لا لتعطيل الزر مرئياً
                let isTimeNotYet = false;
                if (course.session_date && course.session_time) {
                  const [y, m, d] = course.session_date.split('-').map(Number);
                  const tp = course.session_time.split(':').map(Number);
                  const sessionDt = new Date(y, m - 1, d, tp[0] || 0, tp[1] || 0);
                  if (new Date() < sessionDt) {
                    isTimeNotYet = true;
                  }
                }

                return (
                  <div
                    key={course.id}
                    className={`bg-white border-2 rounded-3xl p-6 shadow-xs transition-all duration-300 flex flex-col justify-between space-y-6 group ${
                      isAlreadyAttended || isTimeNotYet ? "border-slate-200 opacity-85 bg-slate-50/50" : "border-blue-100 hover:border-blue-400 hover:shadow-xl"
                    }`}
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="px-2.5 py-1 bg-blue-50 text-blue-700 text-[10px] font-bold rounded-lg border border-blue-200 inline-block">
                          {course.subject || "عام"}
                        </span>
                        
                        {isAlreadyAttended ? (
                          <span className="text-[10px] font-bold text-slate-500 bg-slate-200 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                            <Lock size={10} /> تم الاستهلاك والانتهاء
                          </span>
                        ) : isTimeNotYet ? (
                          <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200 flex items-center gap-1">
                            <Clock size={10} /> لم يحن الموعد بعد ⏳
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-200 animate-pulse flex items-center gap-1">
                            <Radio size={10} /> متاح الآن للبث 🔴
                          </span>
                        )}
                      </div>

                      <h3 className="text-base font-black text-slate-800 group-hover:text-blue-600 transition-colors">
                        {course.title}
                      </h3>

                      <p className="text-xs text-slate-500 font-semibold flex items-center gap-1">
                        <Users size={14} className="text-blue-600" /> البرنامج: <strong className="text-slate-800">{course.course}</strong>
                      </p>

                      <div className="text-[11px] text-slate-500 font-bold pt-1 flex items-center gap-1 bg-slate-50 p-2 rounded-xl border border-slate-100">
                        <Clock size={13} className="text-blue-600" /> موعد البث: {course.session_date} | {course.session_time}
                      </div>
                    </div>

                    {isAlreadyAttended ? (
                      <button
                        disabled
                        className="w-full py-3 px-4 bg-slate-200 text-slate-500 rounded-2xl flex items-center justify-center gap-2 text-xs font-black cursor-not-allowed"
                      >
                        <Lock size={16} />
                        <span>عذراً، لقد قمت بحضور هذا البث مسبقاً</span>
                      </button>
                    ) : isTimeNotYet ? (
                      <button
                        disabled
                        className="w-full py-3 px-4 bg-slate-200 text-slate-500 rounded-2xl flex items-center justify-center gap-2 text-xs font-black cursor-not-allowed border border-slate-300"
                      >
                        <Clock size={16} />
                        <span>سيفتح الزر تلقائياً في الموعد المحدد ⏰</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleEnterLive(course)}
                        className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-2xl transition-all flex items-center justify-center gap-2 text-xs font-black shadow-md hover:scale-[1.02]"
                      >
                        {isExternal && externalLink ? <ExternalLink size={16} /> : <Radio size={16} className="animate-pulse" />}
                        <span>{isExternal && externalLink ? "الانتقال للبث الخارجي 🔗" : "دخول القاعة والبث المباشر 🔴"}</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          <div className="lg:col-span-2 space-y-4">
            <div className="relative bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border-2 border-blue-100 aspect-video flex items-center justify-center">
              
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted={isMuted}
                className="w-full h-full object-cover"
              />

              <div className="absolute top-4 right-4 left-4 flex items-center justify-between z-10 pointer-events-none">
                <div className="flex items-center gap-2 bg-rose-600 text-white px-3 py-1 rounded-full text-xs font-bold shadow-md">
                  <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                  <span>بث المعلم (صوت وصورة حي)</span>
                </div>

                <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md text-white px-3 py-1 rounded-full text-xs font-semibold border border-white/10">
                  <Users size={14} className="text-blue-400" />
                  <span>{viewerCount} طالب متصل</span>
                </div>
              </div>

              <div className="absolute bottom-4 right-4 z-20 flex items-center gap-2">
                <button
                  onClick={() => setIsMuted(!isMuted)}
                  className="px-3.5 py-2 bg-slate-900/80 hover:bg-slate-800 text-white rounded-xl text-xs font-bold backdrop-blur-md flex items-center gap-1.5 shadow-lg transition-all border border-white/10"
                >
                  {isMuted ? <VolumeX size={16} className="text-rose-400" /> : <Volume2 size={16} className="text-emerald-400" />}
                  <span>{isMuted ? "إلغاء كتم الصوت" : "الصوت مفعل"}</span>
                </button>
              </div>
            </div>

            <div className="bg-white border-2 border-blue-100 rounded-3xl p-6 shadow-xs space-y-3">
              <h2 className="text-base font-black text-slate-800 flex items-center gap-2">
                <CheckCircle2 size={18} className="text-blue-600" />
                أنت الآن تشاهد بث: {selectedLiveCourse.title}
              </h2>
              <p className="text-xs text-slate-600 leading-relaxed">
                تحذير: بمجرد النقر على زر "الخروج والعودة لقائمة الحصص"، سيتم قفل هذه الحصة ولن يمكنك الدخول إليها مرة أخرى أبداً من هذا المتصفح.
              </p>
            </div>
          </div>

          {/* صندوق الشات الفوري اللحظي */}
          <div className="bg-white border-2 border-blue-100 rounded-3xl shadow-xs overflow-hidden flex flex-col h-[500px] lg:h-auto">
            
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-white/20 rounded-xl">
                  <MessageSquare size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-black">الشات الفوري الحقيقي</h3>
                  <p className="text-[10px] text-blue-100">يحدث تلقائياً بدون رفرش</p>
                </div>
              </div>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            </div>

            <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-50/50">
              {chatHistory.length === 0 ? (
                <div className="text-center text-xs text-slate-400 py-10 font-bold">لا توجد رسائل بعد، كن أول المشاركين!</div>
              ) : (
                chatHistory.map((msg, idx) => {
                  const isMe = msg.sender.includes("أنت");
                  return (
                    <div key={idx} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                      <div className="flex items-center gap-1.5 mb-1 px-1">
                        <span className="text-[10px] font-bold text-slate-600">{msg.sender}</span>
                        <span className="text-[9px] text-slate-400">{msg.time}</span>
                      </div>
                      <div className={`max-w-[90%] p-3 rounded-2xl text-xs font-semibold ${
                        isMe 
                          ? "bg-blue-600 text-white rounded-bl-none shadow-xs" 
                          : "bg-white text-slate-800 border border-slate-200 rounded-br-none shadow-xs"
                      }`}>
                        {msg.text}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <form onSubmit={handleSendChatMessage} className="p-3 bg-white border-t border-slate-100 flex items-center gap-2">
              <input
                type="text"
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                placeholder="اكتب سؤالك في البث المباشر..."
                className="flex-1 px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-blue-500"
              />
              <button
                type="submit"
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-1"
              >
                <span>إرسال</span>
                <Send size={13} />
              </button>
            </form>

          </div>

        </div>
      )}

    </div>
  );
}