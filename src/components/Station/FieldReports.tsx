'use client';
import { useRef, useState } from 'react';
import { Camera, MessageSquarePlus, Trash2, Users } from 'lucide-react';
import { ageLabel } from '@/lib/quality';
import { REPORT_KIND, compressPhoto, useReports, type ReportKind } from '@/lib/storage';
import { Card, CardHeader, Chip } from '@/components/ui/Card';

const TONE = { safe: 'text-safe bg-safe-soft', caution: 'text-caution bg-caution-soft', danger: 'text-danger bg-danger-soft' };

/**
 * Hiker field reports. MVP: saved on this device only (no accounts, no server) —
 * the UI and data shape are ready for a shared backend later.
 */
export function FieldReports({ stationId }: { stationId: string }) {
  const { reports, add, remove } = useReports(stationId);
  const [kind, setKind] = useState<ReportKind | null>(null);
  const [text, setText] = useState('');
  const [photo, setPhoto] = useState<string | undefined>();
  const fileRef = useRef<HTMLInputElement>(null);

  const submit = () => {
    if (!kind) return;
    add({ stationId, kind, text: text.trim(), photo });
    setKind(null);
    setText('');
    setPhoto(undefined);
  };

  return (
    <Card>
      <CardHeader
        icon={<Users className="size-4" />}
        title="דיווחים מהשטח"
        subtitle="ראיתם משהו בנחל? דווחו בשתי הקשות. הדיווחים נשמרים במכשיר שלכם בלבד."
      />
      <div className="flex flex-col gap-3 px-4 pb-4">
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(REPORT_KIND) as ReportKind[]).map((k) => (
            <Chip key={k} active={kind === k} onClick={() => setKind(kind === k ? null : k)}>{REPORT_KIND[k].label}</Chip>
          ))}
        </div>
        {kind && (
          <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface-2 p-3">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={2}
              maxLength={280}
              placeholder="פרטים נוספים (לא חובה)…"
              className="w-full resize-none rounded-lg border border-border bg-surface p-2.5 text-sm outline-none focus:border-accent"
            />
            {photo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo} alt="תצוגה מקדימה של התמונה" className="max-h-40 w-fit rounded-lg object-cover" />
            )}
            <div className="flex items-center gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (f) setPhoto(await compressPhoto(f));
                }}
              />
              <button type="button" onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-semibold text-muted hover:bg-surface-hover">
                <Camera className="size-4" /> {photo ? 'החלפת תמונה' : 'צירוף תמונה'}
              </button>
              <button type="button" onClick={submit} className="ms-auto inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-bold text-accent-fg hover:bg-accent-hover">
                <MessageSquarePlus className="size-4" /> שליחת דיווח
              </button>
            </div>
          </div>
        )}
        {reports.length === 0 ? (
          <p className="text-sm text-faint">עדיין אין דיווחים לתחנה הזו.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {reports.map((r) => (
              <li key={r.id} className="flex gap-3 rounded-xl border border-border p-3">
                {r.photo && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.photo} alt="" className="size-16 shrink-0 rounded-lg object-cover" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${TONE[REPORT_KIND[r.kind].tone]}`}>{REPORT_KIND[r.kind].label}</span>
                    <span className="text-xs text-faint">{ageLabel(r.at.slice(0, 10))}</span>
                  </div>
                  {r.text && <p className="mt-1 text-sm">{r.text}</p>}
                </div>
                <button type="button" onClick={() => remove(r.id)} aria-label="מחיקת הדיווח" className="self-start text-faint hover:text-danger">
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
