import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { ChangeEvent, FormEvent, ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  Camera,
  Check,
  Edit3,
  Globe,
  KeyRound,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Save,
  Shield,
  ShieldCheck,
  Sparkles,
  User,
  X,
  XCircle,
} from "lucide-react";
import { supabase } from "../lib/supabaseClient";

/* ================================================================== */
/*  Types & constants                                                 */
/* ================================================================== */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;
type NoticeType = "success" | "error";
type PageStatus = "loading" | "ready" | "no-user" | "error";

interface StudentForm {
  name: string;
  email: string;
  phone: string;
  country: string;
  city: string;
  bio: string;
}

const TABLE = "students_profile";
const BUCKET = "student-avatars";
const DEFAULT_ROLE = "طالب";
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const LOCALE = "ar-EG-u-nu-latn";

const EMPTY_FORM: StudentForm = { name: "", email: "", phone: "", country: "", city: "", bio: "" };

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

const toLatinDigits = (value: string) =>
  value
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)));

const toForm = (row: Row | null, fallbackEmail: string): StudentForm => ({
  name: row?.name || "",
  email: row?.email || fallbackEmail,
  phone: row?.phone || "",
  country: row?.country || "",
  city: row?.city || "",
  bio: row?.bio || "",
});

const normalize = (form: StudentForm): StudentForm => ({
  ...form,
  name: form.name.trim(),
  email: form.email.trim(),
  phone: toLatinDigits(form.phone).replace(/[\s-]/g, ""),
  country: form.country.trim(),
  city: form.city.trim(),
  bio: form.bio.trim(),
});

const validate = (form: StudentForm): string | null => {
  if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return "البريد الإلكتروني غير صحيح.";
  if (form.phone && !/^\+?\d{8,15}$/.test(form.phone)) return "رقم الهاتف غير صحيح.";
  return null;
};

const formatJoinDate = (row: Row | null, fallbackIso?: string) => {
  // join_date عمود نصي وممكن يكون مكتوب بأي شكل، فبنعرضه زي ما هو لو مش تاريخ
  const raw = row?.join_date || row?.created_at || fallbackIso;
  if (!raw) return "";
  const t = Date.parse(String(raw).replace(" ", "T"));
  if (Number.isNaN(t)) return String(raw);
  return new Date(t).toLocaleDateString(LOCALE, { year: "numeric", month: "long" });
};

const passwordErrorMessage = (err: unknown) => {
  const code = err && typeof err === "object" && "code" in err ? String((err as { code: unknown }).code) : "";
  if (code === "same_password") return "كلمة المرور الجديدة يجب أن تختلف عن الحالية.";
  if (code === "weak_password") return "كلمة المرور ضعيفة. استخدم حروفاً وأرقاماً ورموزاً.";
  if (code === "reauthentication_needed") return "لأسباب أمنية، سجّل الخروج ثم الدخول مرة أخرى وأعد المحاولة.";
  return "تعذّر تغيير كلمة المرور: " + errorMessage(err);
};

/* ================================================================== */
/*  Data layer                                                        */
/* ================================================================== */

async function fetchProfile(userId: string): Promise<Row | null> {
  const { data, error } = await supabase.from(TABLE).select("*").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return data;
}

async function saveProfile(userId: string, patch: Row): Promise<Row> {
  const { data, error } = await supabase
    .from(TABLE)
    .upsert({ user_id: userId, ...patch, updated_at: new Date().toISOString() }, { onConflict: "user_id" })
    .select()
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("لم يتم حفظ البيانات. غالباً صلاحيات RLS في Supabase تمنع العملية.");
  return data;
}

