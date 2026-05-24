const posterSet = ['/posters/magic2.svg','/posters/onepiece.svg','/posters/demons.svg','/posters/solo.svg','/posters/stone.svg','/posters/marriage.svg','/posters/name.svg','/posters/oshi.svg']

export const anime = [
  { id:1, shikimoriId:40748, slug:'magic-battle-2', title:'Магическая битва 2', originalTitle:'Jujutsu Kaisen 2nd Season', meta:'2 сезон • 23 серии', status:'completed', kind:'tv', year:2023, rating:'9.1', score:9.1, episodes:23, genres:['Экшен','Сверхъестественное','Школа'], poster:'/posters/magic2.svg', banner:'/banners/hero.svg', progress:0, studio:'MAPPA', nextEpisode:'—', description:'Продолжение тёмного сверхъестественного экшена про магов, проклятия и цену силы.', mood:['dark','action','popular'], episodesList:[1,2,3,4,5,6,7,8] },
  { id:2, shikimoriId:21, slug:'one-piece', title:'Ван-Пис', originalTitle:'One Piece', meta:'1081 серия', status:'ongoing', kind:'tv', year:1999, rating:'9.0', score:9.0, episodes:1081, genres:['Приключения','Комедия','Фэнтези'], poster:'/posters/onepiece.svg', banner:'/banners/hero.svg', progress:60, studio:'Toei Animation', nextEpisode:'Сб 16:00', description:'Большое морское приключение о пиратской команде и поиске легендарного сокровища.', mood:['adventure','long','classic'], episodesList:[1076,1077,1078,1079,1080,1081] },
  { id:3, shikimoriId:38000, slug:'demon-slayer', title:'Клинок, рассекающий демонов', originalTitle:'Kimetsu no Yaiba', meta:'4 сезон • 12 серия', status:'ongoing', kind:'tv', year:2024, rating:'8.8', score:8.8, episodes:12, genres:['Экшен','Драма','Сёнен'], poster:'/posters/demons.svg', banner:'/banners/hero.svg', progress:75, studio:'ufotable', nextEpisode:'Пт 17:00', description:'Стильный экшен о борьбе с демонами, семье и внутренней стойкости.', mood:['action','beautiful','emotional'], episodesList:[1,2,3,4,5,6,7,8,9,10,11,12] },
  { id:4, shikimoriId:52299, slug:'solo-leveling', title:'Поднятие уровня в одиночку', originalTitle:'Solo Leveling', meta:'1 сезон • 12 серий', status:'completed', kind:'tv', year:2024, rating:'8.9', score:8.9, episodes:12, genres:['Экшен','Фэнтези','Игры'], poster:'/posters/solo.svg', banner:'/banners/hero.svg', progress:45, studio:'A-1 Pictures', nextEpisode:'—', description:'Слабый охотник получает систему прокачки и превращается в сильнейшего игрока.', mood:['power','action','fast'], episodesList:[1,2,3,4,5,6,7,8,9,10,11,12] },
  { id:5, shikimoriId:38691, slug:'dr-stone', title:'Доктор Стоун', originalTitle:'Dr. Stone', meta:'Новый мир', status:'completed', kind:'tv', year:2023, rating:'8.7', score:8.7, episodes:22, genres:['Приключения','Фантастика','Комедия'], poster:'/posters/stone.svg', banner:'/banners/hero.svg', progress:0, studio:'TMS', nextEpisode:'—', description:'Наука, цивилизация с нуля и умный герой в мире после окаменения человечества.', mood:['smart','adventure','light'], episodesList:[1,2,3,4,5,6,7,8] },
  { id:6, shikimoriId:51552, slug:'happy-marriage', title:'Мой счастливый брак', originalTitle:'Watashi no Shiawase na Kekkon', meta:'2 сезон', status:'ongoing', kind:'tv', year:2025, rating:'8.6', score:8.6, episodes:12, genres:['Романтика','Драма','Историческое'], poster:'/posters/marriage.svg', banner:'/banners/hero.svg', progress:30, studio:'Kinema Citrus', nextEpisode:'Вс 19:30', description:'Мягкая романтическая драма о доверии, внутренней силе и новой жизни.', mood:['romance','soft','emotional'], episodesList:[1,2,3,4] },
  { id:7, shikimoriId:32281, slug:'your-name', title:'Твоё имя', originalTitle:'Kimi no Na wa.', meta:'Фильм', status:'released', kind:'movie', year:2016, rating:'8.8', score:8.8, episodes:1, genres:['Романтика','Драма','Сверхъестественное'], poster:'/posters/name.svg', banner:'/banners/watch.svg', progress:66, studio:'CoMix Wave', nextEpisode:'—', description:'Эмоциональная история о связи двух людей, времени и случайности.', mood:['romance','beautiful','emotional'], episodesList:[1] },
  { id:8, shikimoriId:52034, slug:'oshi-no-ko', title:'Звёздное дитя', originalTitle:'Oshi no Ko', meta:'2 сезон', status:'ongoing', kind:'tv', year:2024, rating:'8.8', score:8.8, episodes:13, genres:['Драма','Музыка','Сверхъестественное'], poster:'/posters/oshi.svg', banner:'/banners/hero.svg', progress:0, studio:'Doga Kobo', nextEpisode:'Ср 21:00', description:'Закулисье индустрии айдолов, слава, травмы и тайны шоу-бизнеса.', mood:['drama','dark','music'], episodesList:[1,2,3,4,5,6] },
  ...Array.from({length:32}).map((_,i)=>({
    id:100+i,
    shikimoriId:1000+i,
    slug:`catalog-title-${i+1}`,
    title:['Атака титанов','Стальной алхимик','Тетрадь смерти','Хантер х Хантер','Евангелион','Вайолет Эвергарден','Блич','Моб Психо 100'][i%8] + ` ${i>7?Math.floor(i/8)+1:''}`.trim(),
    originalTitle:`Anime Seed ${i+1}`,
    meta:[`${12+i%12} серий`,'Фильм','2 сезон','Онгоинг'][i%4],
    status:['completed','ongoing','released'][i%3],
    kind:['tv','movie','ova'][i%3],
    year:2016+(i%10),
    rating:(8.1+(i%9)/10).toFixed(1),
    score:8.1+(i%9)/10,
    episodes:i%3===1?1:12+i%18,
    genres:[['Экшен','Драма'],['Романтика','Повседневность'],['Фэнтези','Приключения'],['Психология','Триллер']][i%4],
    poster:posterSet[i%posterSet.length],
    banner:i%2?'/banners/watch.svg':'/banners/hero.svg',
    progress:i%5===0?20+(i%70):0,
    studio:['MAPPA','Madhouse','Bones','Kyoto Animation'][i%4],
    nextEpisode:i%3===1?'—':['Пн 18:00','Вт 20:30','Пт 17:10'][i%3],
    description:'Seed-тайтл для массового каталога. После запуска cron/sync эти записи заменяются или дополняются данными из Jikan/MAL и player providers.',
    mood:[['dark','action'],['cozy','romance'],['adventure','fantasy'],['smart','thriller']][i%4],
    episodesList:Array.from({length:Math.min(12, 6+i%10)},(_,j)=>j+1)
  }))
]

export const schedule = [
  ['15:30','Моя геройская академия','7 сезон • 6 серия','/posters/onepiece.svg'],
  ['16:00','Ван-Пис','1081 серия','/posters/onepiece.svg'],
  ['17:00','Клинок, рассекающий демонов','4 сезон • 12 серия','/posters/demons.svg'],
  ['19:30','Мой счастливый брак','2 сезон • 4 серия','/posters/marriage.svg'],
  ['21:00','Звёздное дитя','2 сезон • 6 серия','/posters/oshi.svg']
]

export const collections = [
  ['Если грустно','Тёплые и добрые аниме','♡'],
  ['Хочу приключений','Экшен и захватывающие истории','🚀'],
  ['Для отдыха','Лёгкие и уютные аниме','☕'],
  ['Что-то новенькое','Популярное 2024 года','☆'],
  ['Шедевры','Лучшие аниме всех времён','♕']
]

export function getAnimeBySlug(slug){return anime.find(a=>a.slug===slug) || anime[0]}
export function getSimilar(item){return anime.filter(a=>a.slug!==item.slug && a.genres.some(g=>item.genres.includes(g))).slice(0,5)}
