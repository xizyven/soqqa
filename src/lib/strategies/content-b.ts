/** Strategy content, part 2 (strategies 6–10). See content-a.ts for the rules. */
import { simulatePayoff, type DebtInput } from "../domain/debt";
import { emergencyFund, raiseSplit, sinkingFund, splitByBps } from "./calc";
import { l, UZS } from "./content-a";
import type { StrategyContent } from "./types";

const INCOME = UZS("6000000");

// ---------------------------------------------------------------- 6. Profit First

const pf = splitByBps(INCOME, [500, 5000, 1500, 3000]);

export const profitFirstContent: StrategyContent = {
  slug: "profit-first",
  name: l("Avval foyda (Profit First)", "Сначала прибыль (Profit First)", "Profit First"),
  original: "Profit First",
  accent: "#071330",
  complexity: 3,
  discipline: 3,
  flexibility: 1,
  businessOnly: true,
  purpose: l("Biznes tushumidan foydani birinchi bo'lib ajratish", "Отделять прибыль от выручки бизнеса в первую очередь", "Take profit from business revenue first"),
  summary: l(
    "Biznesga tushgan har bir to'lov alohida hisoblarga bo'linadi: foyda, egasining maoshi, soliq va operatsion xarajatlar.",
    "Каждое поступление бизнеса распределяется по отдельным счетам: прибыль, зарплата владельца, налоги и операционные расходы.",
    "Every business deposit is split into separate accounts: profit, owner's pay, tax and operating expenses.",
  ),
  benefits: [
    l("Biznes har oy foyda keltirishini majburiy qiladi", "Заставляет бизнес приносить прибыль каждый месяц", "Forces the business to be profitable every month"),
    l("Soliq to'lovi kutilmagan zarba bo'lmaydi", "Налоги перестают быть неожиданным ударом", "Taxes stop being a nasty surprise"),
    l("Egasining shaxsiy daromadi biznes pulidan ajraladi", "Личный доход владельца отделяется от денег бизнеса", "Separates the owner's pay from business money"),
  ],
  drawbacks: [
    l("Asosan biznes uchun — oddiy oila byudjetiga to'g'ridan-to'g'ri mos emas", "Создан для бизнеса — для обычного семейного бюджета напрямую не подходит", "Built for businesses — not a direct fit for a household budget"),
    l("Bir nechta bank hisobi va qat'iy jadval talab qiladi", "Требует нескольких счетов и строгого графика", "Needs several bank accounts and a strict schedule"),
  ],
  origin: {
    certainty: "known",
    label: l("Mayk Mikalovich, 2014", "Майк Микаловиц, 2014", "Mike Michalowicz, 2014"),
    history: l(
      "Usulni amerikalik tadbirkor va muallif Mayk Mikalovich «Profit First» (2014; qayta ishlangan nashri 2017) kitobida taqdim etgan. Asosiy formula: Tushum − Foyda = Xarajatlar. U Parkinson qonuni (xarajatlar mavjud pulga qarab o'sadi) va «avval o'zingizga to'lang» g'oyasiga tayanadi.",
      "Метод представил американский предприниматель и автор Майк Микаловиц в книге «Profit First» (2014; переработанное издание 2017). Главная формула: Выручка − Прибыль = Расходы. Он опирается на закон Паркинсона (расходы растут вместе с доступными деньгами) и идею «сначала заплати себе».",
      "American entrepreneur and author Mike Michalowicz introduced the method in Profit First (2014; revised 2017). Its core formula is Sales − Profit = Expenses, building on Parkinson's law (spending expands to the money available) and on paying yourself first.",
    ),
    advocates: l(
      "Muallif tashkil etgan buxgalterlar tarmog'i usulni kichik bizneslarga joriy qiladi. Bu biznes metodologiyasi — uy byudjeti uchun mo'ljallanmagan.",
      "Сеть бухгалтеров, созданная автором, внедряет метод в малом бизнесе. Это бизнес-методология — не для семейного бюджета.",
      "A network of accountants set up around the book applies it to small businesses. It's a business methodology, not a household budget system.",
    ),
  },
  overview: l(
    "Barcha tushum avval «Daromad» hisobiga tushadi, so'ng muntazam (kitobda — oyiga ikki marta, 10- va 25-sanalarda) belgilangan foizlar bo'yicha taqsimlanadi: Foyda, Egasining maoshi, Soliq va Operatsion xarajatlar. Biznes faqat operatsion hisobdagi pul bilan ishlaydi. Foizlar (TAP — maqsadli ulushlar) biznes hajmiga qarab farq qiladi va ularga bosqichma-bosqich o'tiladi.",
    "Вся выручка сначала поступает на счёт «Доход», затем регулярно (в книге — дважды в месяц, 10-го и 25-го) распределяется по установленным процентам: Прибыль, Зарплата владельца, Налоги и Операционные расходы. Бизнес живёт только на деньги операционного счёта. Проценты (TAP — целевые доли) зависят от масштаба бизнеса, и к ним переходят постепенно.",
    "All revenue lands in an Income account, then on a regular rhythm (twice a month, on the 10th and 25th, in the book) it's split by set percentages into Profit, Owner's Pay, Tax and Operating Expenses. The business runs only on the operating account. The percentages (Target Allocation Percentages) depend on business size and are reached gradually.",
  ),
  steps: [
    l("Biznes uchun alohida hisoblar (yoki SOQQA'da alohida hamyonlar) oching.", "Откройте отдельные счета бизнеса (или отдельные кошельки в SOQQA).", "Open separate business accounts (or separate wallets in SOQQA)."),
    l("Hozirgi haqiqiy ulushlardan boshlang va har chorakda maqsadga yaqinlashing.", "Начните с текущих фактических долей и каждый квартал приближайтесь к целевым.", "Start from your current real shares and move toward the targets each quarter."),
    l("Har bir taqsimot kunida tushumni foizlar bo'yicha bo'ling.", "В каждый день распределения делите выручку по процентам.", "On each allocation day, split revenue by the percentages."),
    l("Foyda hisobidan har chorakda egaga ulush bering va qolganini zaxira qiling.", "Раз в квартал выплачивайте владельцу часть прибыли, остальное — в резерв.", "Each quarter, pay the owner part of the profit and keep the rest as a reserve."),
  ],
  science: l(
    "Parkinson qonuni (1955 va keyingi asarlar) ish va xarajatlar mavjud resursga qarab kengayishini ta'kidlaydi. Foydani oldindan ajratish operatsion pulni ataylab cheklab, samaradorlikka undaydi.",
    "Закон Паркинсона (1955 и более поздние работы) отмечает, что работа и расходы расширяются под имеющиеся ресурсы. Заранее отделённая прибыль намеренно ограничивает операционные деньги и стимулирует эффективность.",
    "Parkinson's law (1955 and later work) observes that work and spending expand to fill the resources available; taking profit first deliberately limits operating money and pushes efficiency.",
  ),
  professions: [
    { key: "small_business", why: l("Kafe, do'kon, xizmat ko'rsatish kabi bizneslar foydasini aniq ko'rish uchun yaratilgan.", "Создан, чтобы малый бизнес — кафе, магазин, сервис — ясно видел свою прибыль.", "Designed so small businesses — cafés, shops, services — can see their profit clearly.") },
    { key: "entrepreneur", why: l("Shaxsiy va biznes pulini aralashtirmaslikka yordam beradi.", "Помогает не смешивать личные и деловые деньги.", "Keeps personal and business money apart.") },
    { key: "freelancer", why: l("O'zini tadbirkor sifatida yuritadigan frilanserlar uchun soliq va maoshni ajratish qulay.", "Фрилансерам, работающим как предприниматели, удобно отделять налоги и зарплату.", "Freelancers who run as a business can separate tax and pay.") },
  ],
  situations: [
    l("Biznesingiz bor, lekin foyda qayerga ketishini ko'rmaysiz", "У вас бизнес, но непонятно, куда уходит прибыль", "You run a business but can't see where profit goes"),
    l("Soliq to'lovi har safar qiyinchilik tug'diradi", "Налоговые платежи каждый раз вызывают трудности", "Tax payments are always a struggle"),
  ],
  stages: ["21-25", "26-35", "36-50", "51+"],
  stageNote: l("Yosh emas, biznes egaligi muhim; oddiy maosh oluvchilar uchun «Avval o'zingizga to'lang» ko'proq mos.", "Важен не возраст, а наличие бизнеса; тем, кто получает зарплату, лучше подходит «Сначала заплати себе».", "Business ownership matters, not age; salaried people are better served by Pay Yourself First."),
  example: {
    intro: l("Kichik biznesning oylik tushumi 6 000 000 so'm; boshlang'ich ulushlar (kitobdagi kichik bizneslar uchun misol): 5/50/15/30.", "Месячная выручка малого бизнеса 6 000 000 сумов; стартовые доли (пример из книги для малого бизнеса): 5/50/15/30.", "A small business takes in 6,000,000 UZS a month; starting shares (the book's small-business example): 5/50/15/30."),
    rows: [
      { label: l("Foyda (5%)", "Прибыль (5%)", "Profit (5%)"), amount: pf[0], emphasis: true },
      { label: l("Egasining maoshi (50%)", "Зарплата владельца (50%)", "Owner's pay (50%)"), amount: pf[1] },
      { label: l("Soliq (15%)", "Налоги (15%)", "Tax (15%)"), amount: pf[2] },
      { label: l("Operatsion xarajatlar (30%)", "Операционные расходы (30%)", "Operating expenses (30%)"), amount: pf[3] },
    ],
    outro: l("Soliq ulushini O'zbekistondagi soliq rejimingizga (masalan, aylanmadan olinadigan soliq) qarab belgilang.", "Долю налогов задайте по вашему налоговому режиму в Узбекистане (например, налог с оборота).", "Set the tax share from your actual tax regime in Uzbekistan (for example, turnover tax)."),
  },
  implement: [
    { action: "tool", text: l("Kalkulyatorda tushum va ulushlarni kiriting; xohlasangiz SOQQA to'rtta virtual hamyon yaratadi (mavjudlari takrorlanmaydi).", "Введите выручку и доли в калькуляторе; при желании SOQQA создаст четыре виртуальных кошелька (существующие не дублируются).", "Enter revenue and shares in the calculator; SOQQA can create the four virtual wallets for you (existing ones aren't duplicated).") },
    { action: "wallets", text: l("Taqsimot kunlarida «Daromad» hamyonidan qolgan hamyonlarga o'tkazma qiling.", "В дни распределения переводите деньги из кошелька «Доход» в остальные.", "On allocation days, transfer from the Income wallet to the others.") },
  ],
  references: [
    { title: "Profit First: Transform Your Business from a Cash-Eating Monster to a Money-Making Machine", author: "Mike Michalowicz", year: "2014 (revised 2017)", supports: l("Usulning muallifi, formulasi va hisoblar tuzilmasi", "Автор метода, формула и структура счетов", "Author, formula and account structure") },
    { title: "Parkinson's Law", author: "C. Northcote Parkinson — The Economist", year: "1955", supports: l("Xarajatlar mavjud resursga qarab kengayishi", "Расходы расширяются под имеющиеся ресурсы", "Spending expands to fill available resources") },
  ],
};

