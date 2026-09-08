import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import { apiPost } from '../../api';
import type { AppLanguage } from '../../layout/AppLayout';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

type AssistantResponse = {
  answer: string;
  intent?: string;
  provider?: string;
  language?: string;
  readOnly?: boolean;
  warning?: string;
  caseNumber?: string | null;
};

type AssistantPosition = {
  inlineEnd: number;
  bottom: number;
};

const ASSISTANT_POSITION_KEY = 'fraud-assistant-position';
const ASSISTANT_DEFAULT_POSITION: AssistantPosition = { inlineEnd: 24, bottom: 24 };

function clampAssistantPosition(position: AssistantPosition, isOpen = false): AssistantPosition {
  if (typeof window === 'undefined') return position;

  const launcherSize = 58;
  const panelWidth = 430;
  const safeGap = 18;
  const maxInlineEnd = Math.max(safeGap, window.innerWidth - (isOpen ? panelWidth + safeGap : launcherSize + safeGap));
  const maxBottom = Math.max(safeGap, window.innerHeight - launcherSize - safeGap);

  return {
    inlineEnd: Math.min(Math.max(position.inlineEnd, safeGap), maxInlineEnd),
    bottom: Math.min(Math.max(position.bottom, safeGap), isOpen ? ASSISTANT_DEFAULT_POSITION.bottom : maxBottom),
  };
}

function readAssistantPosition(): AssistantPosition {
  if (typeof window === 'undefined') return ASSISTANT_DEFAULT_POSITION;

  try {
    const stored = window.localStorage.getItem(ASSISTANT_POSITION_KEY);
    if (!stored) return ASSISTANT_DEFAULT_POSITION;

    const parsed = JSON.parse(stored) as Partial<AssistantPosition>;
    if (typeof parsed.inlineEnd !== 'number' || typeof parsed.bottom !== 'number') return ASSISTANT_DEFAULT_POSITION;

    return clampAssistantPosition({ inlineEnd: parsed.inlineEnd, bottom: parsed.bottom });
  } catch {
    return ASSISTANT_DEFAULT_POSITION;
  }
}

function createMessage(role: ChatMessage['role'], content: string): ChatMessage {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    role,
    content,
  };
}

const copy = {
  en: {
    title: 'Fraud Assistant',
    subtitle: 'Secure, permission-aware, and read-only',
    open: 'Open intelligent assistant',
    close: 'Close assistant',
    clear: 'Clear',
    move: 'Drag to move assistant',
    placeholder: 'Ask about a case, status, or how to use the system…',
    send: 'Send',
    thinking: 'Checking the system…',
    welcome: 'Hello. I can explain how to use the system, check an authorized case status, summarize a case, show your assigned cases, and provide operational case counts.',
    note: 'The assistant cannot create, edit, suspend, close, or delete cases.',
    prompts: [
      'How do I create a fraud case?',
      'What is the difference between Open, Suspended, and Closed?',
      'How many cases are open, suspended, and closed?',
      'Show the cases assigned to me.',
    ],
    error: 'The assistant could not answer this request.',
  },
  ar: {
    title: 'مساعد إدارة الاحتيال',
    subtitle: 'آمن ويراعي الصلاحيات وللقراءة فقط',
    open: 'فتح المساعد الذكي',
    close: 'إغلاق المساعد',
    clear: 'مسح',
    move: 'اسحب لتحريك المساعد',
    placeholder: 'اسأل عن بلاغ أو حالة أو طريقة استخدام النظام…',
    send: 'إرسال',
    thinking: 'جاري التحقق من النظام…',
    welcome: 'مرحبًا. يمكنني شرح طريقة استخدام النظام، والتحقق من حالة بلاغ مصرح لك به، وتلخيص البلاغات، وعرض البلاغات المسندة لك، وتقديم إحصائيات الحالات.',
    note: 'لا يستطيع المساعد إنشاء البلاغات أو تعديلها أو تعليقها أو إغلاقها أو حذفها.',
    prompts: [
      'كيف أنشئ بلاغ احتيال؟',
      'ما الفرق بين مفتوح ومعلّق ومغلق؟',
      'كم عدد البلاغات المفتوحة والمعلقة والمغلقة؟',
      'اعرض البلاغات المسندة لي.',
    ],
    error: 'تعذر على المساعد الإجابة عن هذا الطلب.',
  },
} as const;