async function uploadAvatar(userId: string, file: File) {
  const ext = file.name.includes(".") ? file.name.split(".").pop()!.toLowerCase() : "jpg";
  // المسار بيبدأ بالـ user_id عشان سياسة الـ Storage تقدر تتحقق من صاحب الملف
  const path = `${userId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { path, publicUrl: data.publicUrl };
}

/* ================================================================== */
/*  UI primitives                                                     */
/* ================================================================== */

const INPUT =
  "w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm font-semibold text-slate-800 placeholder:font-normal placeholder:text-slate-400 transition-all focus:border-blue-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/15 disabled:cursor-default disabled:border-transparent";

const FOCUS_RING = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2";

function Field({
  label,
  icon,
  className,
  children,
}: {
  label: string;
  icon?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={cx("block space-y-1.5", className)}>
      <span className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
        {icon}
        {label}
      </span>
      {children}
    </label>
  );
}

function Modal({ title, icon, onClose, children }: { title: string; icon?: ReactNode; onClose: () => void; children: ReactNode }) {
  const titleId = useId();
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeRef.current();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-md space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl sm:p-8"
      >
        <div className="flex items-center justify-between gap-3">
          <h3 id={titleId} className="flex items-center gap-2 text-base font-black text-slate-900">
            {icon}
            {title}
          </h3>
          <button type="button" onClick={onClose} aria-label="إغلاق" className="text-slate-400 transition-colors hover:text-slate-700">
            <XCircle size={22} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ================================================================== */
/*  Page                                                              */
/* ================================================================== */

export default function ProfilePage() {
  const [status, setStatus] = useState<PageStatus>("loading");
  const [loadError, setLoadError] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [authEmail, setAuthEmail] = useState("");
  const [authCreatedAt, setAuthCreatedAt] = useState<string | undefined>(undefined);

  const [record, setRecord] = useState<Row | null>(null);
  const [form, setForm] = useState<StudentForm>(EMPTY_FORM);
  const [snapshot, setSnapshot] = useState<StudentForm>(EMPTY_FORM);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [passwordOpen, setPasswordOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  const [notice, setNotice] = useState<{ id: number; type: NoticeType; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const profileImage: string | null = record?.profile_image_url || null;
  const role: string = record?.role || DEFAULT_ROLE;
  const joinDate = formatJoinDate(record, authCreatedAt);
  const isDirty = isEditing && JSON.stringify(form) !== JSON.stringify(snapshot);

  const notify = useCallback((type: NoticeType, text: string) => setNotice({ id: Date.now(), type, text }), []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), notice.type === "error" ? 8000 : 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!isDirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isDirty]);

  const apply = useCallback((row: Row | null, fallbackEmail: string) => {
    const next = toForm(row, fallbackEmail);
    setRecord(row);
    setForm(next);
    setSnapshot(next);
  }, []);

  /* ---------- تحميل البيانات ---------- */

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      // الكود القديم كان فيه studentId ثابت = 1، يعني كل الطلاب كانوا بيقروا
      // ويكتبوا في نفس السجل. دلوقتي كل طالب في سجله هو.
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user) {
        setStatus("no-user");
        return;
      }
      setUserId(user.id);
      setAuthEmail(user.email ?? "");
      setAuthCreatedAt(user.created_at);
      apply(await fetchProfile(user.id), user.email ?? "");
      setStatus("ready");
    } catch (err) {
      console.error("خطأ في جلب بيانات الطالب:", err);
      setLoadError(errorMessage(err));
      setStatus("error");
    }
  }, [apply]);

  useEffect(() => {
    void load();
  }, [load]);

  /* ---------- الإجراءات ---------- */

  const setField = <K extends keyof StudentForm>(key: K, value: StudentForm[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const startEditing = () => {
    setSnapshot(form);
    setIsEditing(true);
  };

  // إلغاء التعديل بيرجّع القيم القديمة فعلاً، الكود القديم كان بيقفل الحقول بس
  const cancelEditing = () => {
    setForm(snapshot);
    setIsEditing(false);
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    const clean = normalize(form);
    const invalid = validate(clean);
    if (invalid) return notify("error", invalid);

    setSaving(true);
    try {
      const row = await saveProfile(userId, { ...clean, role: record?.role || DEFAULT_ROLE });
      apply(row, authEmail);
      setIsEditing(false);
      notify("success", "تم حفظ بياناتك بنجاح!");
    } catch (err) {
      notify("error", errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleImageChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // عشان اختيار نفس الصورة تاني يشتغل
    if (!file || !userId) return;
    if (!file.type.startsWith("image/")) return notify("error", "الرجاء اختيار ملف صورة.");
    if (file.size > MAX_IMAGE_BYTES) return notify("error", "حجم الصورة كبير. الحد الأقصى 5 ميجابايت.");

    setUploading(true);
    let uploadedPath: string | null = null;
    try {
      const { path, publicUrl } = await uploadAvatar(userId, file);
      uploadedPath = path;
      const row = await saveProfile(userId, { profile_image_url: publicUrl });
      setRecord(row);
      notify("success", "تم تحديث صورة الملف الشخصي بنجاح!");
    } catch (err) {
      // لو الحفظ في الجدول فشل، نشيل الملف المرفوع بدل ما يفضل يتيم في الـ Storage
      if (uploadedPath) void supabase.storage.from(BUCKET).remove([uploadedPath]);
      notify("error", "فشل رفع الصورة: " + errorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  const closePasswordModal = useCallback(() => {
    setPasswordOpen(false);
    setNewPassword("");
    setConfirmPassword("");
    setPasswordError("");
  }, []);

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    setPasswordError("");
    if (newPassword.length < 8) return setPasswordError("يجب ألا تقل كلمة المرور الجديدة عن 8 أحرف.");
    if (!/[A-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      return setPasswordError("يجب أن تحتوي كلمة المرور على حرف كبير ورقم واحد على الأقل.");
    }
    if (newPassword !== confirmPassword) return setPasswordError("كلمة المرور الجديدة وتأكيدها غير متطابقين.");

    setChangingPassword(true);
    // الكود القديم كان بيكتب كلمة المرور نص صريح في جدول student_security.
    // دلوقتي Supabase Auth هو اللي بيتولاها مشفّرة.
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setChangingPassword(false);

    if (error) return setPasswordError(passwordErrorMessage(error));
    closePasswordModal();
    notify("success", "تم تغيير كلمة المرور وحفظها بأمان! 🔒");
  };

  /* ---------- الحالات الخاصة ---------- */

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center font-bold text-blue-600" dir="rtl">
        <Loader2 size={36} className="animate-spin" />
      </div>
    );
  }

  if (status === "no-user" || status === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center p-4" dir="rtl">
        <div className="max-w-md space-y-4 rounded-3xl border border-slate-200/80 bg-white p-8 text-center shadow-xl">
          <AlertTriangle size={36} className="mx-auto text-rose-600" />
          <h1 className="text-lg font-black text-slate-900">
            {status === "no-user" ? "يجب تسجيل الدخول لعرض ملفك الشخصي" : "تعذّر تحميل بياناتك."}
          </h1>
          {status === "error" && <p className="text-sm text-slate-500">{loadError}</p>}
          <div className="flex flex-wrap justify-center gap-2">
            {status === "error" && (
              <button
                type="button"
                onClick={() => void load()}
                className="rounded-2xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-700"
              >
                إعادة المحاولة
              </button>
            )}
            <Link
              to="/courses"
              className="inline-flex items-center gap-2 rounded-2xl bg-slate-100 px-5 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-200"
            >
              <ArrowRight size={16} />
              العودة للكورسات
            </Link>
          </div>
        </div>
      </div>
    );
  }

  /* ---------- الصفحة ---------- */

  return (
    <div className={cx("min-h-screen space-y-6 text-slate-800 sm:space-y-8", isEditing && "pb-28")} dir="rtl">
      {/* ------------------------------ Banner ------------------------------ */}
      <header className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-indigo-950 to-blue-950 p-6 text-white shadow-2xl sm:p-10">
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-blue-500/20 blur-3xl sm:h-96 sm:w-96" />
        <div aria-hidden className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-indigo-500/15 blur-3xl sm:h-96 sm:w-96" />

        <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
          <div className="flex flex-col items-center gap-6 text-center sm:flex-row sm:items-start sm:text-right lg:items-center">
            <div className="relative shrink-0">
              <div className="h-28 w-28 overflow-hidden rounded-3xl bg-gradient-to-tr from-blue-600 via-indigo-500 to-cyan-400 p-1.5 shadow-2xl sm:h-32 sm:w-32">
                {profileImage ? (
                  <img src={profileImage} alt="الصورة الشخصية" className="h-full w-full rounded-[20px] object-cover" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center rounded-[20px] bg-slate-900 text-4xl shadow-inner">
                    👨‍💻
                  </span>
                )}
                {uploading && (
                  <span className="absolute inset-1.5 grid place-items-center rounded-[20px] bg-slate-900/60">
                    <Loader2 size={26} className="animate-spin" />
                  </span>
                )}
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                title="تغيير الصورة الشخصية"
                aria-label="تغيير الصورة الشخصية"
                className="absolute bottom-1 left-1 rounded-xl border border-white/20 bg-blue-600 p-2.5 text-white shadow-lg transition-transform hover:scale-105 hover:bg-blue-500 active:scale-95 disabled:opacity-60"
              >
                <Camera size={16} />
              </button>
            </div>

            <div className="space-y-2.5">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3.5 py-1 text-[11px] font-bold text-cyan-300 shadow-inner backdrop-blur-md">
                <Sparkles size={13} />
                بوابة الطالب الأكاديمية، منصة
                <span dir="ltr" className="tracking-[0.3em]">
                  ZED
                </span>
              </span>
              <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
                {record?.name || "أضف اسمك الشخصي"}
              </h1>
              <div className="flex flex-wrap items-center justify-center gap-3 text-xs font-medium text-slate-300 sm:justify-start sm:text-sm">
                <span className="rounded-lg border border-blue-500/20 bg-blue-500/10 px-2.5 py-0.5 font-bold text-blue-400">
                  {role}
                </span>
                {joinDate && (
                  <span className="flex items-center gap-1 text-slate-400">
                    <Calendar size={14} /> منضم منذ {joinDate}
                  </span>
                )}
              </div>
            </div>
          </div>

          <Link
            to="/courses"
            className={cx(
              FOCUS_RING,
              "flex items-center justify-center gap-2 self-stretch rounded-2xl border border-white/15 bg-white/10 px-5 py-3.5 text-xs font-black text-white shadow-lg backdrop-blur-md transition-all hover:scale-[1.02] hover:bg-white/20 active:scale-[0.98] sm:self-auto"
            )}
          >
            <ArrowRight size={16} />
            العودة للكورسات
          </Link>
        </div>
      </header>

      {/* ------------------------------ Content ------------------------------ */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 sm:gap-8">
        <section className="space-y-6 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xl shadow-slate-100 lg:col-span-2 sm:p-8">
          <div className="flex flex-col justify-between gap-4 border-b border-slate-100 pb-5 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-blue-50 p-2.5 text-blue-600">
                <User size={20} />
              </div>
              <div>
                <h2 className="text-base font-black text-slate-900">البيانات الشخصية والمعلومات</h2>
                <p className="text-xs text-slate-500">إدارة معلومات حسابك وتفاصيل الاتصال</p>
              </div>
            </div>
            <button
              type="button"
              onClick={isEditing ? cancelEditing : startEditing}
              disabled={saving || uploading}
              className={cx(
                "flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all disabled:opacity-60",
                isEditing ? "bg-rose-50 text-rose-600 hover:bg-rose-100" : "bg-blue-50 text-blue-700 hover:bg-blue-100"
              )}
            >
              {isEditing ? <X size={15} /> : <Edit3 size={15} />}
              {isEditing ? "إلغاء التعديل" : "تعديل بياناتي"}
            </button>
          </div>

          <form onSubmit={handleSave} className="space-y-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
              <Field label="الاسم الكامل" icon={<User size={13} className="text-slate-400" />}>
                <input
                  type="text"
                  disabled={!isEditing}
                  value={form.name}
                  placeholder="غير محدد"
                  autoComplete="name"
                  onChange={(e) => setField("name", e.target.value)}
                  className={INPUT}
                />
              </Field>

              <Field label="البريد الإلكتروني" icon={<Mail size={13} className="text-slate-400" />}>
                <input
                  type="email"
                  dir="ltr"
                  disabled={!isEditing}
                  value={form.email}
                  placeholder="name@example.com"
                  autoComplete="email"
                  onChange={(e) => setField("email", e.target.value)}
                  className={cx(INPUT, "text-right")}
                />
              </Field>

              <Field label="رقم الهاتف" icon={<Phone size={13} className="text-slate-400" />}>
                <input
                  type="tel"
                  dir="ltr"
                  inputMode="tel"
                  disabled={!isEditing}
                  value={form.phone}
                  placeholder="01xxxxxxxxx"
                  autoComplete="tel"
                  onChange={(e) => setField("phone", e.target.value)}
                  className={cx(INPUT, "text-right")}
                />
              </Field>

              <Field label="الدولة" icon={<Globe size={13} className="text-slate-400" />}>
                <input
                  type="text"
                  disabled={!isEditing}
                  value={form.country}
                  placeholder="غير محدد"
                  onChange={(e) => setField("country", e.target.value)}
                  className={INPUT}
                />
              </Field>

              <Field label="المدينة" icon={<MapPin size={13} className="text-slate-400" />}>
                <input
                  type="text"
                  disabled={!isEditing}
                  value={form.city}
                  placeholder="غير محدد"
                  onChange={(e) => setField("city", e.target.value)}
                  className={INPUT}
                />
              </Field>

              <Field label="نبذة تعريفية" className="sm:col-span-2">
                <textarea
                  rows={4}
                  disabled={!isEditing}
                  value={form.bio}
                  placeholder="اكتب نبذة قصيرة عنك وعن اهتماماتك الدراسية"
                  onChange={(e) => setField("bio", e.target.value)}
                  className={cx(INPUT, "resize-y leading-relaxed disabled:resize-none")}
                />
              </Field>
            </div>

            {isEditing && (
              <div className="flex justify-end border-t border-slate-100 pt-5">
                <button
                  type="submit"
                  disabled={saving || !isDirty}
                  className={cx(
                    FOCUS_RING,
                    "inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-6 py-3 text-sm font-black text-white shadow-lg transition-colors hover:bg-blue-700 disabled:opacity-50"
                  )}
                >
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  حفظ التعديلات
                </button>
              </div>
            )}
          </form>
        </section>

        <aside className="space-y-6">
          <section className="space-y-4 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xl shadow-slate-100 sm:p-8">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <div className="rounded-2xl bg-blue-50 p-2.5 text-blue-600">
                <Shield size={20} />
              </div>
              <div>
                <h2 className="text-base font-black text-slate-900">الأمان والحساب</h2>
                <p className="text-xs text-slate-500">إدارة كلمة المرور</p>
              </div>
            </div>

            <p className="text-xs leading-relaxed text-slate-500">
              كلمة المرور محفوظة ومشفّرة في نظام الحسابات، ولا تظهر لأي شخص بما فيهم إدارة المنصة.
            </p>

            <button
              type="button"
              onClick={() => setPasswordOpen(true)}
              className={cx(
                FOCUS_RING,
                "inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-bold text-white shadow-md transition-colors hover:bg-blue-600"
              )}
            >
              <KeyRound size={15} />
              تغيير كلمة المرور
            </button>
          </section>

          {record?.bio && !isEditing && (
            <section className="space-y-2 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xl shadow-slate-100">
              <h2 className="text-sm font-black text-slate-900">نبذة عنك</h2>
              <p className="text-xs leading-relaxed text-slate-600">{record.bio}</p>
            </section>
          )}
        </aside>
      </div>

      {/* ------------------------------ Sticky edit bar ------------------------------ */}
      {isEditing && (
        <div className="fixed inset-x-4 bottom-4 z-40 flex justify-center">
          <div className="flex w-full max-w-2xl flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-900 px-4 py-3 text-white shadow-2xl">
            <span className="text-sm font-bold">{isDirty ? "لديك تغييرات غير محفوظة." : "وضع التعديل مفعّل."}</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={cancelEditing}
                disabled={saving}
                className="rounded-xl bg-white/10 px-4 py-2 text-sm font-bold transition-colors hover:bg-white/20"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !isDirty}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold transition-colors hover:bg-blue-500 disabled:opacity-50"
              >
                {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                حفظ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------ Toast ------------------------------ */}
      {notice && (
        <div className={cx("pointer-events-none fixed inset-x-4 z-50 flex justify-center", isEditing ? "bottom-24" : "bottom-4 sm:bottom-6")}>
          <div
            key={notice.id}
            role={notice.type === "error" ? "alert" : "status"}
            className={cx(
              "pointer-events-auto flex w-full max-w-lg items-start gap-3 rounded-2xl border px-4 py-3 text-xs font-bold shadow-md",
              notice.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                : "border-rose-200 bg-rose-50 text-rose-900"
            )}
          >
            {notice.type === "success" ? (
              <span className="rounded-xl bg-emerald-500 p-1.5 text-white shadow-xs">
                <Check size={16} />
              </span>
            ) : (
              <span className="rounded-xl bg-rose-500 p-1.5 text-white shadow-xs">
                <AlertTriangle size={16} />
              </span>
            )}
            <span className="flex-1 leading-relaxed">{notice.text}</span>
            <button type="button" onClick={() => setNotice(null)} aria-label="إغلاق الإشعار" className="opacity-60 transition-opacity hover:opacity-100">
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ------------------------------ Password modal ------------------------------ */}
      {passwordOpen && (
        <Modal title="تغيير كلمة المرور" icon={<ShieldCheck size={20} className="text-blue-600" />} onClose={closePasswordModal}>
          {passwordError && (
            <p role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-3.5 text-xs font-bold text-rose-700">
              {passwordError}
            </p>
          )}
          <form onSubmit={handleChangePassword} className="space-y-4">
            <Field label="كلمة المرور الجديدة">
              <input
                type="password"
                required
                autoFocus
                minLength={8}
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className={INPUT}
              />
            </Field>
            <Field label="تأكيد كلمة المرور الجديدة">
              <input
                type="password"
                required
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={INPUT}
              />
            </Field>
            <p className="text-[11px] leading-relaxed text-slate-500">
              8 أحرف على الأقل، وتحتوي على حرف كبير ورقم واحد على الأقل.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={closePasswordModal}
                className="rounded-2xl bg-slate-100 px-5 py-3 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-200"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={changingPassword}
                className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-6 py-3 text-xs font-black text-white shadow-md transition-colors hover:bg-blue-700 disabled:opacity-60"
              >
                {changingPassword && <Loader2 size={15} className="animate-spin" />}
                حفظ
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}