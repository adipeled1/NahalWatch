'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { BookOpenText, ChevronDown, FileText, Quote, RotateCcw, Send, User, X } from 'lucide-react';
import { buildIndex, highlight, search, type PapersIndex, type SearchHit, type SearchResult } from '@/lib/papers';

// "Ask the papers": retrieval only. The answer is always a set of verbatim passages from the
// PDFs in /public/papers, ranked by BM25 in the browser. No language model, no API, no server.

const SUGGESTIONS = [
  'איך גשם משפיע על חיידקים צואתיים בנחל?',
  'מה משפיע על קצב הדעיכה של E. coli במים?',
  'האם עכירות מנבאת זיהום צואתי?',
  'מה הסיכון ברחצה בנחלים מזוהמים בישראל?',
  'כמה ימים אחרי גשם איכות המים הכי גרועה?',
  'איך טמפרטורה ואור שמש משפיעים על שרידות החיידקים?',
];

type Message =
  | { id: number; role: 'user'; text: string }
  | { id: number; role: 'bot'; result: SearchResult };

// The index is built once per page load, the first time the chat opens.
let indexPromise: Promise<PapersIndex> | null = null;
function loadIndex() {
  indexPromise ??= fetch('/data/papers.json')
    .then((r) => {
      if (!r.ok) throw new Error(String(r.status));
      return r.json();
    })
    .then(buildIndex)
    .catch((e) => {
      indexPromise = null;
      throw e;
    });
  return indexPromise;
}

