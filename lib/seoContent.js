// AIanime v147: visible SEO content helpers for title, genre, studio, collection and year landing pages.
// Only text/Schema helpers: no UI layout logic and no data-source changes.
import { cleanSeoText, truncateSeo, SITE_URL } from '@/lib/seo'

function safeText(value, fallback = ''){
  const text = cleanSeoText(value)
  return text || fallback
}

function uniqueList(values = [], limit = 8){
  const seen = new Set()
  const result = []
  for(const value of Array.isArray(values) ? values : []){
    const text = safeText(value)
    const key = text.toLowerCase()
    if(!text || seen.has(key)) continue
    seen.add(key)
    result.push(text)
    if(result.length >= limit) break
  }
  return result
}

function absoluteUrl(path = '/'){
  const value = String(path || '/')
  if(/^https?:\/\//i.test(value)) return value
  return `${SITE_URL}${value.startsWith('/') ? value : `/${value}`}`
}

export function faqJsonLd(faq = []){
  const items = (Array.isArray(faq) ? faq : [])
    .map(item => ({
      question:safeText(item.question),
      answer:safeText(item.answer)
    }))
    .filter(item => item.question && item.answer)
    .slice(0, 8)

  if(!items.length) return null

  return {
    '@context':'https://schema.org',
    '@type':'FAQPage',
    mainEntity:items.map(item => ({
      '@type':'Question',
      name:item.question,
      acceptedAnswer:{ '@type':'Answer', text:item.answer }
    }))
  }
}

export function webPageWithFaqJsonLd({ name, description, path = '/', faq = [] } = {}){
  const page = {
    '@context':'https://schema.org',
    '@type':'WebPage',
    name:safeText(name),
    description:truncateSeo(description, 240),
    url:absoluteUrl(path),
    inLanguage:'ru-RU',
    isPartOf:{ '@type':'WebSite', name:'AIanime', url:SITE_URL }
  }
  const faqSchema = faqJsonLd(faq)
  return faqSchema ? [page, faqSchema] : page
}

const GENRE_DESCRIPTIONS = {
  'экшен':'Экшен-аниме держит темп за счёт сражений, сильных конфликтов и героев, которые постоянно проходят через испытания. Здесь удобно выбирать тайтлы, когда хочется динамики, яркой постановки и понятного напряжения с первых серий.',
  'приключения':'Приключенческие аниме строятся вокруг путешествий, новых миров и команды персонажей, которые двигаются к большой цели. Такие тайтлы хорошо подходят для зрителей, которым важны ощущение пути, открытия и постепенное расширение истории.',
  'фэнтези':'Фэнтези-аниме переносит в миры с магией, необычными правилами, существами и масштабными конфликтами. В этой подборке удобно искать как лёгкие приключения, так и более серьёзные истории с драмой и экшеном.',
  'романтика':'Романтические аниме сосредоточены на чувствах, доверии, неловких признаниях и развитии отношений. Здесь можно найти как спокойные повседневные истории, так и драматичные тайтлы с сильной эмоциональной линией.',
  'драма':'Драматические аниме делают акцент на переживаниях героев, сложном выборе и последствиях поступков. Такие тайтлы лучше смотреть, когда хочется не только сюжета, но и сильной эмоциональной отдачи.',
  'комедия':'Комедийные аниме подходят для лёгкого просмотра: они держатся на живой динамике, забавных ситуациях и контрасте характеров. В жанре много коротких тайтлов на вечер и сериалов, к которым приятно возвращаться.',
  'повседневность':'Повседневные аниме создают спокойную атмосферу через маленькие события, общение персонажей и уютный ритм. Это хороший выбор для отдыха, когда хочется мягкого вайба без перегруженного конфликта.',
  'психология':'Психологические аниме разбирают внутренние конфликты, страхи, мотивацию и нестабильные состояния героев. Такие тайтлы часто цепляют атмосферой, подтекстом и напряжением между персонажами.',
  'триллер':'Триллер-аниме держит внимание за счёт загадок, угрозы и ощущения, что ситуация может резко измениться. В этой подборке удобно искать напряжённые тайтлы с детективной, мистической или выживательной основой.',
  'детектив':'Детективные аниме строятся вокруг расследований, скрытых мотивов и поиска правды. Жанр подойдёт тем, кому нравится собирать детали, следить за логикой персонажей и ждать развязки.',
  'хоррор':'Хоррор-аниме работает через тревожную атмосферу, мистику, жестокие события и страх неизвестного. Такие тайтлы стоит выбирать, если хочется мрачного настроения и напряжения.',
  'спорт':'Спортивные аниме показывают тренировки, соперничество, командную работу и рост персонажей. Даже если спорт не главный интерес, такие тайтлы часто цепляют мотивацией и сильной драматургией.',
  'исэкай':'Исэкай-аниме отправляет героя в другой мир с новыми правилами, магией, прокачкой или неожиданной ролью. Это удобный жанр для тех, кто любит быстрый вход в приключение и развитие персонажа с нуля.',
  'сенен':'Сёнен-аниме обычно сочетает развитие героя, дружбу, соперничество и яркие конфликты. Это один из самых удобных жанров для старта, если хочется динамичного сериала с понятной целью и сильными персонажами.',
  'сеинен':'Сэйнэн чаще рассчитан на более взрослое восприятие: здесь могут быть сложнее темы, спокойнее темп и больше внимания к последствиям решений. Жанр хорошо подходит для зрителей, которым хочется зрелой истории.'
}

function genreKey(title){
  return safeText(title).toLowerCase().replace(/ё/g, 'е')
}

function sampleTitles(items = [], limit = 3){
  return uniqueList(items.map(item => item?.title), limit)
}

export function buildGenreSeoContent(title, items = []){
  const genre = safeText(title, 'Аниме')
  const count = Array.isArray(items) ? items.length : 0
  const examples = sampleTitles(items, 3)
  const intro = GENRE_DESCRIPTIONS[genreKey(genre)] || `${genre} — отдельное направление в каталоге AIanime, где собраны тайтлы с похожим настроением, темами и динамикой. Страница помогает быстро выбрать аниме на русском: от популярных сериалов до менее очевидных работ, которые подходят под этот жанр.`
  const exampleText = examples.length ? ` Среди заметных тайтлов в подборке: ${examples.join(', ')}.` : ''

  const faq = [
    {
      question:`Что посмотреть в жанре ${genre}?`,
      answer:`Начни с верхних карточек: они отсортированы по рейтингу и популярности внутри жанра ${genre}.${exampleText}`
    },
    {
      question:`Кому подойдут аниме в жанре ${genre}?`,
      answer:`Такие тайтлы подойдут зрителям, которым важны характерные темы жанра, узнаваемый вайб и быстрый переход к просмотру на русском.`
    },
    {
      question:`Сколько аниме в жанре ${genre} есть на AIanime?`,
      answer:`Сейчас на странице собрано ${count} тайтлов в этом жанре. Каталог может обновляться после синхронизации с источниками и расписанием.`
    }
  ]

  return {
    intro,
    lead:`${count} тайтлов в жанре ${genre}. Подборка помогает выбрать аниме по настроению, рейтингу и похожим темам без ручного поиска по всему каталогу.`,
    points:[
      `Сначала открывай тайтлы с высоким рейтингом и знакомыми жанрами — так проще попасть в нужный вайб.`,
      `Смотри на год, статус и количество серий: короткие сезоны удобны на вечер, онгоинги — для регулярного просмотра.`,
      `Используй похожие тайтлы на страницах аниме, чтобы продолжить подборку внутри жанра ${genre}.`
    ],
    faq
  }
}

export function buildStudioSeoContent(studio, items = []){
  const name = safeText(studio, 'Студия')
  const count = Array.isArray(items) ? items.length : 0
  const genres = uniqueList(items.flatMap(item => item?.genres || []), 5)
  const years = uniqueList(items.map(item => item?.year).filter(Boolean), 4)
  const examples = sampleTitles(items, 3)
  const genreText = genres.length ? ` Чаще всего в подборке встречаются жанры: ${genres.join(', ')}.` : ''
  const yearText = years.length ? ` В каталоге есть работы разных лет, включая ${years.join(', ')}.` : ''

  const faq = [
    {
      question:`Какие аниме выпустила студия ${name}?`,
      answer:`На этой странице собраны тайтлы студии ${name}, доступные в каталоге AIanime.${examples.length ? ` Среди них: ${examples.join(', ')}.` : ''}`
    },
    {
      question:`Сколько тайтлов студии ${name} есть на AIanime?`,
      answer:`Сейчас в каталоге показано ${count} тайтлов этой студии. Список может обновляться после синхронизации каталога.`
    },
    {
      question:`Как выбрать аниме студии ${name}?`,
      answer:`Ориентируйся на рейтинг, жанры, год выхода и статус. После открытия тайтла можно перейти к похожим аниме и плееру.`
    }
  ]

  return {
    intro:`${name} — студия, чьи тайтлы собраны на отдельной странице AIanime. Здесь удобно смотреть, какие работы студии уже есть в каталоге, сравнивать их по рейтингу, жанрам и году выхода.${genreText}${yearText}`,
    lead:`${count} тайтлов студии ${name}. Страница помогает быстро перейти к просмотру, найти сильные работы студии и продолжить подбор через похожие аниме.`,
    points:[
      `Для первого знакомства выбирай самые рейтинговые тайтлы студии ${name}.`,
      genres.length ? `Если важен вайб, начни с жанров: ${genres.slice(0, 3).join(', ')}.` : `Сравнивай карточки по жанрам и описанию, чтобы быстрее найти подходящий тайтл.`,
      `После просмотра открой блок похожих тайтлов — так проще найти аниме с близкой атмосферой.`
    ],
    faq
  }
}

function genrePhrase(item = {}){
  const genres = uniqueList(item?.genres || [], 4)
  return genres.length ? genres.join(', ') : 'аниме'
}

function episodePhrase(item = {}, playerOptions = []){
  const count = Number(item?.episodes || 0) || Math.max(...(playerOptions || []).map(option => Number(option?.episodeNumber || option?.episodesCount || 0)).filter(Boolean), 0)
  if(count > 1) return `${count} серий`
  if(String(item?.kind || '').toLowerCase() === 'movie') return 'полнометражный фильм'
  return 'серии указаны на странице тайтла'
}

export function buildAnimeSeoContent(item = {}, similar = [], playerOptions = []){
  const title = safeText(item.title || item.title_ru || item.originalTitle, 'Этот тайтл')
  const genres = genrePhrase(item)
  const episodes = episodePhrase(item, playerOptions)
  const studio = safeText(item.studio && item.studio !== '—' ? item.studio : '')
  const year = item.year ? `${item.year} год` : ''
  const similarTitles = sampleTitles(similar, 4)
  const similarText = similarTitles.length ? similarTitles.join(', ') : 'блок похожих тайтлов ниже на странице'
  const status = String(item.status || '').toLowerCase() === 'ongoing' ? 'онгоинг' : 'завершённый или доступный тайтл'

  const faq = [
    {
      question:`Сколько серий в «${title}»?`,
      answer:`На странице указано: ${episodes}. Если тайтл продолжает выходить, список серий может обновляться вместе с каталогом и плеером.`
    },
    {
      question:`В каком жанре аниме «${title}»?`,
      answer:`Основные жанры: ${genres}. По жанрам можно перейти к похожим подборкам в каталоге AIanime.`
    },
    {
      question:`Какие аниме похожи на «${title}»?`,
      answer:`Похожие тайтлы можно открыть в блоке ниже. Среди близких вариантов на странице могут быть: ${similarText}.`
    },
    {
      question:`Где смотреть «${title}» на русском?`,
      answer:`На странице «${title}» есть онлайн-плеер AIanime, информация о тайтле, жанры, рейтинг, похожие аниме и комментарии.`
    }
  ]

  return {
    lead:`«${title}» — ${status}${year ? ` (${year})` : ''} в жанрах ${genres}. Страница собрана так, чтобы быстро проверить описание, рейтинг, количество серий, похожие тайтлы и перейти к просмотру на русском.`,
    audience:`Тайтл подойдёт зрителям, которым важны ${genres.toLowerCase()} и понятный переход от описания к просмотру. Если ты выбираешь аниме по настроению, обрати внимание на жанры, похожие рекомендации и комментарии под плеером.`,
    why:[
      studio ? `За производство указана студия ${studio}, поэтому страницу удобно использовать и как вход в другие работы этой студии.` : `Жанры и похожие тайтлы помогают быстро понять, подходит ли история под нужный вайб.`,
      `Количество серий и статус помогают решить, смотреть тайтл целиком или следить за обновлениями.`,
      `Блок похожих аниме ниже помогает продолжить просмотр без возвращения к общему каталогу.`
    ],
    faq
  }
}

export const COLLECTION_SEO = [
  {
    title:'Если грустно',
    q:'эмоциональное тёплое аниме',
    description:'Тёплые и эмоциональные аниме для вечера, когда хочется мягкой истории, поддержки, романтики или спокойной драмы без лишнего шума.',
    filter:item => (item.genres || []).some(g => ['Драма','Романтика','Повседневность','Ияшикэй'].includes(g))
  },
  {
    title:'Хочу приключений',
    q:'приключения и экшен',
    description:'Динамичные тайтлы с путешествиями, экшеном, фэнтези и ощущением большой цели. Хороший выбор, когда хочется движения и ярких событий.',
    filter:item => (item.genres || []).some(g => ['Приключения','Экшен','Фэнтези','Исэкай'].includes(g))
  },
  {
    title:'Для отдыха',
    q:'лёгкое аниме на вечер',
    description:'Лёгкие аниме на вечер: комедия, повседневность, романтика и короткие сезоны, которые удобно смотреть без тяжёлого настроения.',
    filter:item => (item.genres || []).some(g => ['Комедия','Повседневность','Романтика','Ияшикэй'].includes(g)) || Number(item.episodes || 0) <= 13
  },
  {
    title:'Что-то новенькое',
    q:'популярные новинки',
    description:'Свежие и недавние тайтлы из каталога AIanime. Подборка подойдёт, если хочется посмотреть новые аниме последних сезонов.',
    filter:item => Number(item.year || 0) >= 2024
  },
  {
    title:'Шедевры',
    q:'лучшие аниме по рейтингу',
    description:'Сильные аниме с высоким рейтингом и заметной репутацией. Удобная точка входа для тех, кто хочет начать с проверенных тайтлов.',
    filter:item => Number(item.rating || item.score || 0) >= 8.6
  }
]

export function collectionFaq(collections = COLLECTION_SEO){
  return [
    {
      question:'Как выбрать аниме по настроению?',
      answer:'Открой подходящую подборку: для отдыха, грустного настроения, приключений, новинок или рейтинговых шедевров. Внутри каждой группы показаны тайтлы из каталога AIanime.'
    },
    {
      question:'Подборки на AIanime обновляются?',
      answer:'Да, подборки строятся на данных каталога: жанрах, годе выхода, рейтинге и доступных тайтлах. После обновления каталога состав может меняться.'
    },
    {
      question:'Можно ли получить персональную подборку?',
      answer:'Да, у каждой подборки есть переход в AI-подбор. Можно описать настроение или любимые тайтлы и получить более точные рекомендации.'
    }
  ]
}

export function buildYearSeoContent(year, items = []){
  const safeYear = Number(year)
  const count = Array.isArray(items) ? items.length : 0
  const ongoing = items.filter(item => String(item?.status || '').toLowerCase() === 'ongoing').length
  const genres = uniqueList(items.flatMap(item => item?.genres || []), 6)
  const top = sampleTitles(items, 4)
  const faq = [
    {
      question:`Какие аниме ${safeYear} года посмотреть?`,
      answer:`Начни с верхних карточек на странице: там собраны тайтлы ${safeYear} года из каталога AIanime, отсортированные по рейтингу и популярности.${top.length ? ` Среди заметных вариантов: ${top.join(', ')}.` : ''}`
    },
    {
      question:`Сколько аниме ${safeYear} года есть на AIanime?`,
      answer:`Сейчас на странице показано ${count} тайтлов ${safeYear} года${ongoing ? `, включая ${ongoing} онгоингов` : ''}.`
    },
    {
      question:`Как выбрать новое аниме ${safeYear} года?`,
      answer:`Смотри на жанры, рейтинг, статус и количество серий. Для быстрого выбора также можно перейти в похожие тайтлы на странице конкретного аниме.`
    }
  ]

  return {
    intro:`Аниме ${safeYear} года на AIanime — это отдельная подборка тайтлов по году выхода. Здесь удобно искать новинки, онгоинги и завершённые сезоны, сравнивать их по рейтингу, жанрам и количеству серий.${genres.length ? ` Основные жанры в подборке: ${genres.join(', ')}.` : ''}`,
    lead:`${count} тайтлов ${safeYear} года в каталоге. Страница помогает быстро выбрать новое аниме и перейти к просмотру на русском.`,
    faq
  }
}

export function publicYearList(currentYear = new Date().getFullYear()){
  const year = Number(currentYear) || 2026
  return [year, year - 1, year - 2, year - 3].filter(value => value >= 1990 && value <= 2100)
}
