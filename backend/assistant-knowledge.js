const GUIDANCE_TOPICS = {
  create_case: {
    title: "Create a fraud case",
    titleAr: "إنشاء بلاغ احتيال",
    keywords: ["create case", "create request", "new case", "new request", "submit case", "how do i create", "إنشاء بلاغ", "إنشاء حالة", "بلاغ جديد", "طلب جديد", "كيف أنشئ", "كيف ارفع بلاغ"],
    en: [
      "Open Fraud Queue and select New Case.",
      "Complete Reporter Details and Case Overview.",
      "Choose Open, Suspended, or Closed as the case status. Use Save Draft when the case is not ready for submission.",
      "If There is a related claim is selected, enter the Claim Number and Claim Type.",
      "Complete Fraud Indicators when they apply, then attach supporting evidence.",
      "Select Create Case to save the submitted case. The action is recorded in the case Action Log and system Audit Log.",
    ],
    ar: [
      "افتح قائمة بلاغات الاحتيال ثم اختر بلاغ جديد.",
      "أكمل بيانات المبلّغ ونظرة عامة على البلاغ.",
      "اختر حالة البلاغ: مفتوح أو معلّق أو مغلق. استخدم حفظ كمسودة إذا لم يكن البلاغ جاهزًا للإرسال.",
      "عند اختيار وجود مطالبة مرتبطة، أدخل رقم المطالبة ونوع المطالبة.",
      "أكمل مؤشرات الاحتيال عند الحاجة ثم أرفق المستندات الداعمة.",
      "اختر إنشاء البلاغ لحفظه. يتم تسجيل العملية في سجل إجراءات البلاغ وسجل التدقيق العام.",
    ],
  },
  statuses: {
    title: "Case statuses",
    titleAr: "حالات البلاغ",
    keywords: ["status meaning", "case status", "open suspended closed", "draft", "what is suspended", "حالة البلاغ", "الحالات", "مفتوح", "معلق", "مغلق", "مسودة"],
    en: [
      "Draft: a temporary private case visible only to its creator. Draft is created only through Save Draft and cannot be selected manually.",
      "Open: an active submitted case under normal processing.",
      "Suspended: processing is temporarily paused. Suspension Date and Suspension Reason are required; duration is calculated automatically.",
      "Closed: processing is complete. A Closure Reason is required and the closure date is recorded automatically.",
      "Every status change is written to the case Action Log and system Audit Log.",
    ],
    ar: [
      "مسودة: بلاغ مؤقت يظهر فقط لمن أنشأه. يتم إنشاؤه من خلال حفظ كمسودة ولا يمكن اختياره يدويًا.",
      "مفتوح: بلاغ مرسل ونشط وجارٍ التعامل معه.",
      "معلّق: تمت إيقاف المعالجة مؤقتًا. يجب إدخال تاريخ التعليق وسببه، ويتم احتساب المدة تلقائيًا.",
      "مغلق: اكتملت معالجة البلاغ. يجب إدخال سبب الإغلاق ويتم تسجيل تاريخ الإغلاق تلقائيًا.",
      "يتم تسجيل كل تغيير للحالة في سجل إجراءات البلاغ وسجل التدقيق العام.",
    ],
  },
  documents: {
    title: "Upload supporting documents",
    titleAr: "رفع المستندات الداعمة",
    keywords: ["upload", "attachment", "document", "evidence", "file", "مرفق", "مستند", "رفع ملف", "وثيقة", "دليل"],
    en: [
      "Open the case and go to Attachments.",
      "Select a supported file and an optional category, then upload it.",
      "The maximum file size is 15 MB. Supported types include PDF, PNG, JPG, DOCX, XLSX, and TXT.",
      "Upload and download activity is recorded in the Audit Log.",
    ],
    ar: [
      "افتح البلاغ وانتقل إلى المرفقات.",
      "اختر ملفًا مدعومًا وحدد التصنيف عند الحاجة ثم ارفع الملف.",
      "الحد الأقصى لحجم الملف هو 15 ميجابايت. الأنواع المدعومة تشمل PDF وPNG وJPG وDOCX وXLSX وTXT.",
      "يتم تسجيل عمليات رفع وتنزيل الملفات في سجل التدقيق.",
    ],
  },
  reports: {
    title: "Reports",
    titleAr: "التقارير",
    keywords: ["report", "export", "excel", "suspended fraud report", "تقرير", "تصدير", "إكسل", "البلاغات المعلقة"],
    en: [
      "Open Reports and select the required report.",
      "Draft cases are intentionally excluded from submitted-case reports.",
      "Suspended Fraud Report includes every case whose current status is Suspended.",
      "Use the report filters before exporting so the exported data matches the displayed result set.",
    ],
    ar: [
      "افتح التقارير ثم اختر التقرير المطلوب.",
      "يتم استبعاد المسودات عمدًا من تقارير البلاغات المرسلة.",
      "يتضمن تقرير بلاغات الاحتيال المعلقة كل بلاغ حالته الحالية معلّق.",
      "استخدم عوامل التصفية قبل التصدير حتى تتطابق البيانات المصدرة مع النتائج المعروضة.",
    ],
  },
  assignment: {
    title: "Assign a case",
    titleAr: "إسناد البلاغ",
    keywords: ["assign", "reassign", "release assignment", "assigned user", "اسناد", "إسناد", "إعادة إسناد", "المستخدم المسؤول"],
    en: [
      "Open the case and use the assignment controls available to users with the Assign Cases permission.",
      "Select the responsible user and provide a reason when required.",
      "Assignment does not automatically change the case status.",
      "Assignment changes are recorded in history and the Audit Log.",
    ],
    ar: [
      "افتح البلاغ واستخدم أدوات الإسناد المتاحة للمستخدمين الذين لديهم صلاحية إسناد البلاغات.",
      "اختر المستخدم المسؤول وأدخل السبب عند الحاجة.",
      "الإسناد لا يغير حالة البلاغ تلقائيًا.",
      "يتم تسجيل تغييرات الإسناد في السجل وسجل التدقيق.",
    ],
  },
  users_roles: {
    title: "Users, roles, and permissions",
    titleAr: "المستخدمون والأدوار والصلاحيات",
    keywords: ["user", "role", "permission", "access", "reset password", "مستخدم", "دور", "صلاحية", "وصول", "إعادة تعيين كلمة المرور"],
    en: [
      "System Administrators manage users, roles, and permission overrides.",
      "A role provides default permissions. A user-level Allow or Deny override applies only to that user.",
      "For a forgotten local password, an administrator opens User Management, selects the user, and resets or generates a temporary password.",
      "The user is required to change the temporary password at the next login. Microsoft AD passwords remain managed by Microsoft.",
    ],
    ar: [
      "يتولى مسؤول النظام إدارة المستخدمين والأدوار واستثناءات الصلاحيات.",
      "يوفر الدور الصلاحيات الافتراضية، بينما ينطبق استثناء السماح أو المنع على مستخدم واحد فقط.",
      "عند نسيان كلمة مرور مستخدم محلي، يفتح المسؤول إدارة المستخدمين ويختار المستخدم ثم يعيد تعيين كلمة مرور مؤقتة أو ينشئها.",
      "يُطلب من المستخدم تغيير كلمة المرور المؤقتة عند تسجيل الدخول التالي. تظل كلمات مرور Microsoft AD مُدارة من خلال Microsoft.",
    ],
  },
  queue_filters: {
    title: "Fraud Queue filters",
    titleAr: "عوامل تصفية قائمة بلاغات الاحتيال",
    keywords: ["queue filter", "date range", "from date", "to date", "search case", "تصفية القائمة", "نطاق التاريخ", "من تاريخ", "إلى تاريخ", "البحث عن بلاغ"],
    en: [
      "Open Fraud Queue and use the available filters.",
      "From Date and To Date filter cases using Case Entry Date.",
      "You can also filter by source, type, priority, insurance type, and assigned user.",
      "Draft cases remain private to their creator.",
    ],
    ar: [
      "افتح قائمة بلاغات الاحتيال واستخدم عوامل التصفية المتاحة.",
      "يقوم حقلا من تاريخ وإلى تاريخ بتصفية البلاغات باستخدام تاريخ إدخال البلاغ.",
      "يمكن أيضًا التصفية حسب المصدر والنوع والأولوية ونوع التأمين والمستخدم المسؤول.",
      "تظل المسودات خاصة بمنشئها.",
    ],
  },
};

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function detectLanguage(message, requestedLanguage) {
  if (requestedLanguage === "ar" || requestedLanguage === "en") return requestedLanguage;
  return /[\u0600-\u06FF]/.test(String(message || "")) ? "ar" : "en";
}

