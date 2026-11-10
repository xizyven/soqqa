/**
 * Strategy content, part 1 (strategies 1–5). Facts follow the rules in
 * docs: creators are named only when genuinely identifiable; popularisers are
 * labelled as such; uncertain origins say so. Example numbers are computed by
 * the tested calculators in ./calc, never typed by hand.
 */
import { parseAmount, sum } from "../money/money";
import { payYourselfFirst, splitByBps, zeroBasedRemainder } from "./calc";
import type { L, StrategyContent } from "./types";

export const l = (uz: string, ru: string, en: string): L => ({ uz, ru, en });
export const UZS = (s: string) => parseAmount(s);
const INCOME = UZS("6000000");

// ---------------------------------------------------------------- 1. Pay Yourself First

const pyf = payYourselfFirst(INCOME, 1500);

export const payYourselfFirstContent: StrategyContent = {
  slug: "pay-yourself-first",
  name: l("Avval o'zingizga to'lang", "Сначала заплати себе", "Pay Yourself First"),
  original: "Pay Yourself First",
  accent: "#0F8A60",
  complexity: 1,
  discipline: 2,
  flexibility: 2,
  purpose: l("Har bir daromaddan jamg'armani birinchi o'ringa qo'yish", "Откладывать сбережения с каждого дохода в первую очередь", "Make saving the first use of every income"),
  summary: l(
    "Pul tushishi bilan uning belgilangan qismi (masalan, 10–20%) jamg'armaga o'tkaziladi, qolgani bilan yashaysiz.",
    "Как только приходят деньги, фиксированная доля (например, 10–20%) уходит в сбережения, на остаток вы живёте.",
    "As soon as money arrives, a fixed share (say 10–20%) goes to savings, and you live on the rest.",
  ),
  benefits: [
    l("Jamg'arma «oy oxirida nima qolsa» emas, kafolatlangan bo'ladi", "Сбережения перестают зависеть от того, «что останется»", "Saving stops depending on whatever is left over"),
    l("Sozlash oson, avtomatlashtirilsa deyarli kuch talab qilmaydi", "Легко настроить; автоматизация почти не требует усилий", "Easy to set up and nearly effortless once automated"),
    l("Har bir daromadda takrorlanadi — odat tez shakllanadi", "Повторяется с каждым доходом — привычка формируется быстро", "Repeats with every income, so the habit forms quickly"),
  ],
  drawbacks: [
    l("Xarajatlarni o'z-o'zidan nazorat qilmaydi — qolgan pulni ham rejalash kerak", "Сам по себе не контролирует расходы — остаток тоже надо планировать", "Doesn't control spending by itself — the remainder still needs a plan"),
    l("Daromad juda kam yoki qarzlar qimmat bo'lsa, foiz juda past bo'lishi mumkin", "При очень низком доходе или дорогих долгах доля может быть совсем маленькой", "With very low income or costly debt, the share may have to be tiny"),
  ],
  origin: {
    certainty: "popularized",
    label: l("Jorj S. Kleyson g'oyasi bilan bog'liq (1920-yillar)", "Связано с идеями Джорджа С. Клейсона (1920-е)", "Associated with George S. Clason (1920s)"),
    history: l(
      "G'oya ko'pincha Jorj S. Kleysonning «Bobilning eng boy odami» asari bilan bog'lanadi. Kitob 1920-yillarda banklar tarqatgan risolalar asosida 1926-yilda nashr etilgan va «topganingizning bir qismi sizda qolishi kerak — kamida o'ndan biri» degan qoidani targ'ib qiladi. «Pay yourself first» iborasining birinchi marta kim tomonidan qo'llangani aniq emas; u keyingi moliyaviy adabiyotda keng tarqalgan.",
      "Идею часто связывают с книгой Джорджа С. Клейсона «Самый богатый человек в Вавилоне». Она вышла в 1926 году на основе брошюр, которые в 1920-х распространяли банки, и продвигает правило: «часть заработанного должна оставаться у тебя — не меньше десятой». Кто первым употребил выражение «pay yourself first», точно неизвестно; позже оно широко распространилось в финансовой литературе.",
      "The idea is usually linked to George S. Clason's The Richest Man in Babylon, published as a book in 1926 from pamphlets banks distributed in the 1920s. It teaches that a part of all you earn is yours to keep — at least one tenth. Who first used the exact phrase “pay yourself first” is not known; it spread widely through later personal-finance writing.",
    ),
    advocates: l(
      "Devid Bax «The Automatic Millionaire» (2004) kitobida bu g'oyani avtomatlashtirish orqali targ'ib qilgan. U muallif va targ'ibotchi — usul ixtirochisi emas.",
      "Дэвид Бах продвигал эту идею через автоматизацию в книге «The Automatic Millionaire» (2004). Он автор и популяризатор, а не изобретатель метода.",
      "David Bach promoted the idea through automation in The Automatic Millionaire (2004). He is a populariser and author, not the method's inventor.",
    ),
  },
  overview: l(
    "Odatda odamlar avval xarajat qiladi va oy oxirida qolganini jamg'aradi — ko'pincha esa hech narsa qolmaydi. Bu strategiya tartibni teskari qiladi: daromad tushishi bilan oldindan belgilangan ulush alohida jamg'arma hamyoni yoki maqsadga o'tkaziladi. Xarajatlar qolgan summaga moslashadi.",
    "Обычно люди сначала тратят и откладывают то, что осталось к концу месяца, — а остаётся часто ничего. Эта стратегия меняет порядок: как только приходит доход, заранее выбранная доля уходит в отдельный кошелёк или цель. Расходы подстраиваются под остаток.",
    "Most people spend first and save whatever is left at month end — often nothing. This strategy reverses the order: when income arrives, a pre-chosen share moves straight to a separate savings wallet or goal, and spending adapts to the remainder.",
  ),
  steps: [
    l("Jamg'arma ulushini tanlang: boshlash uchun 5–10%, imkon bo'lsa 15–20%.", "Выберите долю: для начала 5–10%, при возможности 15–20%.", "Pick a share: 5–10% to start, 15–20% when you can."),
    l("Har bir daromad tushganda shu ulushni darhol jamg'arma maqsadiga o'tkazing.", "С каждым поступлением сразу переводите эту долю в цель накоплений.", "Move that share to a savings goal the moment each income lands."),
    l("Qolgan summa — shu oyning haqiqiy xarajat byudjeti.", "Остаток — ваш реальный бюджет на месяц.", "The remainder is your real spending budget for the month."),
    l("Har 3–6 oyda ulushni oshirishni ko'rib chiqing, ayniqsa daromad oshganda.", "Каждые 3–6 месяцев пересматривайте долю, особенно при росте дохода.", "Review the share every 3–6 months, especially when income rises."),
  ],
  science: l(
    "Xulq-atvor iqtisodiyoti tadqiqotlari oldindan qabul qilingan avtomatik qarorlar jamg'armani oshirishini ko'rsatadi: Taler va Benartsining «Save More Tomorrow» dasturida ishtirokchilarning jamg'arish darajasi sezilarli o'sgan. Sabab — «hozir ko'proq istash» moyilligi va iroda kuchiga bog'liqlikni kamaytirish.",
    "Исследования поведенческой экономики показывают, что заранее принятые автоматические решения увеличивают сбережения: в программе «Save More Tomorrow» Талера и Бенартци норма сбережений участников заметно выросла. Причина — меньше зависимости от силы воли и склонности к немедленному потреблению.",
    "Behavioural-economics research shows that pre-committed, automatic decisions raise saving: in Thaler and Benartzi's Save More Tomorrow programme participants' saving rates rose substantially. It works by reducing reliance on willpower and present bias.",
  ),
  professions: [
    { key: "salaried", why: l("Maosh muntazam keladi — har oy bir xil kunda ulushni ajratish oson.", "Зарплата регулярна — долю легко откладывать в один и тот же день.", "Regular pay makes it easy to move the share on the same day each month.") },
    { key: "teacher", why: l("Barqaror, oldindan ma'lum daromad ulush usuliga juda mos.", "Стабильный, предсказуемый доход отлично подходит для долевого метода.", "Stable, predictable income suits a fixed share well.") },
    { key: "freelancer", why: l("Foiz har bir to'lovdan olinadi, shuning uchun summa o'zgaruvchan bo'lsa ham ishlaydi.", "Процент берётся с каждой оплаты, поэтому работает и при плавающих суммах.", "A percentage of each payment works even when amounts vary.") },
    { key: "it", why: l("Yuqoriroq daromadda kattaroq ulush ajratib, uzoq muddatli kapital to'plash mumkin.", "При более высоком доходе можно откладывать большую долю и копить капитал.", "Higher incomes can save a larger share and build long-term capital.") },
    { key: "university", why: l("Kichik summalardan boshlab, jamg'arish odatini erta shakllantiradi.", "Начиная с малых сумм, формирует привычку копить с юности.", "Starting with small amounts builds the saving habit early.") },
  ],
  situations: [
    l("Jamg'arish niyati bor, lekin oy oxirida pul qolmaydi", "Хочется копить, но к концу месяца ничего не остаётся", "You mean to save but nothing is left at month end"),
    l("Muntazam yoki foiz bilan hisoblanadigan daromad", "Регулярный доход или доход, с которого удобно брать процент", "Regular income, or income you can take a percentage of"),
  ],
  stages: ["16-20", "21-25", "26-35", "36-50", "51+"],
  stageNote: l("Har qanday yoshda ishlaydi; muhimi — ulushni daromad va majburiyatlarga moslash.", "Работает в любом возрасте; важно подобрать долю под доход и обязательства.", "Works at any age; what matters is matching the share to income and obligations."),
  example: {
    intro: l("Oylik daromad 6 000 000 so'm, jamg'arma ulushi 15%.", "Доход 6 000 000 сумов в месяц, доля сбережений 15%.", "Monthly income of 6,000,000 UZS with a 15% saving share."),
    rows: [
      { label: l("Daromad", "Доход", "Income"), amount: INCOME },
      { label: l("Darhol jamg'armaga (15%)", "Сразу в сбережения (15%)", "Straight to savings (15%)"), amount: pyf.save, emphasis: true },
      { label: l("Oy uchun xarajat byudjeti", "Бюджет расходов на месяц", "Spending budget for the month"), amount: pyf.spend },
    ],
    outro: l("12 oyda 10 800 000 so'm jamg'ariladi — foizlarsiz, faqat odat hisobiga.", "За 12 месяцев накопится 10 800 000 сумов — без процентов, только за счёт привычки.", "Over 12 months that is 10,800,000 UZS saved — before any returns, purely from the habit."),
  },
  implement: [
    { action: "tool", text: l("Kalkulyatorda ulushni tanlang va «Rejani faollashtirish» tugmasini bosing — SOQQA jamg'arma maqsadini yaratadi.", "Выберите долю в калькуляторе и нажмите «Активировать план» — SOQQA создаст цель накоплений.", "Choose the share in the calculator and press “Activate plan” — SOQQA creates the savings goal.") },
    { action: "goals", text: l("Har bir daromaddan keyin «Maqsadlar» bo'limida badal qo'shing; reja kartasi bu oy qancha ajratish kerakligini ko'rsatadi.", "После каждого дохода вносите взнос в разделе «Цели»; карточка плана покажет, сколько отложить в этом месяце.", "After each income add a contribution under Goals; the plan card shows how much this month calls for.") },
  ],
  references: [
    { title: "The Richest Man in Babylon", author: "George S. Clason", year: "1926", url: "https://en.wikipedia.org/wiki/The_Richest_Man_in_Babylon", supports: l("G'oyaning tarixiy manbai va «o'ndan bir» qoidasi", "Исторический источник идеи и правило «десятой части»", "Historical source of the idea and the one-tenth rule") },
    { title: "The Automatic Millionaire", author: "David Bach", year: "2004", supports: l("Usulni avtomatlashtirish orqali targ'ib qilish", "Популяризация метода через автоматизацию", "Popularisation of the method through automation") },
    { title: "Save More Tomorrow: Using Behavioral Economics to Increase Employee Saving", author: "R. H. Thaler, S. Benartzi — Journal of Political Economy 112(S1)", year: "2004", supports: l("Avtomatik, oldindan qabul qilingan jamg'arma qarorlarining samarasi", "Эффект автоматических, заранее принятых решений о сбережениях", "Effect of automatic, pre-committed saving decisions") },
  ],
};

