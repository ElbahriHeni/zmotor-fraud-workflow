import { useEffect, useMemo, useState } from 'react';
import { useOutletContext, useParams } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import { apiGet, apiPost, apiPostDownload, apiPut } from '../../api';
import type { AppOutletContext } from '../../layout/AppLayout';
import { hasPermission } from '../../security';
import {
  getFraudAssessmentDefinition,
  type AssessmentQuestion,
} from '../../data/fraudAssessments';

type AnswerValue = string | string[];

type AnswerState = {
  answer: AnswerValue;
  comments: string;
  other_text: string;
};

type AssessmentApiAnswer = {
  question_code: string;
  answer: AnswerValue;
  comments?: string;
  other_text?: string;
};

type AssessmentResponse = {
  assessment_code: string;
  assessment_name: string;
  status: string;
  created_by?: string | null;
  updated_by?: string | null;
  submitted_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  submitted_at?: string | null;
  answers: AssessmentApiAnswer[];
};

const OTHER_OPTION = 'Other, please specify';

function blankAnswer(question: AssessmentQuestion): AnswerState {
  return {
    answer: question.type === 'multi' ? [] : '',
    comments: '',
    other_text: '',
  };
}

function buildInitialAnswers(questions: AssessmentQuestion[]) {
  return Object.fromEntries(
    questions.map((question) => [question.code, blankAnswer(question)])
  ) as Record<string, AnswerState>;
}

function hasAnswer(question: AssessmentQuestion, state: AnswerState | undefined) {
  if (!state) return false;
  if (question.type === 'multi') return Array.isArray(state.answer) && state.answer.length > 0;
  return typeof state.answer === 'string' && state.answer.trim().length > 0;
}

function exportFileName(code: string, title: string) {
  const safeTitle = title
    .replace(/^\d{2}\.\s*/, '')
    .replace(/&/g, 'and')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return `Fraud_Assessment_${code}_${safeTitle}.xlsx`;
}