export default function AssistantPanel({ language }: { language: AppLanguage }) {
  const t = copy[language];
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [position, setPosition] = useState<AssistantPosition>(() => readAssistantPosition());
  const [isDragging, setIsDragging] = useState(false);
  const dragStateRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startPosition: AssistantPosition;
    moved: boolean;
  } | null>(null);
  const suppressToggleRef = useRef(false);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const visibleMessages = useMemo(() => {
    if (messages.length) return messages;
    return [createMessage('assistant', `${t.welcome}\n\n${t.note}`)];
  }, [messages, t.note, t.welcome]);

  useEffect(() => {
    if (isOpen) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [isOpen, isSending, messages]);

  useEffect(() => {
    setPosition((current) => clampAssistantPosition(current, isOpen));
  }, [isOpen]);

  useEffect(() => {
    window.localStorage.setItem(ASSISTANT_POSITION_KEY, JSON.stringify(position));
  }, [position]);

  useEffect(() => {
    const handleResize = () => {
      setPosition((current) => clampAssistantPosition(current, isOpen));
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isOpen]);

  const startDrag = (event: React.PointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;

    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startPosition: position,
      moved: false,
    };
    setIsDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveAssistant = (event: React.PointerEvent<HTMLElement>) => {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - dragState.startX;
    const deltaY = event.clientY - dragState.startY;

    if (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4) {
      dragState.moved = true;
    }

    const horizontalDirection = language === 'ar' ? 1 : -1;
    setPosition(clampAssistantPosition({
      inlineEnd: dragState.startPosition.inlineEnd + (deltaX * horizontalDirection),
      bottom: dragState.startPosition.bottom - deltaY,
    }, isOpen));
  };

  const stopDrag = (event: React.PointerEvent<HTMLElement>) => {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;

    suppressToggleRef.current = dragState.moved;
    dragStateRef.current = null;
    setIsDragging(false);
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const toggleAssistant = () => {
    if (suppressToggleRef.current) {
      suppressToggleRef.current = false;
      return;
    }

    setIsOpen((current) => !current);
  };

  const sendMessage = async (value?: string) => {
    const text = String(value ?? input).trim();
    if (!text || isSending) return;

    const userMessage = createMessage('user', text);
    const conversation = messages.slice(-10).map(({ role, content }) => ({ role, content }));
    setMessages((current) => [...current, userMessage]);
    setInput('');
    setIsSending(true);

    try {
      const response = await apiPost<AssistantResponse>('/api/assistant/chat', {
        message: text,
        language,
        conversation,
      });
      const suffix = response.warning ? `\n\n${response.warning}` : '';
      setMessages((current) => [...current, createMessage('assistant', `${response.answer}${suffix}`)]);
    } catch (error) {
      const message = error instanceof Error ? error.message : t.error;
      setMessages((current) => [...current, createMessage('assistant', message)]);
    } finally {
      setIsSending(false);
      window.setTimeout(() => inputRef.current?.focus(), 0);
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void sendMessage();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void sendMessage();
    }
  };

  return (
    <div
      className={`assistant-shell ${isOpen ? 'open' : ''} ${isDragging ? 'dragging' : ''}`}
      dir={language === 'ar' ? 'rtl' : 'ltr'}
      style={{ insetInlineEnd: `${position.inlineEnd}px`, bottom: `${position.bottom}px` }}
    >
      {isOpen ? (
        <section className="assistant-panel" aria-label={t.title}>
          <header
            className="assistant-header"
            title={t.move}
            onPointerDown={startDrag}
            onPointerMove={moveAssistant}
            onPointerUp={stopDrag}
            onPointerCancel={stopDrag}
          >
            <div>
              <span className="assistant-kicker">AI</span>
              <strong>{t.title}</strong>
              <small>{t.subtitle}</small>
            </div>
            <div className="assistant-header-actions" onPointerDown={(event) => event.stopPropagation()}>
              <button type="button" className="assistant-text-button" onClick={() => setMessages([])}>{t.clear}</button>
              <button type="button" className="assistant-close" aria-label={t.close} onClick={() => setIsOpen(false)}>×</button>
            </div>
          </header>

          <div className="assistant-messages" aria-live="polite">
            {visibleMessages.map((message) => (
              <div className={`assistant-message ${message.role}`} key={message.id}>
                <span>{message.role === 'assistant' ? 'FA' : language === 'ar' ? 'أنت' : 'You'}</span>
                <p>{message.content}</p>
              </div>
            ))}
            {isSending ? (
              <div className="assistant-message assistant">
                <span>FA</span>
                <p className="assistant-thinking">{t.thinking}</p>
              </div>
            ) : null}
            <div ref={messagesEndRef} />
          </div>

          {messages.length === 0 ? (
            <div className="assistant-prompts">
              {t.prompts.map((prompt) => (
                <button type="button" key={prompt} onClick={() => void sendMessage(prompt)}>{prompt}</button>
              ))}
            </div>
          ) : null}

          <form className="assistant-composer" onSubmit={submit}>
            <textarea
              ref={inputRef}
              value={input}
              rows={2}
              maxLength={1500}
              placeholder={t.placeholder}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isSending}
            />
            <button type="submit" disabled={isSending || !input.trim()}>{t.send}</button>
          </form>
        </section>
      ) : null}

      <button
        type="button"
        className="assistant-launcher"
        aria-label={isOpen ? t.close : t.open}
        title={`${isOpen ? t.close : t.open}. ${t.move}`}
        onPointerDown={startDrag}
        onPointerMove={moveAssistant}
        onPointerUp={stopDrag}
        onPointerCancel={stopDrag}
        onClick={toggleAssistant}
      >
        <span>AI</span>
      </button>
    </div>
  );
}
