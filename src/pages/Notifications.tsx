import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Bell,
  Clock,
  ArrowRight,
  Sparkles,
  MessageSquare,
  XCircle,
  FileText,
  Award,
  CalendarCheck,
  Megaphone,
  CheckCheck,
  AlertTriangle,
  ShieldAlert,
  Flame,
  Info,
  Loader2,
  Trash2,
} from "lucide-react";
import { supabase } from "../lib/supabaseClient";

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // حالات نافذة التفاصيل (Modal)
  const [selectedNotification, setSelectedNotification] = useState<any | null>(null);

  // حالة فتح نافذة الشات الخاص مع المدرس
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [activeInstructor, setActiveInstructor] = useState("");
  const [chatMessage, setChatMessage] = useState("");
  const [chatHistory, setChatHistory] = useState([
    { sender: "instructor", text: "أهلاً بك يا بطل. أنا أتابع معك تفاصيل هذا الإشعار، تفضل بطرح استفسارك أو عذرك." }
  ]);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("my_notifications")
        .select("*")
        .eq("recipient_type", "students")
        .order("id", { ascending: false });

      if (error) throw error;

      if (data) {
        const formatted = data.map(item => ({
          ...item,
          type: item.custom_type || "announcement",
          isRead: item.isRead || false,
          course: item.course || item.recipient_label || "عام / المنصة التعليمية",
          instructor: item.instructor || "إدارة المنصة",
          summary: item.message ? item.message.substring(0, 80) + "..." : "",
          detailedReason: item.message,
          actionRequired: item.actionRequired || "مراجعة تفاصيل التنبيه"
        }));
        setNotifications(formatted);
      }
    } catch (error) {
      console.error("خطأ في جلب التنبيهات للطلاب:", error);
    } finally {
      setLoading(false);
    }
  };

  // دالة مسح الإشعار أو الرسالة من قاعدة البيانات
  const handleDeleteNotification = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation(); // منع فتح نافذة التفاصيل عند الضغط على زر الحذف
    if (window.confirm("هل أنت متأكد من حذف هذه الرسالة؟")) {
      try {
        const { error } = await supabase
          .from("my_notifications")
          .delete()
          .eq("id", id);

        if (error) throw error;

        // تحديث الواجهة بحذف العنصر مباشرة
        setNotifications((prev) => prev.filter((n) => n.id !== id));
        if (selectedNotification?.id === id) {
          setSelectedNotification(null);
        }
      } catch (error: any) {
        console.error("خطأ في مسح الإشعار:", error);
        alert(`حدث خطأ أثناء الحذف: ${error?.message || "تأكد من صلاحيات الحذف"}`);
      }
    }
  };

  // تحديد إشعار معين كمقروء وفتح نافذة التفاصيل الخاصة به
  const handleOpenNotificationDetails = (notif: any) => {
    setSelectedNotification(notif);
    setNotifications((prev) =>
      prev.map((n) => (n.id === notif.id ? { ...n, isRead: true } : n))
    );
  };

  // تحديد الكل كمقروء
  const handleMarkAllAsRead = () => {
    setNotifications((prev) => prev.map((notif) => ({ ...notif, isRead: true })));
  };

  // فتح الشات مع مدرس معين
  const openChatWithInstructor = (instructorName: string, notifTitle: string) => {
    setActiveInstructor(instructorName);
    setChatHistory([
      { sender: "instructor", text: `أهلاً بك. بخصوص موضوع (${notifTitle})، أنا أسمعك تماماً، تفضل بتوضيح ما لديك لنحل المشكلة سوياً.` }
    ]);
    setIsChatOpen(true);
  };

  const handleSendChatMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessage.trim()) return;

    const newMsg = { sender: "student", text: chatMessage };
    setChatHistory((prev) => [...prev, newMsg]);
    setChatMessage("");

    setTimeout(() => {
      setChatHistory((prev) => [
        ...prev,
        { sender: "instructor", text: "تم استلام رسالتك وتوضيحك بنجاح، سأقوم بمراجعة الحالة الأكاديمية واتخاذ الإجراء اللازم معك فوراً." }
      ]);
    }, 1000);
  };

  const getNotificationStyle = (type: string) => {
    switch (type) {
      case "warning_expulsion":
      case "تنبيه عاجل":
        return {
          icon: <ShieldAlert className="text-red-600 animate-bounce" size={22} />,
          bgClass: "bg-red-50/80 border-red-300 shadow-sm",
          badgeClass: "bg-red-100 text-red-800",
        };
      case "penalty_exam":
      case "تحذير":
        return {
          icon: <AlertTriangle className="text-amber-600" size={22} />,
          bgClass: "bg-amber-50/80 border-amber-300 shadow-sm",
          badgeClass: "bg-amber-100 text-amber-800",
        };
      case "achievement":
        return {
          icon: <Flame className="text-purple-600" size={22} />,
          bgClass: "bg-purple-50/80 border-purple-200 shadow-sm",
          badgeClass: "bg-purple-100 text-purple-800",
        };
      case "grade":
        return {
          icon: <Award className="text-emerald-600" size={20} />,
          bgClass: "bg-white border-slate-200",
          badgeClass: "bg-emerald-100 text-emerald-800",
        };
      case "chat":
        return {
          icon: <MessageSquare className="text-blue-600" size={20} />,
          bgClass: "bg-white border-slate-200",
          badgeClass: "bg-blue-100 text-blue-800",
        };
      case "lecture":
        return {
          icon: <CalendarCheck className="text-indigo-600" size={20} />,
          bgClass: "bg-white border-slate-200",
          badgeClass: "bg-indigo-100 text-indigo-800",
        };
      default:
        return {
          icon: <Megaphone className="text-blue-500" size={20} />,
          bgClass: "bg-white border-slate-200",
          badgeClass: "bg-blue-100 text-blue-800",
        };
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-8 bg-white text-slate-800 min-h-screen pb-16" dir="rtl">
      
      <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-indigo-900 to-blue-900 rounded-3xl p-6 sm:p-8 shadow-xl text-white border border-blue-500/20">
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3">
            <span className="px-3.5 py-1 bg-white/20 backdrop-blur-md text-white text-xs font-bold rounded-full inline-flex items-center gap-1.5 border border-white/30">
              <Sparkles size={13} />
              مركز الإشعارات والتنبيهات المباشر - منصة Z E D
            </span>
            <h1 className="text-2xl sm:text-4xl font-black tracking-wide">
              سجل التنبيهات الشامل للطلاب 🔔⚡
            </h1>
            <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
              هذه الإشعارات تصلك مباشرة من لوحة الإدارة وقاعدة بيانات Supabase لحظة بلحظة.
            </p>
          </div>

          <Link
            to="/courses"
            className="px-5 py-3 bg-white text-slate-900 hover:bg-slate-100 rounded-2xl text-xs font-black shadow-lg transition-all flex items-center gap-2 self-start md:self-auto"
          >
            <ArrowRight size={16} />
            <span>العودة للكورسات</span>
          </Link>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
        <div className="flex items-center gap-2">
          <Bell size={20} className="text-blue-600" />
          <h2 className="text-sm font-black text-slate-800">
            إجمالي التنبيهات ({notifications.length}) - غير المقروء ({notifications.filter(n => !n.isRead).length})
          </h2>
        </div>

        <button
          onClick={handleMarkAllAsRead}
          className="px-4 py-2 bg-white hover:bg-slate-100 text-blue-700 rounded-xl text-xs font-black transition-all shadow-xs border border-blue-200 inline-flex items-center gap-2 self-start sm:self-auto"
        >
          <CheckCheck size={16} />
          <span>تحديد الكل كمقروء</span>
        </button>
      </div>

      <div className="space-y-4">
        {notifications.length === 0 ? (
          <div className="text-center py-12 bg-slate-50 rounded-3xl border border-slate-200 text-slate-500 font-bold">
            لا توجد تنبيهات حالياً موجهة للطلاب في قاعدة البيانات.
          </div>
        ) : (
          notifications.map((notif) => {
            const style = getNotificationStyle(notif.custom_type || notif.type);
            return (
              <div
                key={notif.id}
                onClick={() => handleOpenNotificationDetails(notif)}
                className={`p-5 rounded-3xl border-2 transition-all duration-300 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:border-blue-400 hover:shadow-md ${
                  notif.isRead ? "bg-white border-slate-200 opacity-80 hover:opacity-100" : style.bgClass
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-2xl shrink-0 bg-white shadow-sm border border-slate-100">
                    {style.icon}
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-md ${style.badgeClass}`}>
                        {notif.custom_type || "تنبيه عام"}
                      </span>
                      <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">
                        {notif.recipient_label || "موجه للطلاب"}
                      </span>
                      {!notif.isRead && (
                        <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-ping" />
                      )}
                    </div>

                    <h3 className="text-sm font-black text-slate-900">
                      {notif.title}
                    </h3>

                    <p className="text-xs text-slate-700 font-semibold leading-relaxed">
                      {notif.message}
                    </p>

                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-bold pt-1">
                      <Clock size={13} />
                      <span>{notif.time || "الآن"}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end md:self-auto pt-2 md:pt-0 border-t md:border-t-0 border-slate-200 w-full md:w-auto justify-end">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenNotificationDetails(notif);
                    }}
                    className="px-4 py-2.5 bg-slate-900 hover:bg-blue-600 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs"
                  >
                    <Info size={14} />
                    <span>التفاصيل</span>
                  </button>
                  <button
                    onClick={(e) => handleDeleteNotification(notif.id, e)}
                    className="px-3 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl text-xs font-bold transition-all flex items-center gap-1 shadow-xs border border-rose-200"
                    title="حذف الرسالة"
                  >
                    <Trash2 size={14} />
                    <span>حذف</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {selectedNotification && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            
            <div className="bg-gradient-to-r from-slate-900 to-indigo-900 p-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-white/25 backdrop-blur-md rounded-xl text-white">
                  <FileText size={20} />
                </div>
                <div>
                  <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded font-bold text-blue-200">
                    {selectedNotification.recipient_label || "تنبيه أكاديمي"}
                  </span>
                  <h3 className="text-sm sm:text-base font-black mt-0.5">تفاصيل الإشعار</h3>
                </div>
              </div>
              <button
                onClick={() => setSelectedNotification(null)}
                className="text-white hover:bg-white/20 p-1.5 rounded-xl transition-all"
              >
                <XCircle size={22} />
              </button>
            </div>

            <div className="p-6 space-y-5 overflow-y-auto bg-slate-50/50 flex-1 text-xs sm:text-sm">
              <div className="space-y-2 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                <h4 className="font-black text-slate-900 text-base">{selectedNotification.title}</h4>
                <p className="text-slate-600 font-semibold leading-relaxed">{selectedNotification.message}</p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-white p-3 rounded-xl border border-slate-200">
                  <span className="text-slate-400 block font-bold">نوع التنبيه:</span>
                  <strong className="text-slate-900 font-black">{selectedNotification.custom_type}</strong>
                </div>
                <div className="bg-white p-3 rounded-xl border border-slate-200">
                  <span className="text-slate-400 block font-bold">جهة الاستقبال:</span>
                  <strong className="text-blue-700 font-black">{selectedNotification.recipient_label}</strong>
                </div>
              </div>
            </div>

            <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-between gap-3">
              <button
                onClick={() => setSelectedNotification(null)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-all"
              >
                إغلاق
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => handleDeleteNotification(selectedNotification.id, e)}
                  className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs transition-all shadow-md flex items-center gap-1.5"
                >
                  <Trash2 size={14} />
                  <span>حذف الإشعار</span>
                </button>

                <button
                  onClick={() => {
                    const instructorName = "إدارة المنصة";
                    const title = selectedNotification.title;
                    setSelectedNotification(null);
                    openChatWithInstructor(instructorName, title);
                  }}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs transition-all shadow-md flex items-center gap-2"
                >
                  <MessageSquare size={15} />
                  <span>فتح الشات الفوري</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {isChatOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col h-[520px]">
            
            <div className="bg-gradient-to-r from-slate-900 to-blue-900 p-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center font-bold text-sm">
                  👨‍🏫
                </div>
                <div>
                  <h3 className="text-sm font-black">محادثة مع: {activeInstructor}</h3>
                  <p className="text-[10px] text-slate-300">محادثة خاصة لحل المشكلة الأكاديمية</p>
                </div>
              </div>
              <button
                onClick={() => setIsChatOpen(false)}
                className="text-white hover:bg-white/20 p-1.5 rounded-xl transition-all"
              >
                <XCircle size={20} />
              </button>
            </div>

            <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-50">
              {chatHistory.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.sender === "student" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] p-3 rounded-2xl text-xs font-semibold ${
                      msg.sender === "student"
                        ? "bg-blue-600 text-white rounded-bl-none shadow-sm"
                        : "bg-white text-slate-900 border border-slate-200 shadow-xs rounded-br-none"
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}
            </div>

            <form onSubmit={handleSendChatMessage} className="p-3 bg-white border-t border-slate-200 flex items-center gap-2">
              <input
                type="text"
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                placeholder="اكتب ردك هنا..."
                className="flex-1 px-4 py-2.5 bg-slate-100 border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:border-blue-600"
              />
              <button
                type="submit"
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-md"
              >
                إرسال
              </button>
            </form>

          </div>
        </div>
      )}

    </div>
  );
}