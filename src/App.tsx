import { useCallback, useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { AlertTriangle, Loader2, LogOut, ShieldAlert, UserCheck, ArrowRight } from "lucide-react";
import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import { supabase } from "./lib/supabaseClient";

import HomePage from "./pages/HomePage";
import Courses from "./pages/Courses";
import Videos from "./pages/Videos";
import Downloads from "./pages/Downloads";
import Quizzes from "./pages/Quizzes";
import Assignments from "./pages/Assignments";
import Grades from "./pages/Grades";
import Profile from "./pages/Profile";
import CourseCard from "./pages/CourseCard";
import Notifications from "./pages/Notifications";

import "./index.css";

/* ================================================================== */
/*  إعدادات                                                            */
/* ================================================================== */

const LOGIN_URL = import.meta.env.VITE_LOGIN_URL ?? "/login";
const TEACHER_HOME = import.meta.env.VITE_TEACHER_HOME ?? "/teacher";

type Access = "loading" | "guest" | "not-student" | "student";

/* ================================================================== */
/*  مكون شاشة العرض الكاملة للحالات الخاصة (تصميم عصري متطور)           */
/* ================================================================== */

function FullScreen({ 
  children, 
  icon: Icon, 
  iconBgColor = "bg-blue-50 text-blue-600",
  title,
  description
}: { 
  children: React.ReactNode;
  icon: React.ElementType;
  iconBgColor?: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-slate-100 to-indigo-50/30 p-4 text-slate-700" dir="rtl">
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-slate-200/80 bg-white/80 p-8 text-center shadow-2xl backdrop-blur-xl">
        {/* تأثير جمالي في الخلفية */}
        <div className="absolute -top-24 -left-24 h-48 w-48 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 h-48 w-48 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col items-center">
          {/* الأيقونة */}
          <div className={`mb-5 flex h-16 w-16 items-center justify-center rounded-2xl shadow-sm ${iconBgColor}`}>
            <Icon size={32} />
          </div>

          {/* العنوان ووصف الحالة */}
          <h1 className="mb-2 text-xl font-extrabold text-slate-900">{title}</h1>
          <p className="mb-6 text-sm text-slate-500 leading-relaxed">{description}</p>

          {/* الأزرار والإجراءات */}
          <div className="w-full space-y-3">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ================================================================== */
/*  التطبيق                                                            */
/* ================================================================== */

export default function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [, setSession] = useState<Session | null>(null);
  const [access, setAccess] = useState<Access>("loading");

  const resolveAccess = useCallback(async (current: Session | null) => {
    if (!current?.user) {
      setSession(null);
      setAccess("guest");
      return;
    }
    setSession(current);

    const { data } = await supabase.from("profiles").select("role").eq("id", current.user.id).maybeSingle();
    const role = data?.role ?? current.user.user_metadata?.role;
    setAccess(role === "teacher" ? "not-student" : "student");
  }, []);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (active) void resolveAccess(data.session);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, current) => {
      if (active) void resolveAccess(current);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [resolveAccess]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.replace(LOGIN_URL);
  };

  /* ---------- الحالات قبل الدخول ---------- */

  if (access === "loading") {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-slate-50 font-bold text-slate-600" dir="rtl">
        <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-md">
          <Loader2 className="animate-spin text-indigo-600" size={28} />
        </div>
        <span className="text-sm font-medium tracking-wide">جاري التحميل، يرجى الانتظار...</span>
      </div>
    );
  }

  if (access === "guest") {
    return (
      <FullScreen 
        icon={ShieldAlert}
        iconBgColor="bg-amber-50 text-amber-600"
        title="يجب تسجيل الدخول للوصول"
        description="انتهت صلاحية جلستك أو أنك لم تقم بتسجيل الدخول بعد. يرجى تسجيل الدخول لمتابعة التعلم."
      >
        <a
          href={LOGIN_URL}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-100 transition-all hover:bg-indigo-700 hover:shadow-indigo-200"
        >
          <span>الذهاب لصفحة تسجيل الدخول</span>
          <ArrowRight size={16} className="rotate-180" />
        </a>
      </FullScreen>
    );
  }

  if (access === "not-student") {
    return (
      <FullScreen 
        icon={AlertTriangle}
        iconBgColor="bg-rose-50 text-rose-600"
        title="هذه اللوحة مخصصة للطلاب فقط"
        description="حسابك الحالي مسجّل بصلاحية معلم ولا يمكنه استعراض لوحة تحكم الطلاب."
      >
        <div className="flex flex-col gap-2.5 w-full">
          <a
            href={TEACHER_HOME}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-100 transition-all hover:bg-indigo-700"
          >
            <UserCheck size={16} />
            <span>الذهاب للوحة المعلم</span>
          </a>
          <button
            type="button"
            onClick={handleSignOut}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-100 px-5 py-3 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-200"
          >
            <LogOut size={16} />
            <span>تسجيل الخروج</span>
          </button>
        </div>
      </FullScreen>
    );
  }

  /* ---------- لوحة الطالب الأساسية ---------- */

  return (
    <div className="flex h-screen overflow-hidden" dir="rtl">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} onSignOut={handleSignOut} />

      <div className="flex h-full flex-1 flex-col overflow-hidden transition-all lg:pr-72">
        <Header onOpenSidebar={() => setIsSidebarOpen(true)} onSignOut={handleSignOut} />

        <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-50/50">
          <div className="mx-auto max-w-[1600px]">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/courses" element={<Courses />} />
              <Route path="/videos" element={<Videos />} />
              <Route path="/subscriptions" element={<CourseCard />} />
              <Route path="/files" element={<Downloads />} />
              <Route path="/live" element={<Quizzes />} />
              <Route path="/assignments" element={<Assignments />} />
              <Route path="/notifications" element={<Notifications />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/grades" element={<Grades />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </main>
      </div>
    </div>
  );
}