// ---------------------------------------------------------------- 2. 50/30/20

const r503020 = splitByBps(INCOME, [5000, 3000, 2000]);

export const rule503020Content: StrategyContent = {
  slug: "rule-50-30-20",
  name: l("50/30/20 qoidasi", "Правило 50/30/20", "The 50/30/20 Rule"),
  original: "50/30/20 Rule",
  accent: "#2F69E8",
  complexity: 1,
  discipline: 1,
  flexibility: 3,
  purpose: l("Daromadni uchta oddiy ulushga bo'lish", "Делить доход на три простые доли", "Divide income into three simple shares"),
  summary: l(
    "Daromadning 50% zaruriy ehtiyojlarga, 30% xohishlarga, 20% jamg'arma va qarz to'lashga yo'naltiriladi.",
    "50% дохода — на необходимое, 30% — на желания, 20% — на сбережения и погашение долгов.",
    "50% of income goes to needs, 30% to wants and 20% to savings and debt repayment.",
  ),
  benefits: [
    l("Eslab qolish oson — har bir tiyinni kuzatish shart emas", "Легко запомнить — не нужно учитывать каждый сум", "Easy to remember — no need to track every coin"),
    l("Xohishlarga ham joy qoldiradi, shuning uchun uzoq davom ettiriladi", "Оставляет место желаниям, поэтому его легче соблюдать долго", "Leaves room for wants, so it's sustainable"),
  ],
  drawbacks: [
    l("Ijara yoki oila xarajatlari yuqori bo'lsa, 50% ehtiyojlarga yetmasligi mumkin", "При высокой аренде или семейных расходах 50% на необходимое может не хватить", "With high rent or family costs, 50% may not cover needs"),
    l("«Ehtiyoj» va «xohish» chegarasi sub'ektiv", "Граница между «нужным» и «желанием» субъективна", "The line between needs and wants is subjective"),
  ],
  origin: {
    certainty: "known",
    label: l("Elizabet Uorren va Ameliya Uorren Tyagi, 2005", "Элизабет Уоррен и Амелия Уоррен Тьяги, 2005", "Elizabeth Warren & Amelia Warren Tyagi, 2005"),
    history: l(
      "Qoidani huquqshunos va keyinchalik AQSh senatori Elizabet Uorren qizi Ameliya Uorren Tyagi bilan birga «All Your Worth: The Ultimate Lifetime Money Plan» (2005) kitobida taklif qilgan. Ular soliqdan keyingi daromadni asos qilib olgan va «majburiy xarajatlar»ni (uy-joy, kommunal, oziq-ovqat, majburiy to'lovlar) 50% atrofida ushlashni tavsiya qilgan.",
      "Правило предложили юрист, позже сенатор США Элизабет Уоррен и её дочь Амелия Уоррен Тьяги в книге «All Your Worth: The Ultimate Lifetime Money Plan» (2005). Основой служит доход после налогов, а «обязательные траты» (жильё, коммуналка, продукты, обязательные платежи) советуют держать около 50%.",
      "Law professor (later U.S. Senator) Elizabeth Warren and her daughter Amelia Warren Tyagi proposed the rule in All Your Worth: The Ultimate Lifetime Money Plan (2005). It is based on after-tax income and recommends keeping “must-haves” — housing, utilities, groceries, required payments — around 50%.",
    ),
    advocates: l(
      "Bugungi kunda moliyaviy savodxonlik manbalari va ko'plab ilovalar bu qoidani boshlang'ich yo'riqnoma sifatida keltiradi.",
      "Сегодня его приводят как стартовый ориентир многие источники по финансовой грамотности и приложения.",
      "Today many financial-education resources and apps cite it as a starting guideline.",
    ),
  },
  overview: l(
    "Bu batafsil byudjet emas, balki nisbatlar tizimi. Har oy daromad uch qismga bo'linadi va siz faqat har bir qism chegarasidan chiqmaslikni kuzatasiz. Foizlar qat'iy emas: hayot qimmat shaharlarda yoki daromad kam bo'lsa, masalan 60/20/20 yoki 70/20/10 nisbatlari realroq bo'lishi mumkin.",
    "Это не подробный бюджет, а система пропорций. Каждый месяц доход делится на три части, и вы следите лишь за тем, чтобы не выйти за пределы каждой. Проценты не догма: в дорогих городах или при небольшом доходе реалистичнее, например, 60/20/20 или 70/20/10.",
    "This is a ratio system rather than a detailed budget. Each month income is split three ways and you only watch that each part stays within its limit. The percentages aren't fixed: in expensive cities or on a lower income, 60/20/20 or 70/20/10 can be more realistic.",
  ),
  steps: [
    l("Oylik sof daromadingizni aniqlang (soliqdan keyin).", "Определите чистый месячный доход (после налогов).", "Work out your monthly take-home income."),
    l("Kategoriyalarni «ehtiyoj» va «xohish» guruhlariga ajrating.", "Разделите категории на «необходимое» и «желания».", "Label each spending category as a need or a want."),
    l("Oy davomida har bir guruh ulushini kuzating va 20% ni oy boshida ajrating.", "Следите за долями в течение месяца, а 20% откладывайте в начале.", "Track each share during the month and set aside the 20% at the start."),
    l("Kerak bo'lsa, foizlarni hayotingizga moslang va natijani har oy solishtiring.", "При необходимости подстройте проценты и сравнивайте результат каждый месяц.", "Adjust the percentages to your life and compare the result monthly."),
  ],
  science: l(
    "Oddiy qoidalar qaror charchog'ini kamaytiradi: odam uchta raqamni eslab qolishi har bir xarajatni rejalashtirishdan osonroq. Bu «aqliy hisob» (mental accounting) g'oyasiga yaqin — pulni maqsadlar bo'yicha guruhlash xarajatlarni ongliroq qiladi.",
    "Простые правила снижают усталость от решений: три числа запомнить легче, чем планировать каждую трату. Это близко к идее «ментального учёта» — группировка денег по целям делает траты осознаннее.",
    "Simple rules reduce decision fatigue: three numbers are easier to hold than a line-by-line plan. It draws on mental accounting — grouping money by purpose makes spending more deliberate.",
  ),
  professions: [
    { key: "salaried", why: l("Barqaror maoshni har oy bir xil nisbatlarda taqsimlash qulay.", "Стабильную зарплату удобно каждый месяц делить в одних и тех же пропорциях.", "A steady salary splits neatly into the same ratios every month.") },
    { key: "university", why: l("Birinchi mustaqil byudjet uchun eng oson boshlanish.", "Самый простой старт для первого самостоятельного бюджета.", "The easiest start for a first independent budget.") },
    { key: "it", why: l("Daromad yuqori bo'lsa, 20% jamg'arma ulushini oshirish oson.", "При высоком доходе легко увеличить долю сбережений сверх 20%.", "With higher pay it's easy to push savings above 20%.") },
    { key: "family", why: l("Oila a'zolariga tushuntirish oson bo'lgan umumiy ramka beradi.", "Даёт простую рамку, которую легко объяснить всей семье.", "Gives a simple frame the whole household can understand.") },
  ],
  situations: [
    l("Batafsil byudjet tuzishga vaqt yoki xohish yo'q", "Нет времени или желания на подробный бюджет", "No time or appetite for a detailed budget"),
    l("Muvozanatni topmoqchi: jamg'arma va hayotdan zavq", "Нужен баланс между сбережениями и удовольствием от жизни", "Looking for balance between saving and enjoying life"),
  ],
  stages: ["16-20", "21-25", "26-35", "36-50"],
  stageNote: l("Ko'pincha birinchi ish yillarida qulay; oila xarajatlari ko'p bo'lsa, foizlarni moslang.", "Особенно удобно в первые годы работы; при больших семейных расходах подстройте проценты.", "Especially handy in early working years; adjust the ratios when family costs are high."),
  example: {
    intro: l("Oylik sof daromad 6 000 000 so'm.", "Чистый доход 6 000 000 сумов в месяц.", "Monthly take-home income of 6,000,000 UZS."),
    rows: [
      { label: l("Ehtiyojlar (50%) — ijara, oziq-ovqat, kommunal, transport", "Необходимое (50%) — аренда, продукты, коммуналка, транспорт", "Needs (50%) — rent, groceries, utilities, transport"), amount: r503020[0] },
      { label: l("Xohishlar (30%) — kafe, ko'ngilochar, xaridlar", "Желания (30%) — кафе, развлечения, покупки", "Wants (30%) — cafés, entertainment, shopping"), amount: r503020[1] },
      { label: l("Jamg'arma va qarz to'lash (20%)", "Сбережения и долги (20%)", "Savings & debt (20%)"), amount: r503020[2], emphasis: true },
    ],
    outro: l("Agar ijaraning o'zi 2 500 000 so'm bo'lsa, 60/20/20 nisbatini sinab ko'ring.", "Если одна аренда стоит 2 500 000 сумов, попробуйте пропорцию 60/20/20.", "If rent alone is 2,500,000 UZS, try 60/20/20 instead."),
  },
  implement: [
    { action: "tool", text: l("Kalkulyatorda daromad va foizlarni kiriting — SOQQA o'tgan oydagi haqiqiy taqsimotingiz bilan solishtiradi.", "Введите доход и проценты в калькуляторе — SOQQA сравнит их с вашим реальным распределением за прошлый месяц.", "Enter income and percentages in the calculator — SOQQA compares them with your actual split last month.") },
    { action: "categories", text: l("Sozlamalar → Kategoriyalar bo'limida har bir xarajat kategoriyasini «ehtiyoj» yoki «xohish» deb belgilang.", "В Настройки → Категории отметьте каждую категорию расходов как «необходимое» или «желание».", "In Settings → Categories, mark each expense category as a need or a want.") },
    { action: "analytics", text: l("«Tahlil» sahifasidagi 50/30/20 kartasida natijani har oy kuzating.", "Следите за результатом на карточке 50/30/20 в разделе «Аналитика».", "Track the result each month on the 50/30/20 card in Analytics.") },
  ],
  references: [
    { title: "All Your Worth: The Ultimate Lifetime Money Plan", author: "Elizabeth Warren, Amelia Warren Tyagi", year: "2005", supports: l("Qoidaning asl manbai va foizlar mazmuni", "Первоисточник правила и смысл долей", "Original source of the rule and the meaning of each share") },
    { title: "Mental Accounting Matters", author: "Richard H. Thaler — Journal of Behavioral Decision Making 12(3)", year: "1999", supports: l("Pulni guruhlab hisoblash xulq-atvorga ta'siri", "Влияние группировки денег на поведение", "How grouping money changes behaviour") },
  ],
};