// ---------------------------------------------------------------- 7. Sinking funds

const sfLaptop = sinkingFund(UZS("9000000"), 0n, "2026-01-01", "2027-01-01");
const sfTravel = sinkingFund(UZS("4800000"), 0n, "2026-01-01", "2026-09-01");
const sfCar = sinkingFund(UZS("1200000"), 0n, "2026-01-01", "2026-07-01");

export const sinkingFundsContent: StrategyContent = {
  slug: "sinking-funds",
  name: l("Maqsadli jamg'armalar", "Целевые накопления", "Sinking Funds"),
  original: "Sinking Funds",
  accent: "#0B7A5C",
  complexity: 1,
  discipline: 2,
  flexibility: 2,
  purpose: l("Ma'lum kelajak xarajatlari uchun oldindan bo'lib-bo'lib yig'ish", "Копить частями на известные будущие расходы", "Save in instalments for known future costs"),
  summary: l(
    "Kelajakdagi aniq xarajat (o'qish, sayohat, texnika, yillik to'lov) summasi oylar soniga bo'linadi va har oy shuncha yig'iladi.",
    "Сумма будущего известного расхода (учёба, поездка, техника, годовой платёж) делится на число месяцев, и каждый месяц откладывается эта часть.",
    "A known future cost (tuition, travel, electronics, an annual bill) is divided by the months left, and that slice is saved each month.",
  ),
  benefits: [
    l("Katta xarajatlar «kutilmagan» bo'lmay qoladi", "Крупные траты перестают быть «внезапными»", "Big expenses stop being surprises"),
    l("Kredit yoki nasiyaga murojaat qilish ehtiyojini kamaytiradi", "Снижает потребность в кредитах и рассрочке", "Reduces the need for loans or instalment plans"),
  ],
  drawbacks: [
    l("Bir nechta fond bir vaqtda oylik pulni ancha band qiladi", "Несколько фондов одновременно занимают заметную часть месячного дохода", "Several funds at once can tie up a lot of monthly cash"),
    l("Inflyatsiya tufayli maqsad summasi oshib ketishi mumkin", "Из-за инфляции целевая сумма может вырасти", "Inflation can push the target up"),
  ],
  origin: {
    certainty: "uncertain",
    label: l("Davlat moliyasidan olingan atama; shaxsiy usulning muallifi yo'q", "Термин из государственных финансов; у личного метода нет автора", "A public-finance term; the personal method has no single author"),
    history: l(
      "«Sinking fund» atamasi dastlab davlat va kompaniyalar qarzini bosqichma-bosqich to'lash uchun ajratiladigan jamg'armani anglatgan; mashhur misol — XVIII asrda Buyuk Britaniyada davlat qarzini kamaytirish uchun tuzilgan fond. Shaxsiy moliyada bu atama ma'lum kelajak xarajati uchun asta-sekin yig'ishni bildiradi. Bu shaxsiy usulning aniq muallifi yo'q.",
      "Термин «sinking fund» изначально означал фонд, который государства и компании формировали для постепенного погашения долга; известный пример — фонд для сокращения государственного долга Великобритании в XVIII веке. В личных финансах он означает постепенное накопление на известный будущий расход. Единого автора у этого личного метода нет.",
      "“Sinking fund” originally meant money governments and companies set aside to retire debt gradually — a well-known example is the fund created in 18th-century Britain to reduce the national debt. In personal finance it means saving bit by bit for a known future expense. There is no single author of the personal method.",
    ),
    advocates: l(
      "Ko'plab byudjet ilovalari va moliyaviy savodxonlik manbalari uni zero-byudjet va konvertlar usuli bilan birga tavsiya qiladi.",
      "Многие бюджетные приложения и источники по финансовой грамотности рекомендуют его вместе с бюджетом с нуля и конвертами.",
      "Many budgeting apps and financial-education resources recommend it alongside zero-based and envelope budgeting.",
    ),
  },
  overview: l(
    "Har bir kelajak xarajati alohida «jamg'arma» bo'ladi: maqsad summasi, muddat va oylik badal. Fondlar favqulodda jamg'armadan farq qiladi — ular kutilgan, rejalangan xarajatlar uchun. Muddat yetganda pul tayyor bo'ladi va xarajat byudjetni buzmaydi.",
    "Каждый будущий расход становится отдельным «фондом»: целевая сумма, срок и ежемесячный взнос. Эти фонды отличаются от резервного — они для ожидаемых, запланированных трат. К сроку деньги готовы, и расход не ломает бюджет.",
    "Each future expense becomes its own fund with a target, a deadline and a monthly contribution. Unlike an emergency fund, these are for expected, planned costs. When the date arrives the money is there and the budget stays intact.",
  ),
  steps: [
    l("Yil davomida kutilayotgan katta xarajatlar ro'yxatini tuzing.", "Составьте список крупных расходов, ожидаемых в течение года.", "List the big expenses you expect over the year."),
    l("Har biri uchun summa va muddatni yozing.", "Для каждого запишите сумму и срок.", "Write down an amount and a date for each."),
    l("Oylik badal = qolgan summa ÷ qolgan oylar.", "Ежемесячный взнос = оставшаяся сумма ÷ оставшиеся месяцы.", "Monthly contribution = amount remaining ÷ months remaining."),
    l("Har oy badallarni o'tkazing va muddat yaqinlashganda summani qayta tekshiring.", "Переводите взносы каждый месяц и пересматривайте сумму ближе к сроку.", "Contribute monthly and re-check the amount as the date nears."),
  ],
  science: l(
    "Katta xarajatni kichik oylik bo'laklarga bo'lish «aqliy hisob» orqali uni boshqariladigan qiladi va qimmat qisqa muddatli qarzga bo'lgan ehtiyojni kamaytiradi.",
    "Деление крупной траты на небольшие ежемесячные части через «ментальный учёт» делает её управляемой и снижает потребность в дорогих краткосрочных долгах.",
    "Breaking a large cost into small monthly pieces makes it manageable through mental accounting and reduces reliance on expensive short-term debt.",
  ),
  professions: [
    { key: "family", why: l("Maktab, to'y, ta'mir kabi oilaviy xarajatlarni oldindan tayyorlaydi.", "Заранее готовит семейные расходы: школа, свадьба, ремонт.", "Prepares for family costs such as school, weddings and repairs.") },
    { key: "university", why: l("Kontrakt to'lovi yoki noutbuk uchun bo'lib-bo'lib yig'ish mumkin.", "Можно копить частями на контракт за учёбу или ноутбук.", "Lets you save in parts for tuition fees or a laptop.") },
    { key: "salaried", why: l("Muntazam maoshdan har oy belgilangan badal ajratish oson.", "Из регулярной зарплаты легко выделять фиксированный взнос.", "A fixed slice of a regular salary is easy to set aside.") },
    { key: "freelancer", why: l("Yaxshi oylarda ko'proq badal qo'shib, kam oylarda to'xtatib turish mumkin.", "В хорошие месяцы можно вносить больше, в слабые — делать паузу.", "Pay more in strong months and pause in lean ones.") },
  ],
  situations: [
    l("Yillik to'lovlar yoki katta xaridlar har safar byudjetni buzadi", "Годовые платежи и крупные покупки каждый раз ломают бюджет", "Annual bills or big purchases keep breaking your budget"),
    l("Nasiya yoki kreditsiz xarid qilmoqchisiz", "Хотите покупать без рассрочки и кредитов", "You want to buy without instalments or loans"),
  ],
  stages: ["16-20", "21-25", "26-35", "36-50", "51+"],
  stageNote: l("Har qanday hayot bosqichida rejalangan xarajatlar bor — usul universal.", "Запланированные траты есть на любом этапе жизни — метод универсален.", "Every life stage has planned costs — the method is universal."),
  example: {
    intro: l("Uchta maqsad, hammasi bugundan boshlanadi.", "Три цели, все начинаются сегодня.", "Three funds, all starting today."),
    rows: [
      { label: l("Noutbuk — 9 000 000 so'm, 12 oyda", "Ноутбук — 9 000 000 сумов за 12 месяцев", "Laptop — 9,000,000 UZS in 12 months"), amount: sfLaptop.monthly },
      { label: l("Sayohat — 4 800 000 so'm, 8 oyda", "Поездка — 4 800 000 сумов за 8 месяцев", "Trip — 4,800,000 UZS in 8 months"), amount: sfTravel.monthly },
      { label: l("Avtomobil xizmati — 1 200 000 so'm, 6 oyda", "Обслуживание авто — 1 200 000 сумов за 6 месяцев", "Car service — 1,200,000 UZS in 6 months"), amount: sfCar.monthly },
      { label: l("Jami oylik badal", "Итого взнос в месяц", "Total monthly contribution"), amount: sfLaptop.monthly + sfTravel.monthly + sfCar.monthly, emphasis: true },
    ],
    outro: l("6 000 000 so'mlik daromadning taxminan to'rtdan bir qismi — shuning uchun fondlarni ustuvorlik bo'yicha tanlang.", "Это около четверти дохода в 6 000 000 сумов — поэтому выбирайте фонды по приоритету.", "That's about a quarter of a 6,000,000 UZS income — so prioritise your funds."),
  },
  implement: [
    { action: "tool", text: l("Kalkulyatorda maqsad, summa va muddatni kiriting va «Maqsad yaratish»ni bosing — SOQQA muddat va oylik badal bilan jamg'arma maqsadini qo'shadi.", "Введите цель, сумму и срок в калькуляторе и нажмите «Создать цель» — SOQQA добавит цель со сроком и ежемесячным взносом.", "Enter a goal, amount and date in the calculator and press “Create goal” — SOQQA adds a goal with its deadline and monthly contribution.") },
    { action: "goals", text: l("«Maqsadlar» sahifasida har bir fondning rejadan ortda qolgan yoki qolmaganini kuzating.", "На странице «Цели» следите, отстаёт ли каждый фонд от плана.", "Track whether each fund is on schedule on the Goals page.") },
  ],
  references: [
    { title: "Sinking fund", author: "Encyclopaedia Britannica", year: "—", url: "https://www.britannica.com/money/sinking-fund", supports: l("Atamaning davlat va korporativ moliyadagi asl ma'nosi", "Исходное значение термина в государственных и корпоративных финансах", "The term's original meaning in public and corporate finance") },
    { title: "Mental Accounting Matters", author: "Richard H. Thaler — Journal of Behavioral Decision Making 12(3)", year: "1999", supports: l("Pulni maqsadlar bo'yicha ajratishning xulq-atvoriy asosi", "Поведенческая основа разделения денег по целям", "Behavioural basis for setting money aside by purpose") },
  ],
};

