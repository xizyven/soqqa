import type { Locale, StrategySlug } from "../domain/types";
import { envelopesContent, kakeiboContent, l, payYourselfFirstContent, rule503020Content, zeroBasedContent } from "./content-a";
import { debtPayoffContent, emergencyFundContent, lifestyleInflationContent, profitFirstContent, sinkingFundsContent } from "./content-b";
import type { L, LifeStage, ProfessionKey, StrategyContent } from "./types";

export type { L, LifeStage, ProfessionKey, StrategyContent } from "./types";

/** The ten strategies, in display order. */
export const STRATEGIES: StrategyContent[] = [
  payYourselfFirstContent,
  rule503020Content,
  zeroBasedContent,
  envelopesContent,
  kakeiboContent,
  profitFirstContent,
  sinkingFundsContent,
  emergencyFundContent,
  debtPayoffContent,
  lifestyleInflationContent,
];

export function getStrategy(slug: string): StrategyContent | undefined {
  return STRATEGIES.find((s) => s.slug === slug);
}

export const tl = (x: L, locale: Locale) => x[locale] || x.uz;

export const PROFESSIONS: Record<ProfessionKey, L> = {
  student: l("O'quvchilar", "Школьники и студенты колледжей", "School & college students"),
  university: l("Talabalar", "Студенты вузов", "University students"),
  freelancer: l("Frilanserlar", "Фрилансеры", "Freelancers"),
  salaried: l("Maosh oluvchilar", "Наёмные сотрудники", "Salaried employees"),
  entrepreneur: l("Tadbirkorlar", "Предприниматели", "Entrepreneurs"),
  small_business: l("Kichik biznes egalari", "Владельцы малого бизнеса", "Small business owners"),
  teacher: l("O'qituvchilar", "Учителя", "Teachers"),
  it: l("Dasturchilar va IT mutaxassislari", "Программисты и IT-специалисты", "Programmers & IT professionals"),
  sales: l("Savdo mutaxassislari", "Специалисты по продажам", "Sales professionals"),
  family: l("Oilalar", "Семьи", "Families"),
  irregular: l("Daromadi o'zgaruvchanlar", "С нерегулярным доходом", "People with irregular income"),
  retiree: l("Nafaqaxo'rlar", "Пенсионеры", "Retirees"),
};

export const LIFE_STAGES: Record<LifeStage, L> = {
  "16-20": l("16–20: moliyaviy asoslar", "16–20: финансовые основы", "16–20: financial foundations"),
  "21-25": l("21–25: karyera boshi", "21–25: начало карьеры", "21–25: early career"),
  "26-35": l("26–35: barqarorlik va katta xaridlar", "26–35: стабильность и крупные покупки", "26–35: stability & major purchases"),
  "36-50": l("36–50: oila va uzoq maqsadlar", "36–50: семья и долгосрочные цели", "36–50: family & long-term goals"),
  "51+": l("51+: nafaqaga tayyorgarlik", "51+: подготовка к пенсии", "51+: retirement preparation"),
};

export const LEVEL: Record<1 | 2 | 3, L> = {
  1: l("Past", "Низкая", "Low"),
  2: l("O'rta", "Средняя", "Medium"),
  3: l("Yuqori", "Высокая", "High"),
};

export function strategySlugs(): StrategySlug[] {
  return STRATEGIES.map((s) => s.slug);
}