// ---------------------------------------------------------------- 3. Zero-based

const zbItems = [
  ["Ijara", "Аренда", "Rent", "1800000"],
  ["Oziq-ovqat", "Продукты", "Groceries", "1200000"],
  ["Transport", "Транспорт", "Transport", "400000"],
  ["Kommunal va aloqa", "Коммуналка и связь", "Utilities & phone", "450000"],
  ["Jamg'arma", "Сбережения", "Savings", "900000"],
  ["Ko'ngilochar va kafe", "Развлечения и кафе", "Fun & cafés", "500000"],
  ["Kiyim va boshqalar", "Одежда и прочее", "Clothes & other", "750000"],
] as const;
const zbAmounts = zbItems.map((x) => UZS(x[3]));

export const zeroBasedContent: StrategyContent = {
  slug: "zero-based",
  name: l("Nol asosidagi byudjetlashtirish", "Бюджет с нуля", "Zero-Based Budgeting"),
  original: "Zero-Based Budgeting",
  accent: "#4A3BC4",
  complexity: 3,
  discipline: 3,
  flexibility: 1,
  purpose: l("Har bir so'mga oldindan vazifa berish", "Дать задачу каждому суму заранее", "Give every unit of income a job in advance"),
  summary: l(
    "Kutilayotgan daromad to'liq taqsimlanadi: daromad minus barcha rejalar nolga teng bo'lguncha har bir so'm biror maqsadga biriktiriladi.",
    "Ожидаемый доход распределяется полностью: каждый сум получает назначение, пока «доход минус планы» не станет равен нулю.",
    "Expected income is fully assigned: every unit gets a purpose until income minus planned allocations equals zero.",
  ),
  benefits: [
    l("Pul qayerga ketishini to'liq nazorat qilasiz", "Полный контроль над тем, куда уходят деньги", "Complete control over where money goes"),
    l("«Bilinmay sarflangan» pul deyarli qolmaydi", "Почти не остаётся «незаметно потраченных» денег", "Almost no money disappears unnoticed"),
    l("Har oy ustuvorliklarni qayta ko'rib chiqishga majbur qiladi", "Каждый месяц заставляет пересматривать приоритеты", "Forces a monthly rethink of priorities"),
  ],
  drawbacks: [
    l("Vaqt va intizom talab qiladi — har oy qayta rejalash kerak", "Требует времени и дисциплины — планировать заново каждый месяц", "Takes time and discipline — you re-plan every month"),
    l("Daromad noaniq bo'lsa, rejani tez-tez o'zgartirishga to'g'ri keladi", "При нестабильном доходе план придётся часто менять", "Irregular income means frequent re-planning"),
  ],
  origin: {
    certainty: "known",
    label: l("Piter Pirr, Texas Instruments, 1969–1970", "Питер Пирр, Texas Instruments, 1969–1970", "Peter Pyhrr, Texas Instruments, 1969–1970"),
    history: l(
      "Usulni Texas Instruments kompaniyasi menejeri Piter Pirr ishlab chiqqan; kompaniya uni 1970-yilgi byudjetida qo'llagan. Pirr 1970-yilda Harvard Business Review jurnalida «Zero-base Budgeting» maqolasini e'lon qildi. Maqola Jorjiya gubernatori Jimmi Karter e'tiborini tortdi va usul shtat hukumatida, keyinroq AQSh federal hukumatida qo'llandi. Asli bu korporativ va davlat byudjetlash usuli.",
      "Метод разработал менеджер Texas Instruments Питер Пирр; компания применила его в бюджете на 1970 год. В 1970 году Пирр опубликовал статью «Zero-base Budgeting» в Harvard Business Review. Она привлекла внимание губернатора Джорджии Джимми Картера, и метод применили в правительстве штата, а затем и в федеральном правительстве США. Изначально это корпоративный и государственный метод.",
      "Peter Pyhrr, a manager at Texas Instruments, developed the method; TI used it for its 1970 budget. Pyhrr published “Zero-base Budgeting” in the Harvard Business Review in 1970. The article caught the attention of Georgia governor Jimmy Carter, and the approach was adopted by the state government and later the U.S. federal government. It began as a corporate and public-sector method.",
    ),
    advocates: l(
      "Shaxsiy moliyada «har bir dollarga ish bering» g'oyasini YNAB (You Need A Budget) ilovasi va Deyv Ramsi targ'ib qiladi. Ular usulni uy byudjetiga moslashtirgan targ'ibotchilar, ixtirochilar emas.",
      "В личных финансах идею «дай работу каждому доллару» продвигают приложение YNAB (You Need A Budget) и Дэйв Рэмси. Это популяризаторы, адаптировавшие метод для семейного бюджета, а не его авторы.",
      "In personal finance the “give every dollar a job” idea is promoted by the YNAB (You Need A Budget) app and Dave Ramsey — popularisers who adapted the method to household budgets, not its inventors.",
    ),
  },
  overview: l(
    "Har oy byudjet «noldan» tuziladi: o'tgan oy xarajatlari avtomatik takrorlanmaydi, har bir summa qaytadan asoslanadi. Daromad to'liq taqsimlanadi — jamg'arma ham, kutilmagan xarajatlar zaxirasi ham alohida qator sifatida rejaga kiradi. Natijada «taqsimlanmagan» pul nol bo'ladi.",
    "Каждый месяц бюджет составляется «с нуля»: траты прошлого месяца не повторяются автоматически, каждая сумма обосновывается заново. Доход распределяется полностью — сбережения и резерв на непредвиденное тоже входят в план отдельными строками. В итоге «нераспределённых» денег ноль.",
    "Each month the budget is built from zero: last month's spending isn't copied forward; every amount is justified again. Income is fully allocated — savings and a buffer for surprises are lines in the plan too — so unassigned money is zero.",
  ),
  steps: [
    l("Oylik kutilayotgan daromadni yozing (faqat aniq tushadigan summa).", "Запишите ожидаемый доход за месяц (только надёжные поступления).", "Write down the month's expected income (only money you're sure of)."),
    l("Majburiy xarajatlardan boshlab har bir kategoriyaga summa ajrating.", "Распределите суммы по категориям, начиная с обязательных.", "Assign amounts to categories, starting with essentials."),
    l("Jamg'arma va kutilmagan xarajatlar uchun ham qator qo'shing.", "Добавьте строки для сбережений и непредвиденных расходов.", "Add lines for savings and unexpected costs."),
    l("Qoldiq nolga tenglashguncha davom eting; oy davomida rejani kuzating.", "Продолжайте, пока остаток не станет нулём; следите за планом в течение месяца.", "Continue until the remainder is zero, then follow the plan through the month."),
  ],
  science: l(
    "Har bir summani asoslash «odat bo'yicha» xarajatlarni aniqlashga yordam beradi. Pulni maqsadlarga oldindan biriktirish (earmarking) tadqiqotlarda ongli xarajatni kuchaytirishi ko'rsatilgan.",
    "Обоснование каждой суммы помогает выявить траты «по привычке». Исследования показывают, что заранее закреплённые за целями деньги (earmarking) тратятся осознаннее.",
    "Justifying every amount exposes habitual spending, and research on earmarking shows money assigned to a purpose in advance is spent more deliberately.",
  ),
  professions: [
    { key: "salaried", why: l("Daromad oldindan ma'lum bo'lsa, har oyni aniq rejalash mumkin.", "Когда доход известен заранее, каждый месяц можно точно спланировать.", "When income is known in advance, each month can be planned precisely.") },
    { key: "family", why: l("Ko'p xarajatli oilada hech bir majburiyat unutilmaydi.", "В семье с множеством расходов ни одно обязательство не забывается.", "In a household with many costs, no obligation gets forgotten.") },
    { key: "it", why: l("Yuqori daromadda «pul qayerga ketdi?» savoliga aniq javob beradi.", "При высоком доходе даёт точный ответ на вопрос «куда ушли деньги?».", "On a high income it answers “where did it all go?” precisely.") },
    { key: "teacher", why: l("Barqaror maosh va aniq xarajatlar — batafsil reja uchun yaxshi asos.", "Стабильная зарплата и понятные траты — хорошая база для детального плана.", "Steady pay and clear costs make a good base for a detailed plan.") },
  ],
  situations: [
    l("Batafsil nazoratni yoqtirasiz va har oy rejaga 30–60 daqiqa ajrata olasiz", "Вам нравится детальный контроль и есть 30–60 минут в месяц на план", "You like detailed control and can spare 30–60 minutes a month"),
    l("Pul «qayerga ketgani» noma'lum", "Непонятно, куда уходят деньги", "You can't tell where the money goes"),
  ],
  stages: ["21-25", "26-35", "36-50", "51+"],
  stageNote: l("Daromad va xarajatlar barqarorlashgan davrda eng samarali.", "Эффективнее всего, когда доход и расходы стабильны.", "Most effective once income and costs are stable."),
  example: {
    intro: l("Daromad 6 000 000 so'm — har bir so'mga vazifa beriladi.", "Доход 6 000 000 сумов — каждый сум получает задачу.", "Income of 6,000,000 UZS — every unit gets a job."),
    rows: [
      ...zbItems.map((x, i) => ({ label: l(x[0], x[1], x[2]), amount: zbAmounts[i] })),
      { label: l("Taqsimlanmagan qoldiq", "Нераспределённый остаток", "Left unassigned"), amount: zeroBasedRemainder(INCOME, zbAmounts), emphasis: true },
    ],
    outro: l(`Jami rejalashtirilgan: ${sum(zbAmounts) === INCOME ? "daromadga teng" : "farq bor"} — qoldiq nol.`, `Всего запланировано: ${sum(zbAmounts) === INCOME ? "ровно доход" : "есть расхождение"} — остаток ноль.`, `Total planned: ${sum(zbAmounts) === INCOME ? "exactly the income" : "mismatch"} — remainder zero.`),
  },
  implement: [
    { action: "tool", text: l("Rejalashtiruvchida daromadni kategoriyalarga taqsimlang, qoldiq nolga yetganda «Byudjet sifatida saqlash»ni bosing — har bir kategoriya uchun oylik limit yaratiladi yoki yangilanadi.", "Распределите доход по категориям в планировщике и, когда остаток станет нулём, нажмите «Сохранить как бюджет» — для каждой категории создастся или обновится месячный лимит.", "Allocate income to categories in the planner; when the remainder hits zero, press “Save as budgets” — a monthly limit is created or updated per category.") },
    { action: "goals", text: l("Jamg'arma qatorini maqsadga yo'naltiring va har oy badal qo'shing.", "Направьте строку сбережений в цель и вносите взносы каждый месяц.", "Point the savings line at a goal and contribute monthly.") },
    { action: "budgets", text: l("Oy davomida «Byudjet» sahifasida sur'atni kuzating.", "Следите за темпом в течение месяца на странице «Бюджет».", "Watch your pace through the month on the Budgets page.") },
  ],
  references: [
    { title: "Zero-base Budgeting", author: "Peter A. Pyhrr — Harvard Business Review, Nov–Dec 1970, pp. 111–121", year: "1970", url: "https://en.wikipedia.org/wiki/Peter_Pyhrr", supports: l("Usulning muallifi va Texas Instruments tajribasi", "Автор метода и опыт Texas Instruments", "The method's author and the Texas Instruments experience") },
    { title: "Zero-Base Budgeting: A Practical Management Tool for Evaluating Expenses", author: "Peter A. Pyhrr (Wiley)", year: "1973", supports: l("Usulning batafsil tavsifi", "Подробное описание метода", "Detailed description of the method") },
  ],
};