function findGuidanceTopic(message) {
  const normalized = normalize(message);
  let best = null;
  let bestScore = 0;

  for (const [key, topic] of Object.entries(GUIDANCE_TOPICS)) {
    let score = 0;
    for (const keyword of topic.keywords) {
      if (normalized.includes(normalize(keyword))) score += Math.max(1, keyword.split(/\s+/).length);
    }
    if (score > bestScore) {
      best = { key, ...topic };
      bestScore = score;
    }
  }

  return bestScore > 0 ? best : null;
}

function formatGuidance(topic, language = "en") {
  const selectedLanguage = language === "ar" ? "ar" : "en";
  const title = selectedLanguage === "ar" ? `إرشادات: ${topic.titleAr || topic.title}` : topic.title;
  return `${title}\n\n${topic[selectedLanguage].map((item, index) => `${index + 1}. ${item}`).join("\n")}`;
}

function getGeneralHelp(language = "en") {
  if (language === "ar") {
    return [
      "يمكنني مساعدتك في استخدام نظام إدارة الاحتيال والبحث في البيانات المسموح لك برؤيتها.",
      "جرّب سؤالًا مثل:",
      "• كيف أنشئ بلاغ احتيال؟",
      "• ما الفرق بين مفتوح ومعلّق ومغلق؟",
      "• ما حالة البلاغ FC-20260623-4625؟",
      "• لخّص البلاغ FC-20260623-4625.",
      "• كم عدد البلاغات المفتوحة والمعلقة والمغلقة؟",
      "• اعرض البلاغات المسندة لي.",
      "المساعد للقراءة والإرشاد فقط ولا يقوم بإنشاء البلاغات أو تعديلها أو إغلاقها.",
    ].join("\n");
  }

  return [
    "I can help you use the Fraud Management System and retrieve data you are permitted to view.",
    "Try asking:",
    "• How do I create a fraud case?",
    "• What is the difference between Open, Suspended, and Closed?",
    "• What is the status of case FC-20260623-4625?",
    "• Summarize case FC-20260623-4625.",
    "• How many cases are open, suspended, and closed?",
    "• Show the cases assigned to me.",
    "The assistant is read-only: it cannot create, edit, suspend, or close a case.",
  ].join("\n");
}

module.exports = {
  GUIDANCE_TOPICS,
  detectLanguage,
  findGuidanceTopic,
  formatGuidance,
  getGeneralHelp,
};
