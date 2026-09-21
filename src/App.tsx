import { useCallback, useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { AlertTriangle, Loader2, LogOut } from "lucide-react";
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

function FullScreen({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen items-center justify-center p-4 text-slate-700" dir="rtl">
      <div className="max-w-md space-y-4 rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl">
        {children}
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
      <div className="flex h-screen items-center justify-center gap-2 font-bold text-slate-600" dir="rtl">
        <Loader2 className="animate-spin" size={22} />
        جاري التحميل...
      </div>
    );
  }

  if (access === "guest") {
    // من غير الحارس ده، كل الصفحات كانت بتفتح وتطلع فاضية لأن RLS بترفض
    // أي طلب من غير جلسة، والطالب مش هيفهم السبب.
    return (
      <FullScreen>
        <AlertTriangle size={36} className="mx-auto text-amber-500" />
        <h1 className="text-lg font-black text-slate-900">يجب تسجيل الدخول للدخول على لوحة الطالب</h1>
        <p className="text-sm text-slate-500">انتهت جلستك أو لم تسجّل الدخول بعد.</p>
        <a
          href={LOGIN_URL}
          className="inline-block rounded-2xl bg-blue-600 px-6 py-3 text-sm font-bold text-white shadow-md transition-colors hover:bg-blue-700"
        >
          الذهاب لصفحة تسجيل الدخول
        </a>
      </FullScreen>
    );
  }

  if (access === "not-student") {
    return (
      <FullScreen>
        <AlertTriangle size={36} className="mx-auto text-rose-500" />
        <h1 className="text-lg font-black text-slate-900">هذه اللوحة مخصصة للطلاب</h1>
        <p className="text-sm text-slate-500">حسابك مسجّل كمعلم.</p>
        <div className="flex flex-wrap justify-center gap-2">
          <a
            href={TEACHER_HOME}
            className="rounded-2xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-blue-700"
          >
            الذهاب للوحة المعلم
          </a>
          <button
            type="button"
            onClick={handleSignOut}
            className="inline-flex items-center gap-2 rounded-2xl bg-slate-100 px-5 py-2.5 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-200"
          >
            <LogOut size={15} />
            تسجيل الخروج
          </button>
        </div>
      </FullScreen>
    );
  }

  /* ---------- لوحة الطالب ---------- */

  return (
    <div className="flex h-screen overflow-hidden" dir="rtl">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} onSignOut={handleSignOut} />

      <div className="flex h-full flex-1 flex-col overflow-hidden transition-all lg:pr-72">
        <Header onOpenSidebar={() => setIsSidebarOpen(true)} onSignOut={handleSignOut} />

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
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
              {/* المسار كان مكتوب /Grades بحرف كبير بينما القائمة الجانبية
                  بتوديك على /grades. اتوحّد على الحرف الصغير. */}
              <Route path="/grades" element={<Grades />} />
              {/* أي مسار غلط يرجّع للرئيسية بدل صفحة بيضا */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </main>
      </div>
    </div>
  );
}