// ---------------------------------------------------------------- 4. Envelopes

const envSpending = UZS("2400000");
const env = splitByBps(envSpending, [5000, 2000, 1500, 1500]);

export const envelopesContent: StrategyContent = {
  slug: "envelopes",
  name: l("Konvertlar usuli", "Метод конвертов", "Envelope Budgeting"),
  original: "Envelope System",
  accent: "#C9921F",
  complexity: 2,
  discipline: 2,
  flexibility: 2,
  purpose: l("Har bir xarajat turiga cheklangan «konvert» ajratish", "Выделять ограниченный «конверт» на каждый вид трат", "Give each spending type a limited “envelope”"),
  summary: l(
    "Har bir kategoriya uchun aniq summa ajratiladi; konvert bo'shasa — shu oy bu kategoriyaga boshqa xarajat yo'q.",
    "Каждой категории выделяется точная сумма; конверт пуст — в этом месяце тратить на неё больше нельзя.",
    "Each category gets a fixed amount; when the envelope is empty, that category is done for the month.",
  ),
  benefits: [
    l("Ortiqcha xarajatni ko'rinarli va qiyinroq qiladi", "Делает перерасход заметным и затруднительным", "Makes overspending visible and harder"),
    l("Naqd va karta xarajatlariga birdek moslashadi", "Подходит и для наличных, и для карт", "Works for both cash and card spending"),
  ],
  drawbacks: [
    l("Naqd konvertlar yo'qolishi yoki o'g'irlanishi mumkin", "Наличные конверты можно потерять или украсть", "Cash envelopes can be lost or stolen"),
    l("Konvertlar orasida pul ko'chirish odati intizomni buzishi mumkin", "Привычка перекладывать деньги между конвертами разрушает дисциплину", "Shuffling money between envelopes can erode discipline"),
  ],
  origin: {
    certainty: "uncertain",
    label: l("Aniq ixtirochisi yo'q — xalq amaliyoti", "Единого автора нет — народная практика", "No single inventor — household practice"),
    history: l(
      "Maoshni naqd olib, uni turli ehtiyojlar uchun alohida konvert yoki qutilarga bo'lish ko'plab mamlakatlarda o'nlab yillar davomida oddiy oilaviy amaliyot bo'lgan; uning aniq paydo bo'lgan joyi va sanasi ma'lum emas. Zamonaviy shaxsiy moliyada usulni ayniqsa Deyv Ramsi «The Total Money Makeover» (2003) kitobi orqali ommalashtirgan.",
      "Получать зарплату наличными и раскладывать её по конвертам или коробкам для разных нужд — обычная семейная практика во многих странах на протяжении десятилетий; точное место и время её появления неизвестны. В современных личных финансах метод особенно популяризировал Дэйв Рэмси в книге «The Total Money Makeover» (2003).",
      "Taking wages in cash and dividing them into envelopes or tins for different needs was ordinary household practice in many countries for decades; where and when it began is not known. In modern personal finance it was popularised notably by Dave Ramsey's The Total Money Makeover (2003).",
    ),
    advocates: l(
      "Bugun «virtual konvert» ilovalari (masalan, Goodbudget) usulni raqamli shaklga keltirgan. Deyv Ramsi uni targ'ib qiladi — ixtirochi emas.",
      "Сегодня приложения с «виртуальными конвертами» (например, Goodbudget) перенесли метод в цифровой вид. Дэйв Рэмси — популяризатор, а не изобретатель.",
      "Today “virtual envelope” apps such as Goodbudget have taken the method digital. Dave Ramsey promotes it; he did not invent it.",
    ),
  },
  overview: l(
    "Avval majburiy to'lovlar (ijara, kredit, kommunal) ajratiladi, so'ng kundalik xarajatlar uchun konvertlar belgilanadi: oziq-ovqat, transport, kafe va hokazo. Har bir konvertdagi qoldiq — shu kategoriyada qancha sarflash mumkinligining aniq javobi. Raqamli versiyada konvert — bu kategoriya limiti va undan qolgan summa.",
    "Сначала выделяются обязательные платежи (аренда, кредит, коммуналка), затем конверты для повседневных трат: продукты, транспорт, кафе и т. д. Остаток в конверте — точный ответ, сколько ещё можно потратить в этой категории. В цифровом варианте конверт — это лимит категории и его остаток.",
    "Fixed bills (rent, loans, utilities) come first, then envelopes for day-to-day spending: groceries, transport, cafés and so on. The balance in each envelope tells you exactly how much is left for that category. Digitally, an envelope is a category limit and what remains of it.",
  ),
  steps: [
    l("Majburiy to'lovlardan keyin qolgan «kundalik» summani aniqlang.", "Определите «повседневную» сумму после обязательных платежей.", "Work out the day-to-day money left after fixed bills."),
    l("Uni 3–6 ta konvertga bo'ling — eng ko'p pul ketadigan kategoriyalarga.", "Разделите её на 3–6 конвертов — по самым затратным категориям.", "Split it into 3–6 envelopes for your biggest categories."),
    l("Har bir xarajatni tegishli konvertdan yozing va qoldiqni kuzating.", "Записывайте каждую трату в нужный конверт и следите за остатком.", "Record each purchase against its envelope and watch the balance."),
    l("Oy oxirida ortib qolgan pulni jamg'armaga o'tkazing.", "В конце месяца переводите остатки в сбережения.", "Move leftovers to savings at month end."),
  ],
  science: l(
    "Hindistonda o'tkazilgan dala tajribasida (Soman va Chima, 2011) kam ta'minlangan ishchilar ish haqining bir qismini alohida konvertlarga ajratganda ko'proq jamg'argan. Bu «pulni maqsadga biriktirish va bo'lish» effekti deb ataladi.",
    "В полевом эксперименте в Индии (Соман и Чима, 2011) низкооплачиваемые работники, раскладывавшие часть зарплаты в отдельные конверты, откладывали больше. Это называют эффектом «закрепления и разделения» денег.",
    "In a field experiment in India (Soman & Cheema, 2011), low-income workers who split part of their wages into separate envelopes saved more — the “earmarking and partitioning” effect.",
  ),
  professions: [
    { key: "sales", why: l("Komissiya oydan-oyga o'zgaradi — konvertlar shu oy tushgan pul bilan cheklaydi.", "Комиссия меняется от месяца к месяцу — конверты ограничивают траты тем, что пришло.", "Commission varies monthly — envelopes cap spending at what actually came in.") },
    { key: "family", why: l("Oila a'zolari uchun «oziq-ovqatga shuncha qoldi» degan aniq chegara beradi.", "Даёт семье понятную границу: «на продукты осталось столько».", "Gives the household a clear line: “this much left for groceries”.") },
    { key: "student", why: l("Stipendiya yoki cho'ntak pulini oy oxirigacha yetkazishga yordam beradi.", "Помогает растянуть стипендию или карманные деньги до конца месяца.", "Helps a stipend or allowance last to month end.") },
    { key: "retiree", why: l("Pensiya kabi belgilangan daromadni aniq bo'laklarga taqsimlaydi.", "Разбивает фиксированный доход, например пенсию, на понятные части.", "Breaks a fixed income such as a pension into clear portions.") },
  ],
  situations: [
    l("Naqd pul bilan ko'p xarajat qilasiz", "Много тратите наличными", "You spend a lot in cash"),
    l("Ma'lum kategoriyada (kafe, xaridlar) doim ortiqcha ketadi", "В отдельных категориях (кафе, покупки) постоянно перерасход", "Particular categories (cafés, shopping) always run over"),
  ],
  stages: ["16-20", "21-25", "26-35", "36-50", "51+"],
  stageNote: l("Har qanday yoshda tushunarli; ayniqsa naqd pul ko'p ishlatiladigan oilalar uchun qulay.", "Понятен в любом возрасте; особенно удобен семьям, где много наличных.", "Intuitive at any age; especially handy for cash-heavy households."),
  example: {
    intro: l("Daromad 6 000 000 so'm; majburiy to'lovlardan keyin kundalik xarajatlarga 2 400 000 so'm qoladi.", "Доход 6 000 000 сумов; после обязательных платежей на повседневные траты остаётся 2 400 000 сумов.", "Income of 6,000,000 UZS; after fixed bills, 2,400,000 UZS remains for daily spending."),
    rows: [
      { label: l("Oziq-ovqat konverti (50%)", "Конверт «Продукты» (50%)", "Groceries envelope (50%)"), amount: env[0] },
      { label: l("Transport konverti (20%)", "Конверт «Транспорт» (20%)", "Transport envelope (20%)"), amount: env[1] },
      { label: l("Kafe va ko'ngilochar (15%)", "Кафе и развлечения (15%)", "Cafés & fun (15%)"), amount: env[2] },
      { label: l("Shaxsiy va kutilmagan (15%)", "Личное и непредвиденное (15%)", "Personal & unexpected (15%)"), amount: env[3] },
    ],
    outro: l("Kafe konvertida 360 000 so'm bo'lsa va 300 000 sarflangan bo'lsa — oy oxirigacha 60 000 qoldi.", "Если в конверте «Кафе» 360 000 и потрачено 300 000 — до конца месяца осталось 60 000.", "If the cafés envelope holds 360,000 and 300,000 is spent, 60,000 is left for the month."),
  },
  implement: [
    { action: "tool", text: l("Konvertlar rejalashtiruvchisida kategoriyalarga limit qo'ying va saqlang — har bir konvert SOQQA'da byudjet limitiga aylanadi va qoldig'i haqiqiy xarajatlardan hisoblanadi.", "Задайте лимиты категориям в планировщике конвертов и сохраните — каждый конверт станет лимитом бюджета, а остаток будет считаться по реальным тратам.", "Set category limits in the envelope planner and save — each envelope becomes a budget limit, with its balance computed from real spending.") },
    { action: "wallets", text: l("Naqd va karta pulini alohida hamyonlarda yuriting — konvertlar ikkalasidagi xarajatni ham hisobga oladi.", "Ведите наличные и карту в отдельных кошельках — конверты учитывают траты из обоих.", "Keep cash and card in separate wallets — envelopes count spending from both.") },
  ],
  references: [
    { title: "The Total Money Makeover", author: "Dave Ramsey", year: "2003", supports: l("Usulning zamonaviy ommalashuvi", "Современная популяризация метода", "Modern popularisation of the method") },
    { title: "Earmarking and Partitioning: Increasing Saving by Low-Income Households", author: "Dilip Soman, Amar Cheema — Journal of Marketing Research 48", year: "2011", supports: l("Pulni konvertlarga bo'lish jamg'armani oshirishi", "Разделение денег по конвертам увеличивает сбережения", "Splitting money into envelopes increases saving") },
  ],
};