export default function FraudAssessmentPage() {
  const { assessmentCode } = useParams();
  const definition = getFraudAssessmentDefinition(assessmentCode);
  const { language, currentUser } = useOutletContext<AppOutletContext>();
  const isArabic = language === 'ar';
  const [activeSection, setActiveSection] = useState('');
  const [answers, setAnswers] = useState<Record<string, AnswerState>>({});
  const [assessment, setAssessment] = useState<AssessmentResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingAll, setIsExportingAll] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const canEdit = hasPermission(currentUser, 'fraud_assessment.edit');
  const canSubmit = hasPermission(currentUser, 'fraud_assessment.submit');

  const copy = useMemo(() => (isArabic ? {
    eyebrow: 'تقييم الاحتيال',
    subtitle: 'استكمال أسئلة التقييم وحفظها أو إرسالها عند الانتهاء.',
    answer: 'الإجابة',
    comments: 'الملاحظات',
    other: 'يرجى التحديد',
    exportExcel: 'تصدير هذا القسم',
    exportAllExcel: 'تصدير جميع أقسام التقييم',
    exporting: 'جارٍ التصدير...',
    exportingAll: 'جارٍ تصدير جميع الأقسام...',
    exported: 'تم تصدير ملف Excel بنفس تنسيق التقييم.',
    exportedAll: 'تم تصدير جميع أقسام تقييم الاحتيال في ملف Excel واحد.',
    selectOne: 'اختر إجابة واحدة',
    selectAll: 'اختر كل ما ينطبق',
    saveDraft: 'حفظ المسودة',
    submit: 'إرسال التقييم',
    saving: 'جارٍ الحفظ...',
    saved: 'تم حفظ مسودة التقييم بنجاح.',
    submitted: 'تم إرسال التقييم بنجاح.',
    status: 'الحالة',
    progress: 'نسبة الإنجاز',
    answered: 'تمت الإجابة',
    lastUpdated: 'آخر تحديث',
    noEdit: 'لديك صلاحية عرض هذا التقييم فقط.',
    loading: 'جارٍ تحميل التقييم...',
    missing: 'لم يتم العثور على قسم التقييم المطلوب.',
  } : {
    eyebrow: 'Fraud Assessment',
    subtitle: 'Complete the assessment questions, save a draft, or submit when finished.',
    answer: 'Answer',
    comments: 'Comments',
    other: 'Other, please specify',
    exportExcel: 'Export This Assessment',
    exportAllExcel: 'Export All Assessments',
    exporting: 'Exporting...',
    exportingAll: 'Exporting all assessments...',
    exported: 'Excel exported in the original assessment format.',
    exportedAll: 'All fraud assessment sections were exported in one Excel workbook.',
    selectOne: 'Select only one answer',
    selectAll: 'Select all that apply',
    saveDraft: 'Save Draft',
    submit: 'Submit Assessment',
    saving: 'Saving...',
    saved: 'Assessment draft saved successfully.',
    submitted: 'Assessment submitted successfully.',
    status: 'Status',
    progress: 'Progress',
    answered: 'answered',
    lastUpdated: 'Last updated',
    noEdit: 'You have view-only access to this assessment.',
    loading: 'Loading assessment...',
    missing: 'The requested fraud assessment section was not found.',
  }), [isArabic]);

  useEffect(() => {
    if (!definition) {
      setIsLoading(false);
      setError(copy.missing);
      return;
    }

    const initial = buildInitialAnswers(definition.questions);
    setAnswers(initial);
    setAssessment(null);
    setActiveSection(definition.sections[0] || '');
    setMessage('');
    setError('');
    setIsLoading(true);

    let mounted = true;

    apiGet<AssessmentResponse>(`/api/fraud-assessments/${definition.code}`)
      .then((row) => {
        if (!mounted) return;
        const next = buildInitialAnswers(definition.questions);
        for (const saved of row.answers || []) {
          const question = definition.questions.find((item) => item.code === saved.question_code);
          if (!question) continue;
          next[saved.question_code] = {
            answer: question.type === 'multi'
              ? (Array.isArray(saved.answer) ? saved.answer : [])
              : (typeof saved.answer === 'string' ? saved.answer : ''),
            comments: saved.comments || '',
            other_text: saved.other_text || '',
          };
        }
        setAnswers(next);
        setAssessment(row);
      })
      .catch((loadError) => {
        if (mounted) setError(loadError instanceof Error ? loadError.message : 'Failed to load fraud assessment.');
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });

    return () => { mounted = false; };
  }, [definition, copy.missing]);

  const sectionQuestions = useMemo(
    () => definition?.questions.filter((question) => question.section === activeSection) || [],
    [definition, activeSection]
  );

  const answeredCount = useMemo(
    () => definition?.questions.filter((question) => hasAnswer(question, answers[question.code])).length || 0,
    [definition, answers]
  );

  const totalQuestions = definition?.questions.length || 0;
  const progressValue = totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0;

  const updateAnswer = (code: string, patch: Partial<AnswerState>) => {
    setAnswers((current) => ({
      ...current,
      [code]: { ...current[code], ...patch },
    }));
  };

  const toggleMultiOption = (code: string, option: string) => {
    const current = answers[code];
    const selected = Array.isArray(current?.answer) ? current.answer : [];
    const next = selected.includes(option)
      ? selected.filter((item) => item !== option)
      : [...selected, option];

    updateAnswer(code, {
      answer: next,
      other_text: option === OTHER_OPTION && selected.includes(option) ? '' : current?.other_text || '',
    });
  };

  const payload = useMemo(() => ({
    answers: (definition?.questions || []).map((question) => ({
      question_code: question.code,
      answer: answers[question.code]?.answer ?? (question.type === 'multi' ? [] : ''),
      comments: answers[question.code]?.comments || '',
      other_text: answers[question.code]?.other_text || '',
    })),
  }), [answers, definition]);

  const save = async (submitAssessment = false) => {
    if (!definition) return;
    try {
      setIsSaving(true);
      setMessage('');
      setError('');
      const result = submitAssessment
        ? await apiPost<AssessmentResponse>(`/api/fraud-assessments/${definition.code}/submit`, payload)
        : await apiPut<AssessmentResponse>(`/api/fraud-assessments/${definition.code}`, payload);
      setAssessment(result);
      setMessage(submitAssessment ? copy.submitted : copy.saved);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save fraud assessment.');
    } finally {
      setIsSaving(false);
    }
  };

  const exportExcel = async () => {
    if (!definition) return;
    try {
      setIsExporting(true);
      setMessage('');
      setError('');
      await apiPostDownload(
        `/api/fraud-assessments/${definition.code}/export`,
        payload,
        exportFileName(definition.code, definition.title)
      );
      setMessage(copy.exported);
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : 'Failed to export fraud assessment to Excel.');
    } finally {
      setIsExporting(false);
    }
  };

  const exportAllExcel = async () => {
    if (!definition) return;
    try {
      setIsExportingAll(true);
      setMessage('');
      setError('');
      await apiPostDownload(
        '/api/fraud-assessments/export-all',
        {
          current_assessment_code: definition.code,
          current_answers: payload.answers,
        },
        'Fraud_Assessment_Complete.xlsx'
      );
      setMessage(copy.exportedAll);
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : 'Failed to export all fraud assessments to Excel.');
    } finally {
      setIsExportingAll(false);
    }
  };

  const formatDate = (value?: string | null) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString(isArabic ? 'ar-SA' : 'en-GB');
  };

  const renderQuestion = (question: AssessmentQuestion) => {
    const state = answers[question.code] || blankAnswer(question);
    const otherSelected = question.type === 'multi'
      ? Array.isArray(state.answer) && state.answer.includes(OTHER_OPTION)
      : state.answer === OTHER_OPTION;

    return (
      <section className="assessment-question" key={question.code}>
        <div className="assessment-question-heading">
          <div className="assessment-question-code">{question.code}</div>
          <div className="assessment-question-copy">
            <h3>{question.prompt}</h3>
            {question.type === 'single' ? <span className="assessment-instruction">{copy.selectOne}</span> : null}
            {question.type === 'multi' ? <span className="assessment-instruction">{copy.selectAll}</span> : null}
          </div>
        </div>

        <div className="assessment-answer-area">
          <div>
            <span className="assessment-field-label">{copy.answer}</span>
            {question.type === 'text' ? (
              <textarea
                rows={3}
                disabled={!canEdit}
                value={typeof state.answer === 'string' ? state.answer : ''}
                onChange={(event) => updateAnswer(question.code, { answer: event.target.value })}
              />
            ) : null}

            {question.type === 'single' ? (
              <div className="assessment-options">
                {question.options?.map((option) => (
                  <label className="assessment-option" key={option}>
                    <input
                      type="radio"
                      name={`assessment-${question.code}`}
                      disabled={!canEdit}
                      checked={state.answer === option}
                      onChange={() => updateAnswer(question.code, {
                        answer: option,
                        other_text: option === OTHER_OPTION ? state.other_text : '',
                      })}
                    />
                    <span>{option}</span>
                  </label>
                ))}
              </div>
            ) : null}

            {question.type === 'multi' ? (
              <div className="assessment-options">
                {question.options?.map((option) => {
                  const selected = Array.isArray(state.answer) && state.answer.includes(option);
                  return (
                    <label className="assessment-option" key={option}>
                      <input
                        type="checkbox"
                        disabled={!canEdit}
                        checked={selected}
                        onChange={() => toggleMultiOption(question.code, option)}
                      />
                      <span>{option}</span>
                    </label>
                  );
                })}
              </div>
            ) : null}

            {otherSelected ? (
              <label className="assessment-other-field">
                <span>{copy.other}</span>
                <input
                  disabled={!canEdit}
                  value={state.other_text}
                  onChange={(event) => updateAnswer(question.code, { other_text: event.target.value })}
                />
              </label>
            ) : null}
          </div>

          <label>
            <span className="assessment-field-label">{copy.comments}</span>
            <textarea
              rows={3}
              disabled={!canEdit}
              value={state.comments}
              onChange={(event) => updateAnswer(question.code, { comments: event.target.value })}
            />
          </label>
        </div>
      </section>
    );
  };

  if (!definition) {
    return (
      <div dir={isArabic ? 'rtl' : 'ltr'}>
        <PageHeader eyebrow={copy.eyebrow} title="Fraud Assessment" subtitle={copy.subtitle} />
        <div className="card error-message">{copy.missing}</div>
      </div>
    );
  }

  return (
    <div dir={isArabic ? 'rtl' : 'ltr'}>
      <PageHeader eyebrow={copy.eyebrow} title={definition.title} subtitle={copy.subtitle} />

      {error ? <div className="card error-message">{error}</div> : null}
      {message ? <div className="card success-message">{message}</div> : null}
      {!canEdit ? <div className="card assessment-readonly-message">{copy.noEdit}</div> : null}

      <div className="card assessment-summary-card">
        <div className="assessment-summary-item">
          <span>{copy.status}</span>
          <strong className={`assessment-status ${assessment?.status === 'Submitted' ? 'submitted' : 'draft'}`}>
            {assessment?.status || 'Draft'}
          </strong>
        </div>
        <div className="assessment-summary-item assessment-progress-item">
          <div>
            <span>{copy.progress}</span>
            <strong>{answeredCount} / {totalQuestions} {copy.answered}</strong>
          </div>
          <progress max={100} value={progressValue} />
        </div>
        <div className="assessment-summary-item">
          <span>{copy.lastUpdated}</span>
          <strong>{formatDate(assessment?.updated_at)}</strong>
        </div>
      </div>

      <div className="assessment-tabs" role="tablist" aria-label={definition.title}>
        {definition.sections.map((section) => {
          const count = definition.questions.filter((question) => question.section === section).length;
          return (
            <button
              key={section}
              type="button"
              className={activeSection === section ? 'active' : ''}
              onClick={() => setActiveSection(section)}
            >
              {section}
              <span>{count}</span>
            </button>
          );
        })}
      </div>

      <div className="card assessment-form-card">
        {isLoading ? <p className="muted">{copy.loading}</p> : sectionQuestions.map(renderQuestion)}

        {!isLoading ? (
          <div className="assessment-actions">
            <button className="btn" type="button" disabled={isSaving || isExporting || isExportingAll} onClick={exportExcel}>
              {isExporting ? copy.exporting : copy.exportExcel}
            </button>
            <button className="btn" type="button" disabled={isSaving || isExporting || isExportingAll} onClick={exportAllExcel}>
              {isExportingAll ? copy.exportingAll : copy.exportAllExcel}
            </button>
            {canEdit ? (
              <button className="btn" type="button" disabled={isSaving || isExporting || isExportingAll} onClick={() => save(false)}>
                {isSaving ? copy.saving : copy.saveDraft}
              </button>
            ) : null}
            {canSubmit ? (
              <button className="btn primary" type="button" disabled={isSaving || isExporting || isExportingAll} onClick={() => save(true)}>
                {isSaving ? copy.saving : copy.submit}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
