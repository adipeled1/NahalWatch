import type { Metadata } from 'next';
import { Database, Gauge, ShieldAlert, Smartphone, Users } from 'lucide-react';
import meta from '../../../public/data/meta.json';
import { paramInfo } from '@/lib/params';
import { RULES, SOURCE_LABEL, fmt } from '@/lib/quality';
import { Card, CardHeader, PageHeader } from '@/components/ui/Card';

export const metadata: Metadata = { title: 'מידע ומתודולוגיה' };

const dateFmt = new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'long', year: 'numeric' });

function limitText(r: (typeof RULES)[number]) {
  if (r.range) return `אדום מחוץ ל-${fmt(r.range[0])}–${fmt(r.range[1])}`;
  if (r.dangerBelow != null) return `אדום מתחת ל-${fmt(r.dangerBelow)}`;
  const parts = [];
  if (r.cautionAbove != null) parts.push(`צהוב מעל ${fmt(r.cautionAbove)}`);
  if (r.dangerAbove != null) parts.push(`אדום מעל ${fmt(r.dangerAbove)}`);
  return parts.join(' · ');
}

export default function AboutPage() {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="על NahalWatch"
        subtitle="נתוני מחקר אמיתיים מנחלי ישראל, בתשובה פשוטה — אפשר להיכנס למים היום?"
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
              דגימה אחרונה במאגר: {dateFmt.format(new Date(meta.lastSample))}. בקובץ המקור אין קואורדינטות: חלק מהתחנות ממוקמות לפי רשימת התחנות ההידרומטריות הרשמית של רשות המים (data.gov.il), והשאר משוערות לפי שם התחנה (גשר, כביש, מעיין).
            </p>
          </div>
        </Card>

        <Card>
          <CardHeader icon={<Gauge className="size-4" />} title="איך נקבע צבע הרמזור?" />
          <div className="px-4 pb-4 text-sm">
            <ul className="mb-3 flex flex-col gap-1.5 leading-relaxed">
              <li><b className="text-safe">ירוק</b> — כל המדדים שנבדקו בתוך הערכים הרשמיים.</li>
              <li><b className="text-caution">צהוב</b> — קוליפורמים צואתיים 200–400 (משרד הבריאות), או מדד מעל &quot;הערך המרבי לממוצע חודשי&quot; בתקנות ענבר.</li>
              <li><b className="text-danger">אדום</b> — קוליפורמים צואתיים מעל 400 ל-100 מ״ל (משרד הבריאות), או מדד מעל &quot;הערך המרבי&quot; בתקנות ענבר, או חמצן מומס / pH מחוץ לגבול המותר.</li>
            </ul>
            <p className="mb-2 text-xs leading-relaxed text-muted">
              בכל מצב צהוב או אדום מופיע בדיוק איזה מדד חרג, כמה נמדד ומה הערך הרשמי. מדדים ללא ערך רשמי (למשל אי-קולי וטמפרטורה) מוצגים אך לא משפיעים על הצבע.
            </p>
            <table className="w-full text-sm">
              <tbody>
                {RULES.map((r) => {
                  const p = paramInfo(r.key);
                  return (
                    <tr key={r.key} className="border-b border-border last:border-0">
                      <td className="py-1.5 font-semibold">{p.he}</td>
                      <td className="py-1.5 text-xs text-muted">{limitText(r)} <span dir="ltr">{p.unit}</span></td>
                      <td className="py-1.5 text-end text-[11px] text-faint">{SOURCE_LABEL[r.source]}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="mt-3 rounded-lg bg-surface-2 p-3 text-xs leading-relaxed text-muted">
              <div className="mb-1 font-bold text-fg">מקורות רשמיים</div>
              <ol className="list-decimal ps-4">
                <li>משרד הבריאות, המחלקה לבריאות הסביבה — דו״ח פעילות לשנת 2024, תחום איכות מים (מאי 2025): בנחלים עם מגע של הציבור במים, עד 400 קוליפורמים צואתיים ל-100 מ״ל.</li>
                <li>הנחיות המהנדס הראשי, משרד הבריאות (10.3.2010) — תקן לאיכות מי ים בחופי רחצה מוכרזים: ממוצע גיאומטרי עונתי עד 200, מקסימום 400.</li>
                <li>תקנות בריאות העם (תקני איכות מי קולחין וכללים לטיהור שפכים), התש״ע-2010 (&quot;תקנות ענבר&quot;), התוספת הראשונה — האיכות הנדרשת להזרמה לנחלים: ערך מרבי לממוצע חודשי וערך מרבי.</li>
              </ol>
            </div>
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
            <p className="mt-1 text-muted">מנחה: <bdi dir="ltr">Dr. Naomi Unkelos-Shpigel</bdi></p>
            <p className="mt-1 text-xs text-muted">פרויקט במסגרת אשכול מעבדות — אפליקציה מבוססת ענן לחוויית מידע אקולוגי, שנבנתה בתהליך חשיבה עיצובית.</p>
          </div>
        </Card>
      </div>

      <Card className="border-caution/30 bg-caution-soft">
        <div className="flex gap-3 p-4 text-sm leading-relaxed">
          <ShieldAlert className="size-5 shrink-0 text-caution" aria-hidden />
          <p>
            <b>הבהרה:</b> NahalWatch הוא פרויקט לימודי. הרמזור מבוסס על הערכים הרשמיים שלמעלה, אבל הוא מחושב מהדגימה האחרונה במאגר ואינו מחליף הודעות עדכניות של משרד הבריאות או רשות הטבע והגנים.
            שלטי &quot;הרחצה אסורה&quot; בשטח גוברים תמיד על מה שמוצג באפליקציה.
          </p>
        </div>
      </Card>
    </div>
  );
}
