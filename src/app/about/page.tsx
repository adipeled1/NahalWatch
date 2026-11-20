import type { Metadata } from 'next';
import { Database, Gauge, ShieldAlert, Smartphone, Users } from 'lucide-react';
import meta from '../../../public/data/meta.json';
import { paramInfo } from '@/lib/params';
import { RULES, fmt } from '@/lib/quality';
import { Card, CardHeader, PageHeader } from '@/components/ui/Card';

export const metadata: Metadata = { title: 'מידע ומתודולוגיה' };

const dateFmt = new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'long', year: 'numeric' });

function limitText(r: (typeof RULES)[number]) {
  if (r.range) return `טווח תקין ${r.range[0]}–${r.range[1]}`;
  if (r.cautionBelow != null) return `חשוד מתחת ל-${fmt(r.cautionBelow)}`;
  const parts = [];
  if (r.cautionAbove != null) parts.push(`חשוד מעל ${fmt(r.cautionAbove)}`);
  if (r.dangerAbove != null) parts.push(`אזהרה מעל ${fmt(r.dangerAbove)}`);
  return parts.join(' · ');
}

export default function AboutPage() {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="על NahalWatch"
        subtitle="אקולוגיה בכף היד: נתוני מחקר אמיתיים מנחלי ישראל, בתשובה פשוטה — אפשר להיכנס למים היום?"
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader icon={<Database className="size-4" />} title="מקור הנתונים" />
          <div className="px-4 pb-4 text-sm leading-relaxed">
            <p>{meta.sourceDescription}.</p>
            <ul className="mt-2 grid grid-cols-2 gap-2 text-center">
              <li className="rounded-xl bg-surface-2 p-2.5"><div className="num text-xl font-extrabold">{meta.rowCount.toLocaleString('he-IL')}</div><div className="text-xs text-muted">דגימות</div></li>
              <li className="rounded-xl bg-surface-2 p-2.5"><div className="num text-xl font-extrabold">{meta.stationCount}</div><div className="text-xs text-muted">תחנות ניטור</div></li>
              <li className="rounded-xl bg-surface-2 p-2.5"><div className="num text-xl font-extrabold">{meta.streamCount}</div><div className="text-xs text-muted">נחלים וקבוצות</div></li>
              <li className="rounded-xl bg-surface-2 p-2.5"><div className="num text-xl font-extrabold">{meta.firstSample.slice(0, 4)}–{meta.lastSample.slice(0, 4)}</div><div className="text-xs text-muted">שנות ניטור</div></li>
            </ul>
            <p className="mt-3 text-xs text-muted">
              דגימה אחרונה במאגר: {dateFmt.format(new Date(meta.lastSample))}. מיקומי התחנות על המפה משוערים — נקבעו לפי שם התחנה (גשר, כביש, מעיין), כי בקובץ המקור אין קואורדינטות.
            </p>
          </div>
        </Card>

        <Card>
          <CardHeader icon={<Gauge className="size-4" />} title="איך נקבע צבע הרמזור?" />
          <div className="px-4 pb-4 text-sm">
            <p className="mb-2 leading-relaxed text-muted">
              החיידקים קובעים: אם אחד ממדדי הזיהום הצואתי חוצה את סף האזהרה — התחנה אדומה, וכתוב בדיוק איזה חיידק, כמה נמדד ומה הסף.
              מדדים כימיים יכולים להעלות את הסטטוס ל&quot;חשוד&quot; בלבד.
            </p>
            <table className="w-full text-sm">
              <tbody>
                {RULES.map((r) => {
                  const p = paramInfo(r.key);
                  return (
                    <tr key={r.key} className="border-b border-border last:border-0">
                      <td className="py-1.5 font-semibold">{p.he}{r.decisive && <span className="ms-1 text-[10px] font-bold text-danger">קובע</span>}</td>
                      <td className="py-1.5 text-xs text-muted">{limitText(r)} <span dir="ltr">{p.unit}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <CardHeader icon={<Smartphone className="size-4" />} title="התקנה כאפליקציה בטלפון" />
          <div className="flex flex-col gap-3 px-4 pb-4 text-sm leading-relaxed">
            <div><b>iPhone (Safari):</b> לחצו על כפתור השיתוף <span aria-hidden>⎋</span> ← &quot;הוספה למסך הבית&quot;. האפליקציה תיפתח במסך מלא, כמו אפליקציה רגילה.</div>
            <div><b>Android (Chrome):</b> תפריט ⋮ ← &quot;התקנת אפליקציה&quot; / &quot;הוספה למסך הבית&quot;.</div>
            <div className="text-xs text-muted">אחרי ביקור ראשון, המפה והנתונים שנצפו זמינים גם בקליטה חלשה או בלי קליטה.</div>
          </div>
        </Card>

        <Card>
          <CardHeader icon={<Users className="size-4" />} title="הצוות" />
          <div className="px-4 pb-4 text-sm leading-relaxed">
            <p>שקד מאלול · עדי פלד · אור אורבך</p>
            <p className="mt-1 text-xs text-muted">פרויקט במסגרת אשכול מעבדות — אפליקציה מבוססת ענן לחוויית מידע אקולוגי, נבנתה בתהליך חשיבה עיצובית סביב שתי פרסונות: איתן, מטייל צעיר, ומיכל, אמא לשלושה.</p>
          </div>
        </Card>
      </div>

      <Card className="border-caution/30 bg-caution-soft">
        <div className="flex gap-3 p-4 text-sm leading-relaxed">
          <ShieldAlert className="size-5 shrink-0 text-caution" aria-hidden />
          <p>
            <b>הבהרה:</b> NahalWatch הוא פרויקט לימודי. מדד הרמזור והתחזיות הם כלי להמחשה ואינם מחליפים הנחיות רשמיות של משרד הבריאות או רשות הטבע והגנים.
            שלטי &quot;הרחצה אסורה&quot; בשטח גוברים תמיד על מה שמוצג באפליקציה.
          </p>
        </div>
      </Card>
    </div>
  );
}