// ---------------------------------------------------------------- 5. Kakeibo

const kk = [UZS("3300000"), UZS("900000"), UZS("300000"), UZS("300000")];
const kkSave = INCOME - sum(kk);

export const kakeiboContent: StrategyContent = {
  slug: "kakeibo",
  name: l("Kakeibo — ongli xarajat daftari", "Какейбо — осознанный учёт", "Kakeibo"),
  original: "Kakeibo (家計簿)",
  accent: "#B42840",
  complexity: 2,
  discipline: 2,
  flexibility: 3,
  purpose: l("Xarajatlarni yozib, ular haqida mulohaza qilish", "Записывать траты и размышлять о них", "Write spending down and reflect on it"),
  summary: l(
    "Yaponcha uy xo'jaligi daftari: oy boshida va oxirida to'rtta savolga javob berib, xarajatlarni ongli boshqarish.",
    "Японская книга домашнего учёта: ответы на четыре вопроса в начале и конце месяца для осознанных трат.",
    "A Japanese household ledger: answer four questions at the start and end of each month to spend mindfully.",
  ),
  benefits: [
    l("Xarajat odatlarini ongli qiladi — faqat raqam emas, sabab ham ko'rinadi", "Делает привычки осознанными — видны не только цифры, но и причины", "Builds awareness — you see reasons, not just numbers"),
    l("Qat'iy foizlarsiz, yumshoq va moslashuvchan", "Без жёстких процентов, мягкий и гибкий", "Gentle and flexible, with no fixed percentages"),
  ],
  drawbacks: [
    l("Muntazam mulohaza qilish uchun vaqt kerak", "Нужно время на регулярные размышления", "Needs regular time for reflection"),
    l("Natija tez ko'rinmasligi mumkin — avtomatik jamg'arma yo'q", "Результат может проявиться не сразу — нет автоматических сбережений", "Results can be slow — there's no automatic saving"),
  ],
  origin: {
    certainty: "known",
    label: l("Hani Motoko, Yaponiya, 1904", "Хани Мотоко, Япония, 1904", "Hani Motoko, Japan, 1904"),
    history: l(
      "Kakeibo'ni Yaponiyaning birinchi ayol jurnalistlaridan biri sifatida tanilgan Hani Motoko 1904-yilda ayollar jurnalida e'lon qilgan. U uy bekalariga oilaviy byudjetni yuritishga yordam berish uchun mo'ljallangan. Hani asos solgan Fujin no Tomo nashriyoti kakeibo daftarini hozirgacha har yili chop etadi.",
      "Какейбо опубликовала в женском журнале в 1904 году Хани Мотоко, известная как одна из первых женщин-журналисток Японии. Книга предназначалась домохозяйкам для ведения семейного бюджета. Основанное ею издательство Fujin no Tomo выпускает какейбо ежегодно до сих пор.",
      "Hani Motoko, known as one of Japan's first women journalists, published the first kakeibo in a women's magazine in 1904 to help housewives run the household budget. The publisher she founded, Fujin no Tomo, still issues a kakeibo every year.",
    ),
    advocates: l(
      "G'arbda usul Fumiko Chibaning «Kakeibo: The Japanese Art of Budgeting & Saving Money» (2017) kitobidan keyin keng tanildi. To'rt savol aynan zamonaviy qo'llanmalarda shunday ifodalanadi.",
      "На Западе метод стал известен после книги Фумико Тиба «Kakeibo: The Japanese Art of Budgeting & Saving Money» (2017). Четыре вопроса в таком виде формулируются в современных пособиях.",
      "In the West the method spread after Fumiko Chiba's Kakeibo: The Japanese Art of Budgeting & Saving Money (2017). The four questions are phrased this way in modern guides.",
    ),
  },
  overview: l(
    "Kakeibo hisobdan ko'ra mulohazaga tayanadi. Oy boshida to'rt savolga javob beriladi: Qancha pulim bor? Qancha jamg'armoqchiman? Qancha sarflayapman? Qanday yaxshilashim mumkin? Xarajatlar to'rt ustunga bo'linadi: yashash uchun zarur, ixtiyoriy, madaniyat va kutilmagan. Oy oxirida natija solishtiriladi va keyingi oy uchun bitta aniq yaxshilanish tanlanadi.",
    "Какейбо опирается на размышления больше, чем на подсчёт. В начале месяца отвечают на четыре вопроса: Сколько у меня денег? Сколько я хочу отложить? Сколько я трачу? Как я могу улучшить? Расходы делят на четыре столбца: необходимое, необязательное, культура и непредвиденное. В конце месяца сравнивают итог и выбирают одно конкретное улучшение на следующий месяц.",
    "Kakeibo leans on reflection more than arithmetic. At the start of the month you answer four questions: How much money do I have? How much would I like to save? How much am I spending? How can I improve? Spending falls into four columns — survival, optional, culture and extra. At month end you compare and choose one concrete improvement for next month.",
  ),
  steps: [
    l("Oy boshida daromad va jamg'arma maqsadini yozing.", "В начале месяца запишите доход и цель накоплений.", "At month start, write down income and a savings target."),
    l("Har bir xarajatni to'rt ustundan biriga yozing.", "Записывайте каждую трату в один из четырёх столбцов.", "Log each expense in one of the four columns."),
    l("Har hafta qisqa ko'rib chiqing: qaysi xarajat haqiqatan kerak edi?", "Раз в неделю коротко пересматривайте: какая трата была действительно нужна?", "Review weekly: which purchases were truly needed?"),
    l("Oy oxirida to'rtinchi savolga javob yozing va bitta o'zgarishni tanlang.", "В конце месяца ответьте на четвёртый вопрос и выберите одно изменение.", "At month end, answer the fourth question and pick one change."),
  ],
  science: l(
    "Xarajatni qo'lda yozish va uni baholash «og'riqli to'lov» hissini qaytaradi, bu karta va onlayn to'lovlarda yo'qoladi. Muntazam mulohaza (reflection) odatlarni o'zgartirishning keng qo'llaniladigan usuli.",
    "Ручная запись и оценка трат возвращает «боль оплаты», которая теряется при оплате картой и онлайн. Регулярная рефлексия — широко используемый способ менять привычки.",
    "Writing spending down and judging it brings back the “pain of paying” that card and online payments erase; regular reflection is a well-established way to change habits.",
  ),
  professions: [
    { key: "family", why: l("Asl maqsadi — oilaviy byudjet; oila bilan birga mulohaza qilish uchun qulay.", "Изначально создан для семейного бюджета; удобно обсуждать вместе с семьёй.", "Built for the household budget; easy to reflect on together.") },
    { key: "teacher", why: l("Mulohaza va rejalashtirishga moyil kasb egalari uchun tabiiy usul.", "Естественный метод для тех, кто привык к планированию и рефлексии.", "A natural fit for people used to planning and reflection.") },
    { key: "university", why: l("Pulga ongli munosabatni erta shakllantiradi.", "Рано формирует осознанное отношение к деньгам.", "Forms a mindful attitude to money early.") },
    { key: "retiree", why: l("Shoshilmasdan, oyma-oy mulohaza qilishga mos.", "Подходит для неспешной ежемесячной рефлексии.", "Suits unhurried month-by-month reflection.") },
  ],
  situations: [
    l("Impulsiv xaridlar ko'p, lekin qat'iy limitlar sizga yoqmaydi", "Много импульсивных покупок, но жёсткие лимиты не нравятся", "Lots of impulse buys, but you dislike strict limits"),
    l("Pulga munosabatni o'zgartirmoqchisiz", "Хотите изменить отношение к деньгам", "You want to change how you relate to money"),
  ],
  stages: ["16-20", "21-25", "26-35", "36-50", "51+"],
  stageNote: l("Yoshdan qat'i nazar, ongli xarajat qilishni o'rganmoqchi bo'lganlar uchun.", "Для всех, кто хочет научиться тратить осознанно, независимо от возраста.", "For anyone who wants to spend mindfully, regardless of age."),
  example: {
    intro: l("1-savol: daromad 6 000 000 so'm. 2-savol: maqsad — 1 200 000 so'm jamg'arish.", "Вопрос 1: доход 6 000 000 сумов. Вопрос 2: цель — отложить 1 200 000 сумов.", "Q1: income is 6,000,000 UZS. Q2: the goal is to save 1,200,000 UZS."),
    rows: [
      { label: l("Yashash uchun zarur (oziq-ovqat, ijara, transport)", "Необходимое (продукты, аренда, транспорт)", "Survival (food, rent, transport)"), amount: kk[0] },
      { label: l("Ixtiyoriy (kafe, xaridlar)", "Необязательное (кафе, покупки)", "Optional (cafés, shopping)"), amount: kk[1] },
      { label: l("Madaniyat (kitob, kurs, teatr)", "Культура (книги, курсы, театр)", "Culture (books, courses, theatre)"), amount: kk[2] },
      { label: l("Kutilmagan (sovg'a, ta'mir)", "Непредвиденное (подарки, ремонт)", "Extra (gifts, repairs)"), amount: kk[3] },
      { label: l("Natija: jamg'arildi", "Итог: отложено", "Result: saved"), amount: kkSave, emphasis: true },
    ],
    outro: l("4-savol: «Ixtiyoriy» ustunini keyingi oy 700 000 so'mgacha qisqartiraman.", "Вопрос 4: в следующем месяце сокращу «Необязательное» до 700 000 сумов.", "Q4: next month I'll cut “Optional” to 700,000 UZS."),
  },
  implement: [
    { action: "tool", text: l("Kakeibo varag'ida SOQQA birinchi va uchinchi savolga haqiqiy ma'lumotlaringizdan javob beradi; jamg'arma maqsadi va oylik mulohazangizni saqlaysiz.", "На листе какейбо SOQQA отвечает на первый и третий вопросы по вашим реальным данным; вы сохраняете цель накоплений и ежемесячную рефлексию.", "On the kakeibo sheet SOQQA answers questions one and three from your real records; you save your savings target and monthly reflection.") },
    { action: "categories", text: l("Kategoriyalarni «ehtiyoj»/«xohish» deb belgilang — kakeibo ustunlari shunga tayanadi.", "Отметьте категории как «необходимое»/«желание» — на этом строятся столбцы какейбо.", "Mark categories as needs or wants — the kakeibo columns build on that.") },
  ],
  references: [
    { title: "Kakeibo", author: "Wikipedia", year: "—", url: "https://en.wikipedia.org/wiki/Kakeibo", supports: l("Hani Motoko va 1904-yilgi birinchi nashr", "Хани Мотоко и первая публикация 1904 года", "Hani Motoko and the first 1904 publication") },
    { title: "Kakeibo: The Japanese Art of Budgeting & Saving Money", author: "Fumiko Chiba", year: "2017", supports: l("Usulning zamonaviy tavsifi va to'rt savol", "Современное описание метода и четыре вопроса", "Modern description of the method and the four questions") },
  ],
};