// ---------------------------------------------------------------- 8. Emergency fund

const essentials = UZS("3500000");
const ef3 = emergencyFund(essentials, 3, 0n);
const ef6 = emergencyFund(essentials, 6, 0n);

export const emergencyFundContent: StrategyContent = {
  slug: "emergency-fund",
  name: l("Favqulodda holatlar uchun jamg'arma", "Финансовая подушка безопасности", "Emergency Fund"),
  original: "Emergency Fund",
  accent: "#5B4BD6",
  complexity: 1,
  discipline: 2,
  flexibility: 2,
  purpose: l("Kutilmagan xarajat va daromad yo'qolishiga zaxira yaratish", "Создать резерв на непредвиденные расходы и потерю дохода", "Build a reserve for surprises and lost income"),
  summary: l(
    "Bir necha oylik zaruriy xarajatlarga teng zaxira alohida saqlanadi va faqat haqiqiy favqulodda holatda ishlatiladi.",
    "Резерв в размере нескольких месяцев необходимых расходов хранится отдельно и тратится только в настоящей чрезвычайной ситуации.",
    "A reserve worth several months of essential costs is kept separately and used only for genuine emergencies.",
  ),
  benefits: [
    l("Kasallik, ishdan ayrilish yoki ta'mir qarzga olib bormaydi", "Болезнь, потеря работы или ремонт не приводят к долгам", "Illness, job loss or repairs don't push you into debt"),
    l("Qolgan maqsadlar va strategiyalarni himoya qiladi", "Защищает остальные цели и стратегии", "Protects your other goals and plans"),
  ],
  drawbacks: [
    l("Katta summa uzoq vaqt «harakatsiz» turadi", "Крупная сумма долго лежит «без дела»", "A large sum sits idle for a long time"),
    l("Naqd saqlansa inflyatsiyadan qadrsizlanadi", "При хранении наличными обесценивается инфляцией", "Kept as cash, it loses value to inflation"),
  ],
  origin: {
    certainty: "uncertain",
    label: l("Aniq muallifi yo'q — moliyaviy rejalashtirish amaliyoti", "Единого автора нет — практика финансового планирования", "No single author — financial-planning practice"),
    history: l(
      "Kutilmagan holatlar uchun zaxira saqlash g'oyasi juda qadimiy va biror shaxsga tegishli emas. «3–6 oylik zaruriy xarajat» tavsiyasi zamonaviy moliyaviy maslahatchilar orasida keng tarqalgan qo'llanma, ammo universal qoida emas: AQSh Iste'molchilar moliyaviy himoyasi byurosi (CFPB) avval kichik, erishiladigan maqsaddan boshlashni maslahat beradi.",
      "Идея держать резерв на непредвиденные случаи очень стара и никому конкретно не принадлежит. Рекомендация «3–6 месяцев необходимых расходов» широко распространена среди финансовых консультантов, но это ориентир, а не универсальное правило: Бюро финансовой защиты потребителей США (CFPB) советует начинать с небольшой достижимой цели.",
      "Keeping a reserve for the unexpected is an ancient idea that belongs to no one. The “3–6 months of essential expenses” guideline is common among financial planners, but it's a guideline, not a universal rule: the U.S. Consumer Financial Protection Bureau (CFPB) advises starting with a small, achievable goal.",
    ),
    advocates: l(
      "Moliyaviy savodxonlik tashkilotlari (masalan, CFPB) va ko'plab moliyaviy rejalashtiruvchilar uni moliyaviy rejaning poydevori deb biladi.",
      "Организации по финансовой грамотности (например, CFPB) и многие финансовые планировщики считают его фундаментом финансового плана.",
      "Financial-education bodies such as the CFPB and many planners treat it as the foundation of a financial plan.",
    ),
  },
  overview: l(
    "Maqsad summasi «zaruriy oylik xarajat × oylar soni» bo'yicha hisoblanadi. Necha oy kerakligi daromad barqarorligiga bog'liq: barqaror maosh va ikki daromadli oilada kamroq, o'zgaruvchan daromad, yolg'iz boquvchi yoki qaramog'ida odamlar bo'lsa ko'proq. Zaxira tez yechib olinadigan, ammo kundalik hamyondan alohida joyda saqlanadi.",
    "Целевая сумма считается как «необходимые расходы в месяц × число месяцев». Сколько месяцев нужно, зависит от стабильности дохода: при стабильной зарплате и двух доходах в семье — меньше, при плавающем доходе, единственном кормильце или иждивенцах — больше. Резерв хранят там, откуда его можно быстро снять, но отдельно от повседневного кошелька.",
    "The target is essential monthly costs × number of months. How many months depends on income stability: fewer with a steady salary and two earners, more with variable income, a single earner or dependants. Keep it somewhere you can reach quickly but separate from your everyday wallet.",
  ),
  steps: [
    l("Faqat zaruriy oylik xarajatlarni hisoblang: uy, oziq-ovqat, kommunal, transport, majburiy to'lovlar.", "Посчитайте только необходимые месячные траты: жильё, продукты, коммуналка, транспорт, обязательные платежи.", "Add up only essential monthly costs: housing, food, utilities, transport, required payments."),
    l("Vaziyatingizga qarab 3, 6 yoki undan ko'p oyni tanlang.", "Выберите 3, 6 или больше месяцев в зависимости от ситуации.", "Choose 3, 6 or more months to fit your situation."),
    l("Birinchi bosqich — bir oylik xarajat; so'ng asta-sekin to'liq maqsad.", "Первый этап — один месяц расходов, затем постепенно полная цель.", "First milestone: one month of costs; then build to the full target."),
    l("Ishlatganingizdan keyin zaxirani qayta to'ldirishni ustuvor qiling.", "После использования в первую очередь восстанавливайте резерв.", "After using it, make refilling it the priority."),
  ],
  science: l(
    "Tadqiqotlar kichik likvid jamg'armaning ham moliyaviy stressni va qimmat qarzga murojaatni kamaytirishini ko'rsatadi. Shuning uchun boshlash summasi muhim emas — boshlashning o'zi muhim.",
    "Исследования показывают, что даже небольшие ликвидные сбережения снижают финансовый стресс и обращение к дорогим долгам. Поэтому важна не стартовая сумма, а сам факт начала.",
    "Research shows even small liquid savings reduce financial stress and reliance on expensive debt — so the starting amount matters less than starting.",
  ),
  professions: [
    { key: "freelancer", why: l("Buyurtmasiz oylar bo'ladi — zaxira 6 oy va undan ko'p bo'lgani ma'qul.", "Бывают месяцы без заказов — резерв лучше на 6 месяцев и больше.", "Some months bring no work — aim for 6 months or more.") },
    { key: "irregular", why: l("Daromad tebranishlarini yumshatadi va kundalik byudjetni barqaror qiladi.", "Сглаживает колебания дохода и стабилизирует повседневный бюджет.", "Smooths income swings and steadies the everyday budget.") },
    { key: "family", why: l("Qaramog'ingizda odamlar bo'lsa, kutilmagan xarajat xavfi yuqori.", "С иждивенцами риск непредвиденных трат выше.", "With dependants, the risk of unexpected costs is higher.") },
    { key: "salaried", why: l("Barqaror ishda ham ishdan ayrilish yoki kasallik ehtimoli bor — 3 oy yaxshi boshlanish.", "Даже на стабильной работе возможны увольнение или болезнь — 3 месяца хороший старт.", "Even steady jobs can end or illness can strike — 3 months is a good start.") },
    { key: "retiree", why: l("Tibbiy va uy-joy xarajatlari kutilmaganda paydo bo'lishi mumkin.", "Медицинские и жилищные расходы могут возникнуть внезапно.", "Medical and housing costs can arise suddenly.") },
  ],
  situations: [
    l("Hali hech qanday zaxirangiz yo'q", "У вас пока нет никакого резерва", "You have no reserve yet"),
    l("O'zgaruvchan daromad yoki yolg'iz boquvchisiz", "Плавающий доход или вы единственный кормилец", "Variable income or you're the sole earner"),
  ],
  stages: ["21-25", "26-35", "36-50", "51+"],
  stageNote: l("Mustaqil daromad paydo bo'lgandan boshlab kerak; summa yosh emas, majburiyatlarga bog'liq.", "Нужен с появлением собственного дохода; сумма зависит от обязательств, а не от возраста.", "Needed from your first independent income; the size depends on obligations, not age."),
  example: {
    intro: l("Zaruriy oylik xarajatlar 3 500 000 so'm; har oy 600 000 so'm ajratiladi.", "Необходимые расходы 3 500 000 сумов в месяц; откладывается 600 000 сумов в месяц.", "Essential costs are 3,500,000 UZS a month; 600,000 UZS is set aside monthly."),
    rows: [
      { label: l("3 oylik zaxira", "Резерв на 3 месяца", "3-month reserve"), amount: ef3.target, emphasis: true },
      { label: l("6 oylik zaxira", "Резерв на 6 месяцев", "6-month reserve"), amount: ef6.target },
      { label: l("Birinchi bosqich — 1 oylik xarajat", "Первый этап — расходы за 1 месяц", "First milestone — 1 month"), amount: essentials },
    ],
    outro: l("Oyiga 600 000 so'mdan 3 oylik zaxiraga taxminan 18 oyda erishiladi; birinchi bosqich — 6 oyda.", "По 600 000 сумов в месяц резерв на 3 месяца наберётся примерно за 18 месяцев; первый этап — за 6.", "At 600,000 UZS a month, the 3-month reserve takes about 18 months; the first milestone about 6."),
  },
  implement: [
    { action: "tool", text: l("Kalkulyator zaruriy xarajatlaringizni SOQQA'dagi «ehtiyoj» kategoriyalaridan hisoblaydi; «Zaxira maqsadini yaratish» tugmasi qalqon belgili maqsad qo'shadi.", "Калькулятор берёт ваши необходимые расходы из категорий «необходимое» в SOQQA; кнопка «Создать цель-резерв» добавит цель со значком щита.", "The calculator derives essential costs from your “needs” categories in SOQQA; “Create reserve goal” adds a shield goal.") },
    { action: "wallets", text: l("Zaxirani «xarajat uchun emas» deb belgilangan alohida hamyonda saqlang — u «bemalol sarflash» summasiga kirmaydi.", "Храните резерв в отдельном кошельке с отметкой «не для трат» — он не войдёт в «можно потратить».", "Keep the reserve in a separate wallet marked as not spendable — it stays out of safe-to-spend.") },
  ],
  references: [
    { title: "An essential guide to building an emergency fund", author: "Consumer Financial Protection Bureau (CFPB)", year: "—", url: "https://www.consumerfinance.gov/an-essential-guide-to-building-an-emergency-fund/", supports: l("Zaxira ahamiyati va kichik maqsaddan boshlash tavsiyasi", "Значение резерва и совет начинать с малой цели", "Why a reserve matters and the advice to start small") },
  ],
};