export default function PapersChat() {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState<PapersIndex | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const lastQuestion = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    loadIndex().then(setIndex, () => setFailed(true));
    if (matchMedia('(min-width: 1024px)').matches) inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    // Full-screen on phones: keep the page behind it from scrolling.
    const prev = document.body.style.overflow;
    if (!matchMedia('(min-width: 1024px)').matches) document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Bring the newest question (and the quotes under it) to the top of the list.
  useEffect(() => {
    lastQuestion.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [messages]);

  const ask = (q: string) => {
    const text = q.trim();
    if (!text || pending) return;
    setInput('');
    setFailed(false);
    setPending(true);
    setMessages((m) => [...m, { id: Date.now(), role: 'user', text }]);
    loadIndex()
      .then((idx) => {
        setIndex(idx);
        setMessages((m) => [...m, { id: Date.now() + 1, role: 'bot', result: search(idx, text) }]);
      })
      .catch(() => setFailed(true))
      .finally(() => setPending(false));
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    ask(input);
  };

  const lastUserId = [...messages].reverse().find((m) => m.role === 'user')?.id;

  return (
    <>
      {/* Floating button (above the bottom tab bar on phones, next to the side rail on desktop) */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? 'סגירת השאלות למאמרים' : 'שאלו את המאמרים'}
        aria-expanded={open}
        title="שאלו את המאמרים"
        className={`fixed right-4 bottom-[calc(env(safe-area-inset-bottom)+4.75rem)] z-[550] flex h-14 min-w-14 items-center justify-center gap-2 rounded-full bg-linear-to-tr from-accent to-water px-4 text-accent-fg shadow-pop transition-transform hover:scale-105 lg:right-[17rem] lg:bottom-8 lg:px-5 ${open ? 'max-lg:hidden' : ''}`}
      >
        {open ? <X className="size-6" aria-hidden /> : <BookOpenText className="size-6" aria-hidden />}
        <span className="hidden text-sm font-bold lg:inline">{open ? 'סגירה' : 'שאלו את המאמרים'}</span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="papers-chat-title"
          className="nw-chat-in fixed inset-0 z-[1100] flex flex-col overflow-hidden bg-surface lg:inset-auto lg:right-[17rem] lg:bottom-28 lg:h-[min(700px,calc(100dvh-9rem))] lg:w-[440px] lg:rounded-2xl lg:border lg:border-border lg:shadow-pop"
        >
          {/* Header */}
          <div className="safe-top bg-linear-to-l from-accent to-water text-accent-fg shadow-md">
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent-fg/15">
                  <BookOpenText className="size-5" aria-hidden />
                </span>
                <div className="min-w-0">
                  <h2 id="papers-chat-title" className="font-bold leading-tight">שאלו את המאמרים</h2>
                  <p className="truncate text-xs opacity-90">ציטוטים מ-5 מאמרים · בלי AI גנרטיבי</p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {messages.length > 0 && (
                  <button type="button" onClick={() => setMessages([])} aria-label="שיחה חדשה" title="שיחה חדשה" className="grid size-9 place-items-center rounded-full hover:bg-accent-fg/15">
                    <RotateCcw className="size-[18px]" aria-hidden />
                  </button>
                )}
                <button type="button" onClick={() => setOpen(false)} aria-label="סגירה" className="grid size-9 place-items-center rounded-full hover:bg-accent-fg/15">
                  <X className="size-5" aria-hidden />
                </button>
              </div>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 space-y-4 overflow-y-auto overscroll-contain bg-surface-2 p-4" aria-live="polite">
            {messages.length === 0 && <EmptyState index={index} onAsk={ask} />}

            {messages.map((m) =>
              m.role === 'user' ? (
                <div key={m.id} ref={m.id === lastUserId ? lastQuestion : undefined} className="flex scroll-mt-4 justify-end gap-2.5">
                  <div className="max-w-[85%] rounded-2xl rounded-se-sm bg-accent px-3.5 py-2.5 text-sm leading-relaxed text-accent-fg shadow-sm">{m.text}</div>
                  <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-surface-hover text-muted">
                    <User className="size-4" aria-hidden />
                  </span>
                </div>
              ) : (
                <BotAnswer key={m.id} result={m.result} />
              ),
            )}

            {pending && (
              <div className="flex gap-2.5">
                <BotAvatar />
                <div className="flex items-center gap-1 rounded-2xl rounded-ss-sm border border-border bg-surface px-4 py-3 shadow-sm" aria-label="מחפש במאמרים">
                  {[0, 150, 300].map((d) => (
                    <span key={d} className="size-1.5 animate-bounce rounded-full bg-accent" style={{ animationDelay: `${d}ms` }} />
                  ))}
                </div>
              </div>
            )}

            {failed && (
              <div className="rounded-xl border border-danger/30 bg-danger-soft p-3 text-sm text-danger">
                לא הצלחתי לטעון את המאמרים. בדקו את החיבור ונסו שוב.
              </div>
            )}
          </div>

          {/* Follow-up suggestions */}
          {messages.length > 0 && (
            <div className="scrollbar-none flex gap-2 overflow-x-auto border-t border-border bg-surface px-3 pt-2.5">
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" onClick={() => ask(s)} className="h-8 shrink-0 rounded-full border border-border bg-surface-2 px-3 text-xs font-semibold text-muted hover:bg-surface-hover hover:text-fg">
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <form onSubmit={onSubmit} className={`safe-bottom flex gap-2 bg-surface p-3 ${messages.length ? '' : 'border-t border-border'}`}>
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="שאלה על המחקר, בעברית או באנגלית…"
              aria-label="שאלה למאמרים"
              enterKeyHint="search"
              className="min-w-0 flex-1 rounded-full border border-border bg-surface-2 px-4 py-2.5 text-base text-fg placeholder:text-faint focus:border-accent focus:outline-none lg:text-sm"
            />
            <button
              type="submit"
              disabled={!input.trim() || pending}
              aria-label="חיפוש במאמרים"
              className="grid size-11 shrink-0 place-items-center rounded-full bg-accent text-accent-fg shadow-sm transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send className="size-[18px] rtl:-scale-x-100" aria-hidden />
            </button>
          </form>
        </div>
      )}
    </>
  );
}

function BotAvatar() {
  return (
    <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-linear-to-br from-accent to-water text-accent-fg shadow-sm">
      <BookOpenText className="size-4" aria-hidden />
    </span>
  );
}

function EmptyState({ index, onAsk }: { index: PapersIndex | null; onAsk: (q: string) => void }) {
  return (
    <div className="flex flex-col items-center pt-2 text-center">
      <span className="mb-3 grid size-14 place-items-center rounded-full bg-accent-soft text-accent">
        <BookOpenText className="size-7" aria-hidden />
      </span>
      <p className="font-bold text-fg">מה תרצו לדעת מהמחקר?</p>
      <p className="mt-1 max-w-[300px] text-sm leading-relaxed text-muted">
        כתבו שאלה, ואחזיר את הקטעים הכי רלוונטיים מתוך המאמרים, עם עמוד וקישור ל-PDF.
      </p>
      <p className="mt-3 flex items-start gap-2 rounded-xl bg-water-soft px-3 py-2 text-start text-xs leading-relaxed text-water">
        <Quote className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        התשובות הן ציטוטים מדויקים מהמאמרים (באנגלית), לא טקסט שנוצר על ידי מודל שפה. החיפוש רץ בדפדפן.
      </p>

      <div className="mt-4 w-full text-start">
        <div className="mb-2 text-xs font-semibold text-faint">שאלות לדוגמה</div>
        <div className="flex flex-col gap-2">
          {SUGGESTIONS.map((s) => (
            <button key={s} type="button" onClick={() => onAsk(s)} className="rounded-xl border border-border bg-surface px-3.5 py-2.5 text-start text-sm font-medium text-fg shadow-sm transition-colors hover:border-accent hover:bg-accent-soft">
              {s}
            </button>
          ))}
        </div>
      </div>

      {index && (
        <details className="group mt-4 w-full text-start">
          <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-semibold text-faint [&::-webkit-details-marker]:hidden">
            המאמרים במאגר ({index.data.papers.length})
            <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden />
          </summary>
          <ul className="mt-2 flex flex-col gap-1.5">
            {index.data.papers.map((p) => (
              <li key={p.id} className="rounded-lg border border-border bg-surface px-3 py-2 text-xs">
                <a href={p.pdf} target="_blank" rel="noopener noreferrer" className="font-bold text-water hover:underline">
                  <bdi dir="ltr">{p.short} ({p.year})</bdi>
                </a>
                <div className="text-muted">{p.topic}</div>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function BotAnswer({ result }: { result: SearchResult }) {
  const { hits, concepts } = result;
  // Highlight the domain terms only (not generic ones like "effect").
  const terms = new Set(concepts.filter((c) => c.weight >= 1).flatMap((c) => c.terms));
  const words = [...new Set(concepts.filter((c) => c.weight >= 1).flatMap((c) => c.words))].slice(0, 10);
  return (
    <div className="flex gap-2.5">
      <BotAvatar />
      <div className="min-w-0 flex-1 space-y-2.5">
        <div className="rounded-2xl rounded-ss-sm border border-border bg-surface px-3.5 py-2.5 text-sm leading-relaxed text-fg shadow-sm">
          {hits.length > 0 ? (
            <>הנה {hits.length === 1 ? 'הקטע הכי קשור' : <><span className="num">{hits.length}</span> הקטעים הכי קשורים</>} לשאלה, מתוך המאמרים:</>
          ) : (
            <>לא מצאתי במאמרים קטע שמתאים לשאלה. נסו מילים אחרות (למשל גשם, עכירות, E. coli, טמפרטורה) או אחת מהשאלות לדוגמה.</>
          )}
          {words.length > 0 && (
            <div className="mt-1 text-[11px] text-faint">
              חיפשתי: <span dir="ltr" className="font-medium">{words.join(' · ')}</span>
            </div>
          )}
        </div>
        {hits.map((h, i) => <QuoteCard key={`${h.paper.id}-${h.chunk.pg}-${i}`} hit={h} n={i + 1} terms={terms} />)}
      </div>
    </div>
  );
}

function QuoteCard({ hit, n, terms }: { hit: SearchHit; n: number; terms: Set<string> }) {
  const [showApa, setShowApa] = useState(false);
  const { paper } = hit;
  return (
    <article className="overflow-hidden rounded-xl border border-border bg-surface shadow-card">
      <header className="flex items-center gap-2 border-b border-border px-3 py-2">
        <span className="num grid size-6 shrink-0 place-items-center rounded-full bg-accent-soft text-[11px] font-bold text-accent">{n}</span>
        <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-fg">
          <bdi dir="ltr">{paper.short} ({paper.year})</bdi>
        </span>
        <span className="shrink-0 text-xs text-muted">עמ׳ <span className="num">{hit.page}</span></span>
      </header>

      <blockquote dir="ltr" lang="en" className="px-3.5 py-3 text-left">
        <p className="border-l-[3px] border-water/50 pl-3 text-[13.5px] leading-relaxed text-fg">
          “{highlight(hit.chunk.t, terms).map((part, i) =>
            part.hit ? <mark key={i} className="rounded-sm bg-water-soft px-0.5 font-semibold text-water">{part.text}</mark> : part.text,
          )}”
        </p>
      </blockquote>

      <div className="flex items-center justify-between gap-2 border-t border-border bg-surface-2 px-3 py-1.5 text-xs">
        <a href={hit.href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 py-1 font-semibold text-water hover:underline">
          <FileText className="size-3.5" aria-hidden />
          פתיחת ה-PDF בעמוד <span className="num">{hit.page}</span>
        </a>
        <button type="button" onClick={() => setShowApa((v) => !v)} aria-expanded={showApa} className="inline-flex items-center gap-1 py-1 font-semibold text-muted hover:text-fg">
          ציטוט APA
          <ChevronDown className={`size-3.5 transition-transform ${showApa ? 'rotate-180' : ''}`} aria-hidden />
        </button>
      </div>
      {showApa && (
        <p dir="ltr" className="border-t border-border bg-surface-2 px-3.5 py-2.5 text-left text-xs leading-relaxed text-muted">
          {paper.apa}{' '}
          <a href={`https://doi.org/${paper.doi}`} target="_blank" rel="noopener noreferrer" className="break-all text-water hover:underline">
            https://doi.org/{paper.doi}
          </a>
        </p>
      )}
    </article>
  );
}
