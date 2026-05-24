const GENRE_MAP = new Map(Object.entries({
  'Action':'Экшен',
  'Adventure':'Приключения',
  'Avant Garde':'Авангард',
  'Award Winning':'Лауреаты премий',
  'Boys Love':'Бойс-лав',
  'Comedy':'Комедия',
  'Drama':'Драма',
  'Fantasy':'Фэнтези',
  'Girls Love':'Гёрлс-лав',
  'Gourmet':'Гурман',
  'Horror':'Хоррор',
  'Mystery':'Детектив',
  'Romance':'Романтика',
  'Sci-Fi':'Фантастика',
  'Slice of Life':'Повседневность',
  'Sports':'Спорт',
  'Supernatural':'Сверхъестественное',
  'Suspense':'Триллер',
  'Ecchi':'Этти',
  'Erotica':'Эротика',
  'Hentai':'Хентай',
  'Adult Cast':'Взрослые персонажи',
  'Anthropomorphic':'Антропоморфизм',
  'CGDCT':'Милые девочки',
  'Childcare':'Забота о детях',
  'Combat Sports':'Боевой спорт',
  'Crossdressing':'Кроссдрессинг',
  'Delinquents':'Хулиганы',
  'Detective':'Детектив',
  'Educational':'Образовательное',
  'Gag Humor':'Гэг-юмор',
  'Gore':'Жестокость',
  'Harem':'Гарем',
  'High Stakes Game':'Игры на выживание',
  'Historical':'Историческое',
  'Idols (Female)':'Айдолы',
  'Idols (Male)':'Айдолы',
  'Isekai':'Исэкай',
  'Iyashikei':'Ияшикэй',
  'Love Polygon':'Любовный многоугольник',
  'Magical Sex Shift':'Магическая смена пола',
  'Mahou Shoujo':'Махо-сёдзё',
  'Martial Arts':'Боевые искусства',
  'Mecha':'Меха',
  'Medical':'Медицина',
  'Military':'Военное',
  'Music':'Музыка',
  'Mythology':'Мифология',
  'Organized Crime':'Криминал',
  'Otaku Culture':'Отаку-культура',
  'Parody':'Пародия',
  'Performing Arts':'Исполнительское искусство',
  'Pets':'Питомцы',
  'Psychological':'Психология',
  'Racing':'Гонки',
  'Reincarnation':'Реинкарнация',
  'Reverse Harem':'Обратный гарем',
  'Romantic Subtext':'Романтический подтекст',
  'Samurai':'Самураи',
  'School':'Школа',
  'Showbiz':'Шоу-бизнес',
  'Space':'Космос',
  'Strategy Game':'Стратегии',
  'Super Power':'Суперсилы',
  'Survival':'Выживание',
  'Team Sports':'Командный спорт',
  'Time Travel':'Путешествия во времени',
  'Vampire':'Вампиры',
  'Video Game':'Видеоигры',
  'Villainess':'Злодейка',
  'Visual Arts':'Визуальное искусство',
  'Workplace':'Работа',
  'Josei':'Дзёсэй',
  'Kids':'Детское',
  'Seinen':'Сэйнэн',
  'Shoujo':'Сёдзё',
  'Shounen':'Сёнен',
  'Shoujo Ai':'Сёдзё-ай',
  'Shounen Ai':'Сёнен-ай',
  'Game':'Игры',
  'Police':'Полиция',
  'Dementia':'Психоделика',
  'Cars':'Автомобили',
  'Magic':'Магия',
  'Demons':'Демоны',
  'Yaoi':'Яой',
  'Yuri':'Юри'
}))