// ---------------------------------------------------------------- 9. Debt repayment

const debts: DebtInput[] = [
  { id: "loan", name: "Iste'mol krediti", balance: UZS("4000000"), aprBps: 2000, minPayment: UZS("250000") },
  { id: "card", name: "Kredit karta", balance: UZS("10000000"), aprBps: 3000, minPayment: UZS("500000") },
];
const dAva = simulatePayoff(debts, UZS("1200000"), "avalanche");
const dSnow = simulatePayoff(debts, UZS("1200000"), "snowball");

export const debtPayoffContent: StrategyContent = {
  slug: "debt-payoff",
  name: l("Qarzni yopish: ko'chki va qor to'pi", "Погашение долгов: лавина и снежный ком", "Debt Avalanche & Snowball"),
  original: "Debt Avalanche / Debt Snowball",
  accent: "#E11D48",
  complexity: 2,
  discipline: 3,
  flexibility: 2,
  purpose: l("Bir nechta qarzni tartib bilan va tezroq yopish", "Гасить несколько долгов по порядку и быстрее", "Pay off several debts in order, faster"),
  summary: l(
    "Barcha qarzlarning minimal to'lovi to'lanadi, ortiqcha pul esa bitta ustuvor qarzga yo'naltiriladi: eng yuqori foizli (ko'chki) yoki eng kichik qoldiqli (qor to'pi).",
    "По всем долгам вносится минимум, а лишние деньги идут на один приоритетный долг: с самой высокой ставкой (лавина) или с самым маленьким остатком (снежный ком).",
    "Pay the minimum on every debt and put extra money on one priority debt: the highest interest rate (avalanche) or the smallest balance (snowball).",
  ),
  benefits: [
    l("Ko'chki — umumiy foiz to'lovini matematik jihatdan eng kam qiladi", "Лавина математически минимизирует общую переплату по процентам", "Avalanche mathematically minimises total interest"),
    l("Qor to'pi — tez «g'alabalar» motivatsiyani saqlaydi", "Снежный ком — быстрые «победы» поддерживают мотивацию", "Snowball — quick wins keep motivation up"),
  ],
  drawbacks: [
    l("Ko'chkida birinchi qarz yopilishi uzoq kutilishi mumkin", "При лавине первого закрытого долга можно ждать долго", "Avalanche can take a long time to close the first debt"),
    l("Qor to'pi odatda ko'proq foiz to'latadi", "Снежный ком обычно обходится дороже по процентам", "Snowball usually costs more interest"),
  ],
  origin: {
    certainty: "popularized",
    label: l("Qor to'pi — Deyv Ramsi ommalashtirgan; ko'chki — matematik yondashuv", "Снежный ком популяризировал Дэйв Рэмси; лавина — математический подход", "Snowball popularised by Dave Ramsey; avalanche is a mathematical approach"),
    history: l(
      "Ko'chki usuli — eng qimmat qarzni birinchi yopish — foiz matematikasidan kelib chiqadi va aniq muallifga ega emas. Qor to'pi usulini Deyv Ramsi «The Total Money Makeover» (2003) kitobida keng ommalashtirgan. Gal va Makshein (2012) qarz bo'yicha maslahat kompaniyasining ma'lumotlarida alohida qarz hisoblarini yopish — ularning summasidan qat'i nazar — qarzdan to'liq qutulishni bashorat qilishini aniqlagan.",
      "Лавина — гасить сначала самый дорогой долг — вытекает из математики процентов и не имеет конкретного автора. Метод снежного кома широко популяризировал Дэйв Рэмси в книге «The Total Money Makeover» (2003). Гал и Макшейн (2012) на данных компании по урегулированию долгов обнаружили, что закрытие отдельных долговых счетов — независимо от их суммы — предсказывало полное избавление от долгов.",
      "The avalanche — clear the most expensive debt first — follows from interest arithmetic and has no single author. The snowball was popularised by Dave Ramsey in The Total Money Makeover (2003). Gal and McShane (2012), using a debt-settlement company's data, found that closing individual accounts — regardless of their size — predicted eliminating debt altogether.",
    ),
    advocates: l(
      "Deyv Ramsi qor to'pini targ'ib qiladi; ko'plab moliyaviy kalkulyatorlar ikkala usulni yonma-yon ko'rsatadi. Tadqiqotchilar iste'molchilarga ikkala yondashuvning foyda va kamchiliklarini aytishni tavsiya qiladi.",
      "Дэйв Рэмси продвигает снежный ком; многие финансовые калькуляторы показывают оба метода рядом. Исследователи советуют сообщать людям о плюсах и минусах обоих подходов.",
      "Dave Ramsey promotes the snowball; many calculators show both side by side. Researchers suggest people be told the trade-offs of both approaches.",
    ),
  },
  overview: l(
    "Avval barcha qarzlar ro'yxati tuziladi: qoldiq, yillik foiz va minimal to'lov. Har oy hammasiga minimal to'lov qilinadi, qolgan barcha qo'shimcha pul ustuvor qarzga yo'naltiriladi. U yopilganda bo'shagan to'lov keyingisiga qo'shiladi — shuning uchun to'lov kuchi «qor to'pi» kabi o'sib boradi. Foizsiz nasiya ham qarz — u ro'yxatga 0% bilan kiritiladi.",
    "Сначала составляется список всех долгов: остаток, годовая ставка и минимальный платёж. Каждый месяц по всем вносится минимум, а все дополнительные деньги идут на приоритетный долг. Когда он закрыт, освободившийся платёж добавляется к следующему — поэтому платёжная сила растёт, как снежный ком. Беспроцентная рассрочка тоже долг — она вносится в список со ставкой 0%.",
    "First list every debt: balance, annual rate and minimum payment. Each month pay every minimum and send all extra money to the priority debt. When it's gone, its payment rolls onto the next, so your repayment power snowballs. An interest-free instalment plan is still debt — list it at 0%.",
  ),
  steps: [
    l("Barcha qarzlarni yozing: qoldiq, foiz, minimal to'lov.", "Запишите все долги: остаток, ставку, минимальный платёж.", "List every debt: balance, rate, minimum payment."),
    l("Oyiga qarzga ajrata oladigan umumiy summani belgilang.", "Определите общую сумму, которую можете направлять на долги в месяц.", "Decide the total you can put toward debt each month."),
    l("Usulni tanlang va ustuvor qarzga qo'shimcha to'lang.", "Выберите метод и вносите дополнительно по приоритетному долгу.", "Pick a method and pay extra on the priority debt."),
    l("Har yopilgan qarzdan bo'shagan pulni keyingisiga qo'shing.", "Добавляйте освободившиеся деньги к следующему долгу.", "Roll each freed-up payment into the next debt."),
  ],
  science: l(
    "Matematik jihatdan ko'chki har doim kam foiz to'latadi yoki teng bo'ladi. Ammo Gal va Makshein (2012) tadqiqoti kichik hisoblarni yopish qarzdan to'liq qutulish ehtimoli bilan bog'liqligini ko'rsatdi — ya'ni motivatsiya ham muhim. Eng yaxshi usul — siz oxirigacha amal qiladiganingiz.",
    "Математически лавина всегда даёт меньшую или равную переплату. Но исследование Гала и Макшейна (2012) показало, что закрытие мелких счетов связано с вероятностью полностью избавиться от долгов — то есть мотивация тоже важна. Лучший метод — тот, которого вы будете придерживаться до конца.",
    "Mathematically the avalanche always costs the same or less interest. But Gal and McShane (2012) found closing small accounts was associated with eliminating debt altogether — motivation matters too. The best method is the one you'll stick with.",
  ),
  professions: [
    { key: "salaried", why: l("Barqaror maosh har oy bir xil qo'shimcha summani rejalashtirishga imkon beradi.", "Стабильная зарплата позволяет планировать одинаковую доплату каждый месяц.", "A steady salary allows the same extra payment each month.") },
    { key: "family", why: l("Oilaviy kreditlar va nasiyalar ko'p bo'lsa, tartib beradi.", "Наводит порядок, когда в семье много кредитов и рассрочек.", "Brings order when a household juggles loans and instalments.") },
    { key: "sales", why: l("Bonus va komissiyalarni ustuvor qarzga yo'naltirish samarali.", "Бонусы и комиссии эффективно направлять на приоритетный долг.", "Bonuses and commission can go straight to the priority debt.") },
    { key: "university", why: l("O'qish krediti va kichik qarzlarni erta yopish odatini shakllantiradi.", "Формирует привычку рано закрывать учебные и мелкие долги.", "Builds the habit of clearing study and small debts early.") },
  ],
  situations: [
    l("Bir nechta kredit, karta qarzi yoki nasiyangiz bor", "У вас несколько кредитов, долгов по картам или рассрочек", "You have several loans, card balances or instalment plans"),
    l("Qarzlar oylik daromadning katta qismini olmoqda", "Долги забирают большую часть месячного дохода", "Debt takes a big bite out of monthly income"),
  ],
  stages: ["21-25", "26-35", "36-50", "51+"],
  stageNote: l("Qarzi bor har bir kishi uchun; yosh emas, qarzlar tarkibi usulni belgilaydi.", "Для всех, у кого есть долги; метод определяет структура долгов, а не возраст.", "For anyone with debt; the mix of debts, not age, decides the method."),
  example: {
    intro: l("Iste'mol krediti 4 000 000 so'm (20%, min 250 000) va kredit karta 10 000 000 so'm (30%, min 500 000); oyiga 1 200 000 so'm ajratiladi.", "Потребкредит 4 000 000 сумов (20%, мин. 250 000) и кредитная карта 10 000 000 сумов (30%, мин. 500 000); на долги — 1 200 000 сумов в месяц.", "A 4,000,000 UZS consumer loan (20%, min 250,000) and a 10,000,000 UZS card (30%, min 500,000); 1,200,000 UZS a month goes to debt."),
    rows: [
      { label: l(`Ko'chki: umumiy foiz (${dAva.months} oy)`, `Лавина: проценты всего (${dAva.months} мес.)`, `Avalanche: total interest (${dAva.months} months)`), amount: dAva.totalInterest, emphasis: true },
      { label: l(`Qor to'pi: umumiy foiz (${dSnow.months} oy)`, `Снежный ком: проценты всего (${dSnow.months} мес.)`, `Snowball: total interest (${dSnow.months} months)`), amount: dSnow.totalInterest },
      { label: l("Ko'chki tejaydigan farq", "Экономия лавины", "Avalanche saving"), amount: dSnow.totalInterest - dAva.totalInterest },
    ],
    outro: l(`Qor to'pi birinchi qarzni ${dSnow.payoffOrder[0]?.month ?? "—"}-oyda yopadi, ko'chki esa ${dAva.payoffOrder[0]?.month ?? "—"}-oyda.`, `Снежный ком закрывает первый долг на ${dSnow.payoffOrder[0]?.month ?? "—"}-м месяце, лавина — на ${dAva.payoffOrder[0]?.month ?? "—"}-м.`, `The snowball closes its first debt in month ${dSnow.payoffOrder[0]?.month ?? "—"}; the avalanche in month ${dAva.payoffOrder[0]?.month ?? "—"}.`),
  },
  implement: [
    { action: "tool", text: l("Taqqoslash vositasiga qarzlaringizni kiriting — ikkala usul jadvali hisoblanadi; tanlangan rejani saqlab, qoldiqlarni yangilab borasiz.", "Внесите долги в инструмент сравнения — рассчитаются графики обоих методов; сохраните выбранный план и обновляйте остатки.", "Enter your debts in the comparison tool — both schedules are calculated; save the chosen plan and update balances as you go.") },
    { action: "recurring", text: l("Minimal to'lovlarni «Doimiy to'lovlar»ga qo'shing — ular «bemalol sarflash» hisobida inobatga olinadi.", "Добавьте минимальные платежи в «Регулярные платежи» — они учтутся в сумме «можно потратить».", "Add the minimum payments as recurring items — they're reserved in safe-to-spend.") },
  ],
  references: [
    { title: "The Total Money Makeover", author: "Dave Ramsey", year: "2003", supports: l("Qor to'pi usulining ommalashuvi", "Популяризация метода снежного кома", "Popularisation of the snowball method") },
    { title: "Can Small Victories Help Win the War? Evidence from Consumer Debt Management", author: "David Gal, Blakeley B. McShane — Journal of Marketing Research 49(4)", year: "2012", url: "https://www.kellogg.northwestern.edu/academics-research/research/detail/2012/can-fighting-small-battles-help-win-the-war-evidence", supports: l("Hisoblarni yopish va qarzdan qutulish bog'liqligi", "Связь закрытия счетов с избавлением от долгов", "Link between closing accounts and eliminating debt") },
  ],
};

