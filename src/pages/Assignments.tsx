import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  UploadCloud,
  CheckCircle2,
  Clock,
  ArrowRight,
  Sparkles,
  BookOpen,
  CheckSquare,
  HelpCircle,
  Timer,
  UserCheck,
  FileUp,
  FileText,
} from "lucide-react";

import { supabase } from "../lib/supabaseClient";

export default function AssignmentsPage() {
  const [selectedAssignmentId, setselectedAssignmentId] = useState<number | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const [attemptsLeft, setAttemptsLeft] = useState(1);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const savedOriginalName = localStorage.getItem("saved_student_name") || "";
  const [inputStudentName, setInputStudentName] = useState(savedOriginalName);
  
  const [studentId, setStudentId] = useState<number | null>(null);
  const [isVerified, setIsVerified] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const [selectedAnswers, setSelectedAnswers] = useState<{ [key: number]: string }>({});
  const [essayAnswers, setEssayAnswers] = useState<{ [key: number]: string }>({});
  
  // حالة خاصة لرفع الملفات (تخزين الملف لكل سؤال أو ملف عام للواجب)
  const [uploadedFiles, setUploadedFiles] = useState<{ [key: number]: { name: string; url: string } }>({});
  const [uploadingFileIndex, setUploadingFileIndex] = useState<number | null>(null);

  const [showResults, setShowResults] = useState(false);
  const [totalScore, setTotalScore] = useState(0);
  const [maxPossibleScore, setMaxPossibleScore] = useState(0);

  const [timeLeft, setTimeLeft] = useState<number>(600);
  const [isTimeOut, setIsTimeOut] = useState(false);

  useEffect(() => {
    fetchQuizzes();
  }, []);

  const fetchQuizzes = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.from("quizzes").select("*");
      if (error) throw error;
      if (data) {
        setAssignments(data);
      }
    } catch (error) {
      console.error("خطأ في جلب الاختبارات والواجبات:", error);
    } finally {
      setLoading(false);
    }
  };

  const activeAssignment = assignments.find((a) => a.id === selectedAssignmentId);

  const getQuizStatus = (assignment: any) => {
    if (!assignment) return { isOpen: true, message: "" };
    const now = new Date();
    
    if (assignment.start_date) {
      const startDate = new Date(assignment.start_date);
      if (now < startDate) {
        return { isOpen: false, message: `لم يبدأ الاختبار بعد. موعد البدء: ${assignment.start_date}` };
      }
    }

    if (assignment.due_date) {
      const dueDate = new Date(assignment.due_date);
      if (now > dueDate) {
        return { isOpen: false, message: `انتهى موعد تسليم الاختبار في: ${assignment.due_date}` };
      }
    }

    return { isOpen: true, message: "" };
  };

  const getDurationInSeconds = (durationValue: any) => {
    if (!durationValue) return 600;
    if (typeof durationValue === "number") {
      return durationValue * 60;
    }
    const match = durationValue.toString().match(/\d+/);
    const parsedNumber = match ? parseInt(match[0], 10) : 10;
    if (durationValue.includes("ثان") || durationValue.toLowerCase().includes("sec")) {
      return parsedNumber;
    }
    return parsedNumber * 60;
  };

  const checkStudentAttempts = async (sId: number, qId: number, maxAllowed: number) => {
    try {
      const { count, error } = await supabase
        .from("student_submissions")
        .select("*", { count: "exact", head: true })
        .eq("student_id", sId)
        .eq("quiz_id", qId);

      if (!error && count !== null) {
        const usedAttempts = count;
        const left = Math.max(0, maxAllowed - usedAttempts);
        setAttemptsLeft(left);
        return left;
      }
    } catch (e) {
      console.error("خطأ في حساب المحاولات:", e);
    }
    setAttemptsLeft(maxAllowed);
    return maxAllowed;
  };

  // دالة رفع الملفات الخارجية بكل الصيغ (صور، مستندات، ملفات نصية) إلى Supabase Storage
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, questionIndex: number) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingFileIndex(questionIndex);
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
      const filePath = `${fileName}`;

      // رفع الملف إلى البوكت المسمى submissions-files
      const { error: uploadError } = await supabase.storage
        .from("submissions-files")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // جلب الرابط العام للملف المرفوع
      const { data: publicUrlData } = supabase.storage
        .from("submissions-files")
        .getPublicUrl(filePath);

      const filePublicUrl = publicUrlData.publicUrl;

      setUploadedFiles((prev) => ({
        ...prev,
        [questionIndex]: { name: file.name, url: filePublicUrl },
      }));

      alert("تم رفع الملف بنجاح! 📎");
    } catch (error: any) {
      console.error("خطأ أثناء رفع الملف:", error);
      alert(`فشل رفع الملف: ${error.message || "تحقق من الاتصال"}`);
    } finally {
      setUploadingFileIndex(null);
    }
  };

  const handleVerifyStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputStudentName.trim() || !activeAssignment) return;

    const trimmedInput = inputStudentName.trim();
    const firstSavedName = localStorage.getItem("saved_student_name");

    if (firstSavedName && firstSavedName.toLowerCase() !== trimmedInput.toLowerCase()) {
      alert(`عذراً، لا يمكنك تغيير الاسم! أنت مسجل مسبقاً على هذا الجهاز باسم (${firstSavedName}).`);
      setInputStudentName(firstSavedName);
      return;
    }

    const statusCheck = getQuizStatus(activeAssignment);
    if (!statusCheck.isOpen) {
      alert(statusCheck.message);
      return;
    }

    try {
      setVerifying(true);

      if (!firstSavedName) {
        localStorage.setItem("saved_student_name", trimmedInput);
      }

      let { data: studentData, error: fetchError } = await supabase
        .from("students")
        .select("id, name")
        .ilike("name", trimmedInput)
        .maybeSingle();

      if (fetchError) throw fetchError;

      let currentStudentId = studentData?.id;

      if (!currentStudentId) {
        const { data: newStudent, error: insertError } = await supabase
          .from("students")
          .insert([{ name: trimmedInput }])
          .select("id, name")
          .single();

        if (insertError) throw insertError;
        currentStudentId = newStudent.id;
      }

      setStudentId(currentStudentId);

      const { data: latestQuizData } = await supabase
        .from("quizzes")
        .select("allowed_attempts")
        .eq("id", activeAssignment.id)
        .single();

      const maxAllowed = Number(latestQuizData?.allowed_attempts) || Number(activeAssignment?.allowed_attempts) || 1;
      
      const leftAttempts = await checkStudentAttempts(currentStudentId, activeAssignment.id, maxAllowed);

      if (leftAttempts <= 0) {
        alert(`عذراً يا ${trimmedInput}، لقد استنفدت كافة محاولاتك المسموحة لهذا الاختبار.`);
        setVerifying(false);
        return;
      }

      setIsVerified(true);

      const now = new Date();
      const formattedTime = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}/${String(now.getDate()).padStart(2, "0")} - ${now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`;

      await supabase.from("course_attendance").upsert([
        {
          student_id: currentStudentId,
          student_name: trimmedInput,
          course_name: activeAssignment?.course_name,
          specialty: activeAssignment?.course_specialty || "عام",
          course_specialty: activeAssignment?.course_specialty || "عام",
          attendance_status: "حاضر",
          attendance_time: formattedTime,
        }
      ], { onConflict: 'student_id, course_name' });

    } catch (err: any) {
      console.error("خطأ أثناء التحقق:", err);
      alert(`حدث خطأ: ${err?.message || "يرجى التحقق من الاتصال."}`);
    } finally {
      setVerifying(false);
    }
  };

  useEffect(() => {
    let timer: any;
    if (selectedAssignmentId && isVerified && !isSubmitted && !isTimeOut && activeAssignment) {
      timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            setIsTimeOut(true);
            alert("انتهى وقت الاختبار المحدد! سيتم تسليم إجاباتك تلقائياً وعرض النتيجة.");
            handleSubmitFinalAssignmentAutomatically();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [selectedAssignmentId, isVerified, isSubmitted, isTimeOut, activeAssignment]);

  const calculateFinalScore = () => {
    if (!activeAssignment || !activeAssignment.questions_list) return { score: 0, maxScore: 0 };

    let score = 0;
    let maxScore = 0;

    activeAssignment.questions_list.forEach((q: any, idx: number) => {
      const qWeight = Number(q.grade || q.points || q.score || 10);
      maxScore += qWeight;

      const studentAns = selectedAnswers[idx];
      const correctOptIndex = q.correctAnswers?.[0];
      const correctOptText = q.options?.[correctOptIndex] || q.correctAnswer;

      if (studentAns && correctOptText && studentAns.trim() === correctOptText.trim()) {
        score += qWeight;
      }
    });

    return { score, maxScore };
  };

  const saveSubmissionToSupabase = async (score: number, maxScore: number) => {
    try {
      const now = new Date();
      const formattedTime = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}/${String(now.getDate()).padStart(2, "0")} - ${now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`;

      const { error: subError } = await supabase.from("student_submissions").insert([
        {
          student_id: studentId,
          quiz_id: activeAssignment?.id,
          student_name: inputStudentName.trim(),
          submission_time: formattedTime,
          score: score,
          max_score: maxScore,
          specialty: activeAssignment?.course_specialty || "عام",
          course_name: activeAssignment?.course_name || "اختبار منصة",
          status: score >= maxScore * 0.5 ? "ناجح" : "راسب",
          student_answers: {
            mcq_answers: selectedAnswers,
            essay_answers: essayAnswers,
            uploaded_files: uploadedFiles, // حفظ روابط الملفات المرفوعة في قاعدة البيانات
          },
        },
      ]);

      if (subError) throw subError;

      if (studentId && activeAssignment) {
        const maxAllowed = Number(activeAssignment?.allowed_attempts) || 1;
        await checkStudentAttempts(studentId, activeAssignment.id, maxAllowed);
      }
    } catch (err) {
      console.error("خطأ عند حفظ التسليم:", err);
    }
  };

  const handleSubmitFinalAssignmentAutomatically = () => {
    const { score, maxScore } = calculateFinalScore();
    setTotalScore(score);
    setMaxPossibleScore(maxScore);
    setShowResults(true);
    setIsSubmitted(true);
    saveSubmissionToSupabase(score, maxScore);
  };

  const handleSubmitFinalAssignment = (e: React.FormEvent) => {
    e.preventDefault();
    const { score, maxScore } = calculateFinalScore();
    setTotalScore(score);
    setMaxPossibleScore(maxScore);
    setShowResults(true);
    setIsSubmitted(true);
    saveSubmissionToSupabase(score, maxScore);
  };

  const handleResetSubmission = async () => {
    if (studentId && activeAssignment) {
      const maxAllowed = Number(activeAssignment?.allowed_attempts) || 1;
      const left = await checkStudentAttempts(studentId, activeAssignment.id, maxAllowed);
      if (left <= 0) {
        alert("لقد استنفدت كافة محاولاتك المسموحة لهذا الاختبار.");
        return;
      }
    }

    setIsSubmitted(false);
    setShowResults(false);
    setSelectedAnswers({});
    setEssayAnswers({});
    setUploadedFiles({});
    if (activeAssignment) {
      setTimeLeft(getDurationInSeconds(activeAssignment.quiz_duration));
    }
    setIsTimeOut(false);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh] text-blue-600 font-bold text-sm">
        جاري تحميل الواجبات والاختبارات من قاعدة البيانات... 🔄
      </div>
    );
  }

  return (
    <div className="space-y-6 text-slate-800 min-h-screen" dir="rtl">
      <div className="relative overflow-hidden bg-gradient-to-r from-blue-700 via-indigo-600 to-blue-800 rounded-2xl sm:rounded-3xl p-5 sm:p-8 shadow-xl text-white border border-blue-500/20">
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-2">
            <span className="px-3 py-1 bg-white/25 backdrop-blur-md text-white text-[11px] font-extrabold rounded-full inline-flex items-center gap-1.5 border border-white/20">
              <Sparkles size={12} />
               الاختبارات الذكية ودعم الملفات  - منصة Z E D
            </span>
            <h1 className="text-xl sm:text-3xl font-black tracking-wide leading-tight">
              قائمة الواجبات والاختبارات الحية
            </h1>
          </div>
          <Link
            to="/courses"
            className="px-4 py-2.5 bg-white text-blue-700 hover:bg-blue-50 rounded-xl text-xs font-black shadow-md transition-all flex items-center justify-center gap-2 self-start sm:self-auto"
          >
            <ArrowRight size={15} />
            <span>العودة للكورسات</span>
          </Link>
        </div>
      </div>

      {!selectedAssignmentId ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-base sm:text-lg font-black text-slate-800 flex items-center gap-2">
              <CheckSquare size={18} className="text-blue-600" /> 
              الواجبات والاختبارات المتاحة ({assignments.length})
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {assignments.map((assignment) => {
              const maxAllowedAttempts = Number(assignment.allowed_attempts) || 1;
              const status = getQuizStatus(assignment);

              return (
                <div
                  key={assignment.id}
                  className="bg-white border-2 rounded-2xl sm:rounded-3xl p-5 sm:p-6 shadow-sm transition-all duration-300 flex flex-col justify-between space-y-5 border-blue-100 hover:border-blue-300 hover:shadow-md"
                >
                  <div className="space-y-3.5">
                    <h3 className="text-sm sm:text-base font-black text-slate-800 leading-snug">
                      {assignment.course_name}
                    </h3>

                    <div className="flex items-center gap-1 text-xs text-blue-600 font-bold">
                      <BookOpen size={14} className="shrink-0" /> 
                      <span className="truncate">الكورس: {assignment.course_name}</span>
                    </div>

                    <div>
                      <span className="px-2.5 py-1 bg-blue-50 text-blue-700 text-[10px] font-extrabold rounded-lg border border-blue-200 inline-block">
                        التخصص: {assignment.course_specialty}
                      </span>
                    </div>

                    <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/70 space-y-2.5 text-xs">
                      <div className="flex items-center justify-between gap-2 border-b border-slate-200/50 pb-2">
                        <span className="text-slate-500 font-medium flex items-center gap-1.5 shrink-0">
                          <Clock size={13} className="text-amber-600" /> 
                          موعد البدء:
                        </span>
                        <span className="text-slate-800 font-bold text-left truncate">
                          {assignment.start_date || "فوري"}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-2 border-b border-slate-200/50 pb-2">
                        <span className="text-slate-500 font-medium flex items-center gap-1.5 shrink-0">
                          <Clock size={13} className="text-rose-600" /> 
                          آخر موعد للتسليم:
                        </span>
                        <span className="text-slate-800 font-bold text-left truncate">
                          {assignment.due_date || "غير محدد"}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-2 border-b border-slate-200/50 pb-2">
                        <span className="text-slate-500 font-medium flex items-center gap-1.5 shrink-0">
                          <CheckSquare size={13} className="text-blue-600" /> 
                          المحاولات المسموحة:
                        </span>
                        <span className="text-blue-600 font-bold text-left">
                          {maxAllowedAttempts} محاولات
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <span className="text-slate-500 font-medium flex items-center gap-1.5 shrink-0">
                          <Timer size={13} className="text-indigo-600" /> 
                          الوقت المخصص:
                        </span>
                        <span className="text-indigo-700 font-bold text-left">
                          {assignment.quiz_duration || "10 دقائق"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2">
                    {status.isOpen ? (
                      <button
                        onClick={async () => {
                          setselectedAssignmentId(assignment.id);
                          setIsVerified(false);
                          setIsSubmitted(false);
                          setShowResults(false);
                          setSelectedAnswers({});
                          setEssayAnswers({});
                          setUploadedFiles({});
                          setAttemptsLeft(maxAllowedAttempts);
                          setTimeLeft(getDurationInSeconds(assignment.quiz_duration));
                          setIsTimeOut(false);
                        }}
                        className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all flex items-center justify-center gap-2 text-xs font-bold shadow-xs active:scale-[0.99]"
                      >
                        <span>الدخول للاختبار الآن</span>
                        <ArrowRight size={14} />
                      </button>
                    ) : (
                      <div className="w-full py-2.5 px-4 bg-slate-200 text-slate-500 rounded-xl text-center text-xs font-bold cursor-not-allowed">
                        {status.message.includes("لم يبدأ") ? "الاختبار لم يبدأ بعد ⏳" : "انتهى وقت الاختبار 🔒"}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : !isVerified ? (
        <div className="max-w-xl mx-auto bg-white border-2 border-blue-100 rounded-2xl sm:rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
          <div className="space-y-2 text-center">
            <button
              onClick={() => setselectedAssignmentId(null)}
              className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors mx-auto mb-2"
            >
              <ArrowRight size={14} /> العودة لقائمة الواجبات
            </button>
            <h2 className="text-lg sm:text-xl font-black text-slate-800">
              {activeAssignment?.course_name}
            </h2>
            <p className="text-xs text-slate-500">
              الرجاء إدخال اسمك للبدء في الاختبار. (ملاحظة: لا يمكن تغيير الاسم بعد تسجيله أول مرة على هذا الجهاز).
            </p>
          </div>

          <form onSubmit={handleVerifyStudent} className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                <UserCheck size={16} className="text-blue-600" />
                <span>اسم الطالب الكامل:</span>
              </label>
              <input
                type="text"
                required
                value={inputStudentName}
                onChange={(e) => setInputStudentName(e.target.value)}
                placeholder="مثال: محمد أحمد علي"
                className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-blue-500"
              />
            </div>

            <button
              type="submit"
              disabled={verifying}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black shadow-md transition-all flex items-center justify-center gap-2"
            >
              {verifying ? "جاري التحقق..." : "بدء الاختبار الآن"}
              <ArrowRight size={15} />
            </button>
          </form>
        </div>
      ) : (
        <div className="space-y-6 bg-white border-2 border-blue-100 rounded-2xl sm:rounded-3xl p-4 sm:p-8 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div className="space-y-1">
              <button
                onClick={() => setselectedAssignmentId(null)}
                className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors mb-1"
              >
                <ArrowRight size={14} /> العودة لقائمة الواجبات
              </button>
              <h2 className="text-base sm:text-xl font-black text-slate-800 leading-snug">
                {activeAssignment?.course_name}
              </h2>
              <p className="text-xs font-semibold text-slate-500">
                الطالب: <strong className="text-blue-700">{inputStudentName}</strong> | المحاولات المتبقية:{" "}
                <strong className={attemptsLeft > 0 ? "text-blue-600" : "text-red-600"}>{attemptsLeft} محاولات</strong>
              </p>
            </div>

            <div
              className={`px-3.5 py-2 rounded-xl border flex items-center gap-2 shadow-xs self-start sm:self-auto ${timeLeft < 120 ? "bg-red-50 border-red-300 text-red-600 animate-pulse" : "bg-blue-50/50 border-blue-200 text-blue-700"}`}
            >
              <Timer size={18} />
              <div className="text-xs font-black">
                <span>الوقت المتبقي: </span>
                <span className="font-mono text-sm">{formatTime(timeLeft)}</span>
              </div>
            </div>
          </div>

          {attemptsLeft <= 0 && !isSubmitted ? (
            <div className="p-6 bg-rose-50 border border-rose-300 rounded-2xl text-center space-y-3">
              <h3 className="text-base font-black text-rose-800">🚫 تم استنفاد المحاولات المسموحة</h3>
              <p className="text-xs text-rose-600">لقد استهلكت كافة محاولاتك لهذا الاختبار. تم قفل الاختبار نهائياً.</p>
              <button
                type="button"
                onClick={() => setselectedAssignmentId(null)}
                className="px-5 py-2 bg-slate-800 text-white rounded-xl text-xs font-bold"
              >
                العودة لقائمة الواجبات
              </button>
            </div>
          ) : (
            <>
              <div className="bg-slate-50/60 border border-slate-200 rounded-2xl p-4 sm:p-6 space-y-5">
                <h3 className="text-xs sm:text-sm font-black text-slate-800 flex items-center gap-2">
                  <HelpCircle size={16} className="text-indigo-600" />
                  أسئلة الاختبار المتاحة مع إمكانية إرفاق الملفات:
                </h3>

                {activeAssignment?.questions_list && activeAssignment.questions_list.length > 0 ? (
                  <div className="space-y-4">
                    {activeAssignment.questions_list.map((q: any, idx: number) => {
                      const questionText = typeof q === "string" ? q : q.questionText || q.text;
                      const options = q.options || [];
                      const isMCQ = options.length > 0;

                      return (
                        <div
                          key={idx}
                          className="p-4 bg-white rounded-2xl border border-slate-200/80 space-y-3 shadow-xs"
                        >
                          <p className="text-xs sm:text-sm font-black text-slate-800 leading-relaxed">
                            السؤال {idx + 1}: {questionText}
                          </p>

                          {isMCQ ? (
                            <div className="grid grid-cols-1 gap-2">
                              {options.map((opt: string, optIdx: number) => {
                                const isSelected = selectedAnswers[idx] === opt;
                                const isCorrect =
                                  showResults &&
                                  (q.correctAnswers?.includes(optIdx) ||
                                   opt.trim() === q.correctAnswer?.trim());
                                const isWrongSelection =
                                  showResults &&
                                  isSelected &&
                                  !isCorrect;

                                let btnStyle =
                                  "bg-slate-50 border-slate-200 text-slate-700 hover:bg-blue-50/50";
                                if (showResults) {
                                  if (isCorrect)
                                    btnStyle =
                                      "bg-emerald-50 border-emerald-400 text-emerald-900 font-bold";
                                  else if (isWrongSelection)
                                    btnStyle =
                                      "bg-rose-50 border-rose-400 text-rose-900 font-bold";
                                } else if (isSelected) {
                                  btnStyle =
                                    "bg-blue-600 text-white border-blue-600 font-bold";
                                }

                                return (
                                  <button
                                    key={optIdx}
                                    type="button"
                                    disabled={isSubmitted || isTimeOut}
                                    onClick={() =>
                                      setSelectedAnswers({
                                        ...selectedAnswers,
                                        [idx]: opt,
                                      })
                                    }
                                    className={`p-3 rounded-xl border text-xs text-right transition-all leading-normal ${btnStyle}`}
                                  >
                                    {opt}
                                  </button>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="space-y-3">
                              <textarea
                                rows={3}
                                disabled={isSubmitted || isTimeOut}
                                value={essayAnswers[idx] || ""}
                                onChange={(e) =>
                                  setEssayAnswers({
                                    ...essayAnswers,
                                    [idx]: e.target.value,
                                  })
                                }
                                placeholder="اكتب إجابتك المقالية هنا..."
                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-blue-500"
                              />

                              {/* زر رفع الملفات الخارجية (صور، PDF، مستندات) للإجابة */}
                              <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
                                <label className={`w-full sm:w-auto px-4 py-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 cursor-pointer flex items-center justify-center gap-2 transition-all ${isSubmitted || isTimeOut ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                  <FileUp size={15} className="text-blue-600" />
                                  <span>{uploadingFileIndex === idx ? "جاري رفع الملف..." : "إرفاق ملف خارجي (صورة، PDF، مستند)"}</span>
                                  <input
                                    type="file"
                                    disabled={isSubmitted || isTimeOut || uploadingFileIndex === idx}
                                    onChange={(e) => handleFileUpload(e, idx)}
                                    className="hidden"
                                  />
                                </label>

                                {uploadedFiles[idx] && (
                                  <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
                                    <FileText size={14} />
                                    <a href={uploadedFiles[idx].url} target="_blank" rel="noopener noreferrer" className="underline font-bold truncate max-w-[200px]">
                                      {uploadedFiles[idx].name}
                                    </a>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">لا توجد أسئلة مضافة حالياً.</p>
                )}
              </div>

              {isSubmitted ? (
                <div className="p-5 sm:p-6 rounded-2xl border-2 border-emerald-300 bg-emerald-50/70 text-emerald-900 text-center space-y-4 shadow-sm">
                  <CheckCircle2 size={40} className="mx-auto text-emerald-600" />
                  <div className="space-y-2">
                    <h3 className="text-base sm:text-lg font-black">
                      {isTimeOut
                        ? "⏰ انتهى الوقت! تم تسليم الاختبار وإغلاقه تلقائياً."
                        : showResults
                          ? "🎉 تم إنهاء المحاولة وعرض الدرجة النهائية!"
                          : "✅ تم استلام محاولتك بنجاح!"}
                    </h3>

                    {showResults && (
                      <div className="p-3.5 bg-white border border-emerald-200 rounded-xl max-w-sm mx-auto space-y-1 shadow-xs">
                        <p className="text-xs font-bold text-slate-700">
                          درجتك النهائية:{" "}
                          <span className="text-emerald-600 font-black text-sm">
                            {totalScore}
                          </span>{" "}
                          من{" "}
                          <span className="text-blue-600 font-black text-sm">
                            {maxPossibleScore}
                          </span>
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
                    {attemptsLeft > 0 && !isTimeOut ? (
                      <button
                        type="button"
                        onClick={handleResetSubmission}
                        className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold inline-flex items-center justify-center gap-2 shadow-xs transition-all"
                      >
                        <UploadCloud size="14" />
                        <span>إعادة محاولة جديدة (متبقي {attemptsLeft})</span>
                      </button>
                    ) : null}

                    <button
                      type="button"
                      onClick={() => setselectedAssignmentId(null)}
                      className="w-full sm:w-auto px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold inline-flex items-center justify-center gap-2 shadow-xs transition-all"
                    >
                      <ArrowRight size={14} />
                      <span>العودة لقائمة الواجبات</span>
                    </button>
                  </div>
                </div>
              ) : (
                <form
                  onSubmit={handleSubmitFinalAssignment}
                  className="bg-slate-50/60 border border-slate-200 rounded-2xl p-4 sm:p-6 space-y-5 text-right"
                >
                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      className="px-8 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black shadow-md transition-all"
                    >
                      تسليم الاختبار وإنهاء المحاولة
                    </button>
                  </div>
                </form>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}