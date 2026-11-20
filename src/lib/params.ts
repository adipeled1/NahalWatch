/**
 * Display metadata for the measured parameters, keyed by the Excel header token.
 * `group` drives how the station screen groups them; `featured` ones get charts.
 */
export type ParamGroup = 'bacteria' | 'organic' | 'nutrients' | 'physical' | 'minerals' | 'metals' | 'other';

export interface ParamInfo {
  key: string;
  he: string;
  en: string;
  unit: string;
  group: ParamGroup;
  featured?: boolean;
  /** One-sentence plain-language explanation for the "what does this mean" tooltip. */
  explain?: string;
}

export const PARAMS: ParamInfo[] = [
  { key: 'Fcoli', he: 'קוליפורמים צואתיים', en: 'Fecal coliforms', unit: 'cfu/100ml', group: 'bacteria', featured: true,
    explain: 'חיידקים ממקור צואה של בני אדם ובעלי חיים. המדד המרכזי לסיכון בריאותי ברחצה.' },
  { key: 'Ecoli', he: 'אי-קולי', en: 'E. coli', unit: 'cfu/100ml', group: 'bacteria', featured: true,
    explain: 'חיידק מעיים — סימן ישיר לזיהום בשפכים או בצואה.' },
  { key: 'Fstrp', he: 'סטרפטוקוקים צואתיים', en: 'Fecal streptococci', unit: 'cfu/100ml', group: 'bacteria',
    explain: 'אינדיקטור נוסף לזיהום צואתי, שורד זמן רב יותר במים.' },
  { key: 'Coli', he: 'קוליפורמים כלליים', en: 'Total coliforms', unit: 'cfu/100ml', group: 'bacteria' },
  { key: 'TOTB', he: 'ספירה כללית', en: 'Total bacteria', unit: 'cfu/ml', group: 'bacteria' },

  { key: 'BODt', he: 'צח"ב', en: 'BOD', unit: 'mg/l', group: 'organic', featured: true,
    explain: 'צריכת חמצן ביוכימית — כמה חומר אורגני (למשל שפכים) יש במים.' },
  { key: 'CODt', he: 'צח"כ', en: 'COD', unit: 'mg/l', group: 'organic', explain: 'צריכת חמצן כימית — עומס אורגני כולל.' },
  { key: 'Toc', he: 'פחמן אורגני', en: 'TOC', unit: 'mg/l', group: 'organic' },
  { key: 'TSS105', he: 'מוצקים מרחפים', en: 'TSS', unit: 'mg/l', group: 'organic', featured: true,
    explain: 'חלקיקים מרחפים — אחראים לעכירות המים.' },
  { key: 'Minoil', he: 'שמן מינרלי', en: 'Mineral oil', unit: 'mg/l', group: 'organic' },
  { key: 'ABS', he: 'דטרגנטים אניוניים', en: 'Detergents', unit: 'mg/l', group: 'organic' },

  { key: 'NH4', he: 'אמוניום', en: 'Ammonium', unit: 'mg/l', group: 'nutrients', featured: true,
    explain: 'תוצר פירוק של שפכים. בריכוז גבוה רעיל לדגים.' },
  { key: 'NO3', he: 'חנקה', en: 'Nitrate', unit: 'mg/l', group: 'nutrients' },
  { key: 'NO2', he: 'חנקית', en: 'Nitrite', unit: 'mg/l', group: 'nutrients' },
  { key: 'Ntot', he: 'חנקן כללי', en: 'Total N', unit: 'mg/l', group: 'nutrients' },
  { key: 'TKN', he: 'חנקן קילדל', en: 'TKN', unit: 'mg/l', group: 'nutrients' },
  { key: 'Ptot', he: 'זרחן כללי', en: 'Total P', unit: 'mg/l', group: 'nutrients', featured: true,
    explain: 'מזין שגורם לפריחת אצות ולהתדלדלות חמצן.' },
  { key: 'PO4', he: 'זרחה', en: 'Phosphate', unit: 'mg/l', group: 'nutrients' },

  { key: 'Temp', he: 'טמפרטורה', en: 'Temperature', unit: '°C', group: 'physical', featured: true },
  { key: 'pH', he: 'חומציות', en: 'pH', unit: '', group: 'physical' },
  { key: 'Do', he: 'חמצן מומס', en: 'Dissolved O₂', unit: 'mg/l', group: 'physical', featured: true,
    explain: 'חמצן זמין לדגים ולחי. ערך נמוך מעיד על זיהום אורגני.' },
  { key: 'Doxsat', he: 'רוויית חמצן', en: 'O₂ saturation', unit: '%', group: 'physical' },
  { key: 'Ec', he: 'מוליכות', en: 'Conductivity', unit: 'mmho/cm', group: 'physical' },
  { key: 'Secchi', he: 'שקיפות (סקי)', en: 'Secchi depth', unit: 'cm', group: 'physical' },
  { key: 'Dept', he: 'עומק', en: 'Depth', unit: 'm', group: 'physical' },
  { key: 'Q', he: 'ספיקה', en: 'Flow', unit: 'm³/h', group: 'physical' },
  { key: 'Turb', he: 'עכירות', en: 'Turbidity', unit: 'NTU', group: 'physical' },

  { key: 'Cl', he: 'כלוריד', en: 'Chloride', unit: 'mg/l', group: 'minerals' },
  { key: 'SO4', he: 'סולפט', en: 'Sulfate', unit: 'mg/l', group: 'minerals' },
  { key: 'B', he: 'בורון', en: 'Boron', unit: 'mg/l', group: 'minerals' },
  { key: 'TDS', he: 'מוצקים מומסים', en: 'TDS', unit: 'mg/l', group: 'minerals' },
  { key: 'Na', he: 'נתרן', en: 'Sodium', unit: 'mg/l', group: 'minerals' },
  { key: 'Ca', he: 'סידן', en: 'Calcium', unit: 'mg/l', group: 'minerals' },
  { key: 'Mg', he: 'מגנזיום', en: 'Magnesium', unit: 'mg/l', group: 'minerals' },
  { key: 'K', he: 'אשלגן', en: 'Potassium', unit: 'mg/l', group: 'minerals' },

  { key: 'Hg', he: 'כספית', en: 'Mercury', unit: 'mg/l', group: 'metals' },
  { key: 'Cr', he: 'כרום', en: 'Chromium', unit: 'mg/l', group: 'metals' },
  { key: 'Ni', he: 'ניקל', en: 'Nickel', unit: 'mg/l', group: 'metals' },
  { key: 'Pb', he: 'עופרת', en: 'Lead', unit: 'mg/l', group: 'metals' },
  { key: 'Cd', he: 'קדמיום', en: 'Cadmium', unit: 'mg/l', group: 'metals' },
  { key: 'Zn', he: 'אבץ', en: 'Zinc', unit: 'mg/l', group: 'metals' },
  { key: 'As', he: 'ארסן', en: 'Arsenic', unit: 'mg/l', group: 'metals' },
  { key: 'Cu', he: 'נחושת', en: 'Copper', unit: 'mg/l', group: 'metals' },
];

export const PARAM_BY_KEY: Record<string, ParamInfo> = Object.fromEntries(PARAMS.map((p) => [p.key, p]));

export const GROUP_LABEL: Record<ParamGroup, string> = {
  bacteria: 'חיידקים',
  organic: 'עומס אורגני',
  nutrients: 'נוטריאנטים',
  physical: 'פיזיקלי',
  minerals: 'מינרלים',
  metals: 'מתכות',
  other: 'אחר',
};

export function paramInfo(key: string): ParamInfo {
  return PARAM_BY_KEY[key] ?? { key, he: key, en: key, unit: '', group: 'other' };
}