const DESCRIPTION_HINTS = [
  [['Экшен','Боевые искусства','Суперсилы','Военное'], 'динамичные сражения, рост героев и напряжённые столкновения'],
  [['Приключения','Фэнтези','Исэкай'], 'путешествия, необычные миры и ощущение большого приключения'],
  [['Романтика','Романтический подтекст','Любовный многоугольник'], 'чувства, отношения и постепенное сближение персонажей'],
  [['Драма','Психология'], 'эмоциональные конфликты, внутренний выбор и сильные переживания героев'],
  [['Триллер','Детектив','Хоррор','Выживание'], 'загадки, напряжение и атмосферу постоянной неопределённости'],
  [['Комедия','Гэг-юмор','Пародия'], 'лёгкий юмор, живые ситуации и яркую динамику между героями'],
  [['Повседневность','Ияшикэй','Школа','Работа'], 'повседневную атмосферу, уютные сцены и внимание к характеру персонажей'],
  [['Фантастика','Меха','Космос','Видеоигры'], 'технологии, фантастические идеи и необычные правила мира'],
  [['Музыка','Айдолы','Исполнительское искусство','Шоу-бизнес'], 'творчество, сцену, закулисье и личные амбиции персонажей'],
  [['Спорт','Командный спорт','Гонки','Боевой спорт'], 'соревнования, командный дух и путь к победе']
]

function hasCyrillic(value){
  return /[а-яё]/i.test(String(value || ''))
}

function clean(value){
  return String(value || '').replace(/\s+/g, ' ').trim()
}

function titleCaseFallback(value){
  const text = clean(value)
  if(!text) return ''
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export function translateGenre(genre){
  const value = clean(genre)
  if(!value) return null
  if(hasCyrillic(value)) return value
  return GENRE_MAP.get(value) || GENRE_MAP.get(titleCaseFallback(value)) || value
}

export function translateGenres(genres){
  const list = Array.isArray(genres)
    ? genres
    : typeof genres === 'string'
      ? genres.split(',')
      : []

  const result = []
  const seen = new Set()

  for(const item of list){
    const translated = translateGenre(item)
    if(!translated) continue
    const key = translated.toLowerCase()
    if(seen.has(key)) continue
    seen.add(key)
    result.push(translated)
  }

  return result.length ? result : ['Аниме']
}

export function kindRu(kind){
  const raw = String(kind || '').toLowerCase()
  if(raw === 'movie') return 'фильм'
  if(raw === 'ova') return 'OVA'
  if(raw === 'ona') return 'ONA'
  if(raw === 'special') return 'спешл'
  if(raw === 'music') return 'музыкальный клип'
  return 'сериал'
}

export function statusRu(status){
  const raw = String(status || '').toLowerCase()
  if(raw === 'ongoing') return 'тайтл продолжает выходить'
  if(raw === 'anons') return 'тайтл находится в анонсе'
  if(raw === 'completed' || raw === 'released') return 'тайтл уже завершён'
  return 'тайтл доступен в каталоге'
}

function descriptionFocus(genres){
  const list = translateGenres(genres)
  for(const [keys, text] of DESCRIPTION_HINTS){
    if(keys.some(key => list.includes(key))) return text
  }
  return 'атмосферу истории, развитие персонажей и узнаваемый аниме-вайб'
}

export function makeRussianDescription(item = {}){
  const title = clean(item.title_ru || item.displayTitle || item.title || item.original_title || item.originalTitle || 'Этот тайтл')
  const original = clean(item.title_orig_kodik || item.original_title || item.originalTitle || '')
  const genres = translateGenres(item.genres).slice(0, 4)
  const year = item.year ? ` ${item.year} года` : ''
  const type = kindRu(item.kind)
  const status = statusRu(item.status)
  const genreText = genres.length ? ` в жанрах ${genres.join(', ')}` : ''
  const focus = descriptionFocus(genres)
  const episodes = Number(item.episodes || 0) > 1 ? ` В сезоне указано ${Number(item.episodes)} серий.` : ''
  const originalPart = original && original !== title ? ` Оригинальное название — ${original}.` : ''

  return `«${title}» — аниме-${type}${year}${genreText}. ${title} подойдёт зрителям, которым нравятся ${focus}. ${status}.${episodes}${originalPart}`.replace(/\s+/g, ' ').trim()
}

export function preferRussianDescription(item = {}){
  const ru = clean(item.description_ru || item.descriptionRu)
  if(ru && hasCyrillic(ru)) return ru
  return makeRussianDescription(item)
}

export function needsRussianDescription(value){
  const text = clean(value)
  if(!text) return true
  if(!hasCyrillic(text)) return true
  if(text.length < 80) return true
  return false
}