// ---------------------------------------------------------------- 10. Lifestyle inflation

const raise = raiseSplit(INCOME, UZS("7500000"), 5000);

export const lifestyleInflationContent: StrategyContent = {
  slug: "lifestyle-inflation",
  name: l("Turmush tarzi inflyatsiyasini nazorat qilish", "Контроль инфляции образа жизни", "Lifestyle Inflation Control"),
  original: "Lifestyle Creep Control",
  accent: "#D9A23A",
  complexity: 1,
  discipline: 2,
  flexibility: 3,
  purpose: l("Daromad oshganda xarajatlar avtomatik o'smasligini ta'minlash", "Не давать расходам автоматически расти вместе с доходом", "Stop spending from rising automatically with income"),
  summary: l(
    "Har bir maosh oshishi yoki bonusdan oldindan belgilangan ulush (masalan, yarmi) jamg'armaga ketadi; qolgani bilan hayot sifati oshiriladi.",
    "С каждого повышения или бонуса заранее выбранная доля (например, половина) уходит в сбережения, а остаток улучшает качество жизни.",
    "From every raise or bonus a pre-set share (say half) goes to savings, and the rest improves your life.",
  ),
  benefits: [
    l("Daromad o'sishi haqiqiy boylikka aylanadi", "Рост дохода превращается в реальное благосостояние", "Income growth turns into real wealth"),
    l("Hayotdan voz kechishni talab qilmaydi — faqat o'sishning bir qismini", "Не требует отказываться от жизни — только от части прироста", "No sacrifice required — just part of the increase"),
  ],
  drawbacks: [
    l("Daromad oshmasa, yangi jamg'arma paydo bo'lmaydi", "Если доход не растёт, новых сбережений не появляется", "No raise, no new savings"),
    l("Inflyatsiya tufayli «oshish»ning bir qismi narx o'sishini qoplashga ketadi", "Часть «повышения» уходит на покрытие роста цен", "Part of a raise may only offset price inflation"),
  ],
  origin: {
    certainty: "uncertain",
    label: l("Parkinson va gedonistik moslashuv g'oyalari bilan bog'liq", "Связано с идеями Паркинсона и гедонистической адаптации", "Linked to Parkinson's law and hedonic adaptation"),
    history: l(
      "«Lifestyle creep» atamasining muallifi ma'lum emas. Hodisaning asosi ilgari ta'riflangan: S. Nortkout Parkinson «The Law and the Profits» (1960) kitobida «xarajatlar daromadga yetguncha o'sadi» degan fikrni ilgari surgan. Brikman va Kempbell (1971) odamlar yaxshilangan sharoitga tez ko'nikishini — «gedonistik moslashuv»ni ta'riflagan.",
      "Автор термина «lifestyle creep» неизвестен. Основа явления описана раньше: С. Норткот Паркинсон в книге «The Law and the Profits» (1960) выдвинул мысль, что «расходы растут, пока не сравняются с доходом». Брикман и Кэмпбелл (1971) описали «гедонистическую адаптацию» — люди быстро привыкают к улучшившимся условиям.",
      "Who coined “lifestyle creep” is unknown, but its basis was described earlier: C. Northcote Parkinson argued in The Law and the Profits (1960) that expenditure rises to meet income, and Brickman and Campbell (1971) described hedonic adaptation — people quickly get used to improved circumstances.",
    ),
    advocates: l(
      "Taler va Benartsining «Save More Tomorrow» dasturi kelajakdagi maosh oshishlarining bir qismini oldindan jamg'armaga yo'naltirish orqali amalda shu g'oyani qo'llagan.",
      "Программа Талера и Бенартци «Save More Tomorrow» применила эту идею на практике, заранее направляя часть будущих повышений в сбережения.",
      "Thaler and Benartzi's Save More Tomorrow programme put this into practice by committing part of future raises to saving in advance.",
    ),
  },
  overview: l(
    "Daromad oshganda odam odatda yangi telefon, qimmatroq kafe, yangi obunalarni «normal» deb qabul qiladi va bir necha oydan keyin yana oy oxirida pul qolmaydi. Bu strategiya oshishni ikkiga bo'ladi: bir qismi darhol jamg'arma yoki qarzga, qolgani — ongli tanlangan yaxshilanishga. Doimiy obunalar va qayta takrorlanadigan xarajatlar alohida tekshiriladi.",
    "При росте дохода люди обычно начинают считать «нормой» новый телефон, кафе подороже, новые подписки — и через несколько месяцев к концу месяца снова ничего не остаётся. Эта стратегия делит прирост на две части: одна сразу идёт в сбережения или на долги, другая — на осознанно выбранное улучшение. Подписки и регулярные траты проверяются отдельно.",
    "When income rises, a new phone, pricier cafés and extra subscriptions quickly feel normal — and a few months later nothing is left at month end again. This strategy splits each increase: part goes straight to savings or debt, the rest to a deliberately chosen upgrade. Recurring subscriptions get a separate check.",
  ),
  steps: [
    l("Oshishdan oldin qancha ulush jamg'armaga ketishini qaror qiling (masalan, 50%).", "До повышения решите, какая доля уйдёт в сбережения (например, 50%).", "Before a raise lands, decide the share for savings (e.g. 50%)."),
    l("Yangi daromadning birinchi oyidanoq shu ulushni avtomatik ajrating.", "С первого месяца нового дохода откладывайте эту долю автоматически.", "From the first month of the new income, set that share aside automatically."),
    l("Qolgan qismni ongli tanlangan yaxshilanishga sarflang.", "Остальное потратьте на осознанно выбранное улучшение.", "Spend the rest on a consciously chosen upgrade."),
    l("Har chorakda doimiy obunalar va takroriy xarajatlarni qayta ko'rib chiqing.", "Раз в квартал пересматривайте подписки и регулярные траты.", "Review subscriptions and recurring costs each quarter."),
  ],
  science: l(
    "«Save More Tomorrow» tajribasida kelajakdagi maosh oshishidan jamg'arishga oldindan rozi bo'lgan ishchilarning jamg'arma darajasi bir necha yil ichida sezilarli o'sgan — chunki joriy xarajatlardan voz kechish talab qilinmagan.",
    "В эксперименте «Save More Tomorrow» норма сбережений работников, заранее согласившихся откладывать часть будущих повышений, за несколько лет заметно выросла — ведь от текущих трат отказываться не требовалось.",
    "In Save More Tomorrow, workers who pre-committed part of future raises to saving increased their saving rates substantially over a few years — because no cut to current spending was needed.",
  ),
  professions: [
    { key: "it", why: l("IT sohasida daromad tez o'sadi — o'sishning bir qismini saqlab qolish ayniqsa muhim.", "В IT доход растёт быстро — особенно важно сохранять часть прироста.", "Tech incomes rise fast — keeping part of each increase matters most here.") },
    { key: "sales", why: l("Bonuslar va yuqori oylar xarajatlarni oshirib yuborishga moyil qiladi.", "Бонусы и удачные месяцы подталкивают к росту трат.", "Bonuses and strong months tempt spending upward.") },
    { key: "salaried", why: l("Har yillik oshish yoki lavozim ko'tarilishi uchun aniq qoida beradi.", "Даёт чёткое правило для ежегодного повышения или продвижения.", "Gives a clear rule for annual raises or promotions.") },
    { key: "entrepreneur", why: l("Biznes o'sishi shaxsiy xarajatlarning bir zumda oshishiga aylanmaydi.", "Рост бизнеса не превращается мгновенно в рост личных трат.", "Business growth doesn't instantly become personal spending growth.") },
  ],
  situations: [
    l("Daromadingiz oshdi, ammo jamg'arma o'zgarmadi", "Доход вырос, а сбережения нет", "Your income rose but your savings didn't"),
    l("Obunalar va takroriy xarajatlar soni o'smoqda", "Растёт число подписок и регулярных трат", "Subscriptions and recurring costs keep multiplying"),
  ],
  stages: ["21-25", "26-35", "36-50"],
  stageNote: l("Daromad tez o'sadigan martaba yillarida eng foydali, lekin istalgan oshishda qo'llanadi.", "Полезнее всего в годы быстрого карьерного роста, но применим при любом повышении.", "Most useful in fast-growing career years, but works with any raise."),
  example: {
    intro: l("Daromad 6 000 000 so'mdan 7 500 000 so'mga oshdi; oshishning 50% jamg'armaga.", "Доход вырос с 6 000 000 до 7 500 000 сумов; 50% прироста — в сбережения.", "Income rises from 6,000,000 to 7,500,000 UZS; 50% of the raise goes to savings."),
    rows: [
      { label: l("Oshish", "Прирост", "Raise"), amount: raise.raise },
      { label: l("Jamg'armaga (50%)", "В сбережения (50%)", "To savings (50%)"), amount: raise.save, emphasis: true },
      { label: l("Hayot sifatiga (50%)", "На качество жизни (50%)", "To lifestyle (50%)"), amount: raise.lifestyle },
    ],
    outro: l("Bir yilda oshishning o'zidan 9 000 000 so'm jamg'ariladi, hayot esa baribir yaxshilanadi.", "За год только из прироста накопится 9 000 000 сумов, а жизнь всё равно станет лучше.", "Over a year the raise alone adds 9,000,000 UZS of savings — and life still improves."),
  },
  implement: [
    { action: "tool", text: l("Vosita oxirgi 3 oy va undan oldingi 3 oydagi daromad va xarajat o'sishini SOQQA ma'lumotlaringizdan solishtiradi; oshish ulushini maqsadga yo'naltirasiz.", "Инструмент сравнивает рост дохода и расходов за последние 3 месяца и 3 месяца до них по вашим данным в SOQQA; долю прироста вы направляете в цель.", "The tool compares income and spending growth over the last 3 months versus the 3 before, from your SOQQA records; you send the raise share to a goal.") },
    { action: "recurring", text: l("«Doimiy to'lovlar» ro'yxatini har chorakda tekshiring va keraksiz obunalarni o'chiring.", "Раз в квартал проверяйте «Регулярные платежи» и отключайте ненужные подписки.", "Review recurring payments each quarter and cancel what you don't need.") },
  ],
  references: [
    { title: "The Law and the Profits", author: "C. Northcote Parkinson", year: "1960", supports: l("«Xarajatlar daromadga yetguncha o'sadi» g'oyasi", "Идея «расходы растут до уровня дохода»", "The idea that expenditure rises to meet income") },
    { title: "Hedonic relativism and planning the good society", author: "P. Brickman, D. T. Campbell", year: "1971", supports: l("Gedonistik moslashuv tushunchasi", "Понятие гедонистической адаптации", "The concept of hedonic adaptation") },
    { title: "Save More Tomorrow: Using Behavioral Economics to Increase Employee Saving", author: "R. H. Thaler, S. Benartzi — Journal of Political Economy 112(S1)", year: "2004", supports: l("Kelajakdagi oshishlarni jamg'armaga yo'naltirish samarasi", "Эффект направления будущих повышений в сбережения", "Effect of committing future raises to saving") },
  ],
};
