// Sprachen: Deutsch, Türkçe, English.
// Nur Oberflaeche, Warnungen und Sprechblasen werden uebersetzt –
// Schilder IN der Spielwelt bleiben deutsch (das Spiel spielt in Bremen).

export const LANGS = [['de', 'Deutsch'], ['tr', 'Türkçe'], ['en', 'English']];

const S = {
  de: {
    lead: 'Die Radtour mit Kind – auf echten Bremer Straßen',
    level: 'Level', go: "Los geht's!", upTo: 'bis', loading: 'Bremen wird aufgebaut …', loadingSub: 'Echte Gebäude, Luftbilder und Fotos werden geladen',
    kSteer: 'Lenken', kPedal: 'Treten', kBrake: 'Bremsen', kNitro: 'Nitro (3 Kanister sammeln)', kBell: 'Klingel', kPause: 'Pause', space: 'Leertaste',
    credit: 'Kartendaten © OpenStreetMap-Mitwirkende · Luftbilder: Landesamt GeoInformation Bremen (CC BY) · Fotos: Wikimedia Commons (siehe assets/photos/CREDITS*.md)',
    pause: 'Pause – P zum Weiterfahren', toGoal: 'm bis zum Ziel', sight: 'SEHENSWÜRDIGKEIT', photo: 'FOTO VON HIER', left: '← links', right: 'rechts →',
    nitroCount: 'Nitro: {n} / {m} Kanister', nitroReady: 'LEERTASTE drücken = NITRO!', nitroOn: 'NITRO!!!', tNitroReady: 'NITRO BEREIT!', tCan: 'Nitro-Kanister +1', tHeart: 'Herz +1', start: 'Los!',
    winTitle: 'Ziel erreicht! 🎉', loseTitle: 'Oh nein – Tour beendet!',
    winText: 'Du bist mit deinem Kind sicher am Ziel <b>{goal}</b> angekommen.<br>Zeit: <b>{time}</b> · Herzen: <b>{hearts}/3</b> · Nitro-Kanister: <b>{cans}</b>',
    loseText: 'Zu viele Zusammenstöße. Nach <b>{m} m</b> war Schluss.<br>Tipp: Vor Zebrastreifen und Baustellen bremsen (↓).',
    again: 'Nochmal fahren', retry: 'Neuer Versuch', next: 'Weiter zu Level {n}', menu: 'Menü', allDone: 'Alle Level geschafft – weitere folgen!',
    stats: { speed: 'Tempo', agile: 'Wendigkeit', brake: 'Bremse' },
    veh: {
      fahrrad: ['Fahrrad', 'Der Klassiker mit Kindersitz. Ausgewogen und zuverlässig.'],
      ebike: ['E-Bike', 'Mit Motor-Unterstützung: schnell am Ziel, aber schwerer zu lenken.'],
      scooter: ['E-Scooter', 'Klein und superwendig – das Kind steht vorne auf dem Trittbrett.'],
    },
    levels: {
      1: ['Überseestadt Nord', 'Vom Waller Sand über den Kommodore-Johnsen-Boulevard bis zum Europahafen'],
      2: ['Innenstadt', 'Vom Europahafen über Faulenstraße und Obernstraße bis zum Marktplatz mit Roland'],
    },
    warn: {
      baustelle: 'Baustelle voraus!', parked: 'Parkendes Auto!', slowcar: 'Langsames Fahrzeug – überholen!', van: 'Lieferwagen in zweiter Reihe!',
      cyclist: 'Radfahrer voraus!', pedestrian: 'Zebrastreifen! Fußgänger haben Vorrang!', pothole: 'Schlagloch!', bin: 'Mülltonne auf dem Weg!',
      oncoming: 'Gegenverkehr!', walker: 'Fußgängerzone! Rücksicht nehmen!', ampel: 'Rote Ampel! Anhalten!', ufo: 'UNBEKANNTES FLUGOBJEKT ÜBER DER STRASSE!', affen: 'AFFEN AUF DER FAHRBAHN!',
      dino: 'EIN DINOSAURIER IN DER INNENSTADT!', pinguine: 'PINGUIN-PARADE KREUZT DIE STRASSE!',
    },
    hit: {
      baustelle: 'In die Absperrung gefahren!', parked: 'Auto gestreift!', slowcar: 'Aufgefahren!', van: 'Lieferwagen gerammt!', cyclist: 'Zusammenstoß mit Radfahrer!',
      pedestrian: 'Fußgänger angefahren – langsam am Zebrastreifen!', pothole: 'Rumms! Schlagloch erwischt.', bin: 'Mülltonne umgefahren!', oncoming: 'Frontal im Gegenverkehr!',
      ampel: 'Bei Rot gefahren! Verwarnung von der Polizei.', beam: 'Vom Traktorstrahl erwischt!', alien: 'Außerirdischen angerempelt!', monkey: 'Affe im Weg!',
      banana: 'Auf der Bananenschale ausgerutscht!', walker: 'Fußgänger angerempelt!', dino: 'Dem Dino vor die Füße gefahren!', pinguin: 'Pinguin angerempelt!',
    },
    kid: {
      start: ['Los, Papa!', 'Juhu, Fahrradtour!', 'Moin Bremen!'],
      idle: ['Papa, schneller!', 'Guck mal, die Weser!', 'Sind wir bald da?', 'Ich will ein Eis!', 'Klingel mal, Papa!', 'Da ist ein Schiff!'],
      hit: ['Aua! Papa, pass auf!', 'Huch!', 'Nicht so wild, Papa!'], nitroReady: ['Papa, drück den Turbo!'], nitro: ['WUHUUU!', 'Schneller als die Straßenbahn!'],
      pickup: ['Noch einer!', 'Hab ihn!'], ufo: ['Papa!! Ein UFO!!', 'Sind das Marsmenschen?'], affen: ['Papa, guck mal, AFFEN!', 'Die klauen Bananen!'],
      dino: ['PAPA!!! EIN DINO!!!', 'Der ist ja riesig!'], pinguine: ['Oh, Pinguine! Wie süß!', 'Nicht überfahren, Papa!'],
      landmark: ['Oh, das kenn ich!', 'Wie groß!'], win: ['Geschafft! Nochmal, Papa!'],
    },
  },
  tr: {
    lead: 'Çocukla bisiklet turu – gerçek Bremen sokaklarında',
    level: 'Bölüm', go: 'Hadi başlayalım!', upTo: 'en fazla', loading: 'Bremen kuruluyor …', loadingSub: 'Gerçek binalar, hava fotoğrafları ve fotoğraflar yükleniyor',
    kSteer: 'Yön', kPedal: 'Pedal', kBrake: 'Fren', kNitro: 'Nitro (3 tüp topla)', kBell: 'Zil', kPause: 'Duraklat', space: 'Boşluk',
    credit: 'Harita verisi © OpenStreetMap katkıcıları · Hava fotoğrafları: Landesamt GeoInformation Bremen (CC BY) · Fotoğraflar: Wikimedia Commons (bkz. assets/photos/CREDITS*.md)',
    pause: 'Duraklatıldı – devam için P', toGoal: 'm hedefe kaldı', sight: 'GÖRÜLECEK YER', photo: 'BURADAN FOTOĞRAF', left: '← solda', right: 'sağda →',
    nitroCount: 'Nitro: {n} / {m} tüp', nitroReady: 'BOŞLUK tuşuna bas = NİTRO!', nitroOn: 'NİTRO!!!', tNitroReady: 'NİTRO HAZIR!', tCan: 'Nitro tüpü +1', tHeart: 'Kalp +1', start: 'Başla!',
    winTitle: 'Hedefe ulaştın! 🎉', loseTitle: 'Eyvah – tur bitti!',
    winText: 'Çocuğunla birlikte güvenle <b>{goal}</b> hedefine vardın.<br>Süre: <b>{time}</b> · Kalp: <b>{hearts}/3</b> · Nitro tüpü: <b>{cans}</b>',
    loseText: 'Çok fazla çarpışma. <b>{m} m</b> sonra tur bitti.<br>İpucu: Yaya geçidi ve şantiyelerden önce fren yap (↓).',
    again: 'Tekrar sür', retry: 'Yeniden dene', next: '{n}. bölüme geç', menu: 'Menü', allDone: 'Tüm bölümler tamam – yenileri gelecek!',
    stats: { speed: 'Hız', agile: 'Çeviklik', brake: 'Fren' },
    veh: {
      fahrrad: ['Bisiklet', 'Çocuk koltuklu klasik bisiklet. Dengeli ve güvenilir.'],
      ebike: ['Elektrikli bisiklet', 'Motor desteğiyle hedefe hızlı varır, ama yönlendirmesi daha zor.'],
      scooter: ['Elektrikli scooter', 'Küçük ve çok çevik – çocuk önde, basamakta ayakta durur.'],
    },
    levels: {
      1: ['Überseestadt Nord', "Waller Sand'dan Kommodore-Johnsen-Boulevard üzerinden Europahafen'e"],
      2: ['Innenstadt (Şehir merkezi)', "Europahafen'den Faulenstraße ve Obernstraße üzerinden Roland heykelli Marktplatz'a"],
    },
    warn: {
      baustelle: 'İleride şantiye!', parked: 'Park etmiş araba!', slowcar: 'Yavaş araç – solla!', van: 'Çift sıra park etmiş kurye aracı!',
      cyclist: 'İleride bisikletli!', pedestrian: 'Yaya geçidi! Öncelik yayaların!', pothole: 'Çukur!', bin: 'Yolda çöp kutusu!',
      oncoming: 'Karşıdan araç geliyor!', walker: 'Yaya bölgesi! Yayalara dikkat!', ampel: 'Kırmızı ışık! Dur!', ufo: 'YOLUN ÜSTÜNDE TANIMLANAMAYAN UÇAN CİSİM!', affen: 'YOLDA MAYMUNLAR VAR!',
      dino: 'ŞEHİR MERKEZİNDE DİNOZOR!', pinguine: 'PENGUEN GEÇİDİ YOLU KESİYOR!',
    },
    hit: {
      baustelle: 'Bariyere çarptın!', parked: 'Arabaya sürttün!', slowcar: 'Arkadan çarptın!', van: 'Kurye aracına çarptın!', cyclist: 'Bisikletliyle çarpıştın!',
      pedestrian: 'Yayaya çarptın – yaya geçidinde yavaşla!', pothole: 'Güm! Çukura girdin.', bin: 'Çöp kutusunu devirdin!', oncoming: 'Karşıdan gelen araçla kafa kafaya!',
      ampel: 'Kırmızıda geçtin! Polisten uyarı aldın.', beam: 'Çekim ışınına yakalandın!', alien: 'Uzaylıya çarptın!', monkey: 'Yolda maymun!',
      banana: 'Muz kabuğuna basıp kaydın!', walker: 'Yayaya çarptın!', dino: 'Dinozorun ayağının dibine girdin!', pinguin: 'Penguene çarptın!',
    },
    kid: {
      start: ['Hadi baba!', 'Yaşasın, bisiklet turu!', 'Moin Bremen!'],
      idle: ['Baba, daha hızlı!', 'Bak, Weser nehri!', 'Daha gelmedik mi?', 'Dondurma istiyorum!', 'Zili çal baba!', 'Orada gemi var!'],
      hit: ['Ay! Baba dikkat et!', 'Hoppala!', 'Bu kadar hızlı olmasın baba!'], nitroReady: ['Baba, turboya bas!'], nitro: ['VUHUUU!', 'Tramvaydan bile hızlıyız!'],
      pickup: ['Bir tane daha!', 'Yakaladım!'], ufo: ['Baba!! UFO!!', 'Bunlar Marslı mı?'], affen: ['Baba bak, MAYMUNLAR!', 'Muzları çalıyorlar!'],
      dino: ['BABA!!! DİNOZOR!!!', 'Ne kadar da kocaman!'], pinguine: ['Aa, penguenler! Çok tatlı!', 'Ezme onları baba!'],
      landmark: ['Aa, burayı biliyorum!', 'Ne kadar büyük!'], win: ['Başardık! Bir daha baba!'],
    },
  },
  en: {
    lead: 'A bike ride with your kid – on real Bremen streets',
    level: 'Level', go: "Let's go!", upTo: 'up to', loading: 'Building Bremen …', loadingSub: 'Loading real buildings, aerial imagery and photos',
    kSteer: 'Steer', kPedal: 'Pedal', kBrake: 'Brake', kNitro: 'Nitro (collect 3 canisters)', kBell: 'Bell', kPause: 'Pause', space: 'Space',
    credit: 'Map data © OpenStreetMap contributors · Aerial imagery: Landesamt GeoInformation Bremen (CC BY) · Photos: Wikimedia Commons (see assets/photos/CREDITS*.md)',
    pause: 'Paused – press P to continue', toGoal: 'm to the finish', sight: 'LANDMARK', photo: 'PHOTO FROM HERE', left: '← left', right: 'right →',
    nitroCount: 'Nitro: {n} / {m} canisters', nitroReady: 'Press SPACE = NITRO!', nitroOn: 'NITRO!!!', tNitroReady: 'NITRO READY!', tCan: 'Nitro canister +1', tHeart: 'Heart +1', start: 'Go!',
    winTitle: 'You made it! 🎉', loseTitle: 'Oh no – ride over!',
    winText: 'You and your kid arrived safely at <b>{goal}</b>.<br>Time: <b>{time}</b> · Hearts: <b>{hearts}/3</b> · Nitro canisters: <b>{cans}</b>',
    loseText: 'Too many crashes. The ride ended after <b>{m} m</b>.<br>Tip: brake (↓) before zebra crossings and roadworks.',
    again: 'Ride again', retry: 'Try again', next: 'Continue to level {n}', menu: 'Menu', allDone: 'All levels done – more to come!',
    stats: { speed: 'Speed', agile: 'Agility', brake: 'Brake' },
    veh: {
      fahrrad: ['Bicycle', 'The classic with a child seat. Balanced and reliable.'],
      ebike: ['E-bike', 'Motor assistance gets you there fast, but it is harder to steer.'],
      scooter: ['E-scooter', 'Small and very agile – the kid stands in front on the deck.'],
    },
    levels: {
      1: ['Überseestadt Nord', 'From Waller Sand along Kommodore-Johnsen-Boulevard to the Europahafen'],
      2: ['Innenstadt (city centre)', 'From the Europahafen via Faulenstraße and Obernstraße to the Marktplatz with the Roland statue'],
    },
    warn: {
      baustelle: 'Roadworks ahead!', parked: 'Parked car!', slowcar: 'Slow vehicle – overtake!', van: 'Double-parked delivery van!',
      cyclist: 'Cyclist ahead!', pedestrian: 'Zebra crossing! Pedestrians have priority!', pothole: 'Pothole!', bin: 'Rubbish bin in the way!',
      oncoming: 'Oncoming traffic!', walker: 'Pedestrian zone! Watch out for people!', ampel: 'Red light! Stop!', ufo: 'UNIDENTIFIED FLYING OBJECT OVER THE ROAD!', affen: 'MONKEYS ON THE ROAD!',
      dino: 'A DINOSAUR IN THE CITY CENTRE!', pinguine: 'PENGUIN PARADE CROSSING THE STREET!',
    },
    hit: {
      baustelle: 'Crashed into the barrier!', parked: 'Scraped a car!', slowcar: 'Rear-ended it!', van: 'Hit the delivery van!', cyclist: 'Collided with a cyclist!',
      pedestrian: 'Hit a pedestrian – slow down at crossings!', pothole: 'Thump! Hit a pothole.', bin: 'Knocked over a bin!', oncoming: 'Head-on with oncoming traffic!',
      ampel: 'Ran a red light! Warning from the police.', beam: 'Caught in the tractor beam!', alien: 'Bumped into an alien!', monkey: 'Monkey in the way!',
      banana: 'Slipped on a banana peel!', walker: 'Bumped into a pedestrian!', dino: 'Rode right under the dinosaur!', pinguin: 'Bumped into a penguin!',
    },
    kid: {
      start: ["Let's go, Dad!", 'Yay, a bike ride!', 'Moin Bremen!'],
      idle: ['Faster, Dad!', 'Look, the Weser!', 'Are we there yet?', 'I want ice cream!', 'Ring the bell, Dad!', "There's a ship!"],
      hit: ['Ouch! Dad, watch out!', 'Whoa!', 'Not so wild, Dad!'], nitroReady: ['Dad, hit the turbo!'], nitro: ['WOOHOO!', 'Faster than the tram!'],
      pickup: ['One more!', 'Got it!'], ufo: ['Dad!! A UFO!!', 'Are those Martians?'], affen: ['Dad, look, MONKEYS!', "They're stealing bananas!"],
      dino: ['DAD!!! A DINOSAUR!!!', "It's huge!"], pinguine: ['Oh, penguins! So cute!', "Don't run them over, Dad!"],
      landmark: ['Oh, I know that one!', 'So big!'], win: ['We did it! Again, Dad!'],
    },
  },
};

let cur = 'de';
try { const s = localStorage.getItem('lang'); cur = S[s] ? s : (S[(navigator.language || 'de').slice(0, 2)] ? navigator.language.slice(0, 2) : 'de'); } catch (e) { /* ohne Speicher: Deutsch */ }

export const lang = () => cur;
export function setLang(l) { if (S[l]) { cur = l; try { localStorage.setItem('lang', l); } catch (e) { /* egal */ } document.documentElement.lang = l; } }
// t('warn.ufo') oder t('nitroCount', {n: 1, m: 3})
export function t(key, vars) {
  let v = key.split('.').reduce((o, k) => (o == null ? o : o[k]), S[cur]);
  if (v == null) v = key.split('.').reduce((o, k) => (o == null ? o : o[k]), S.de);
  if (typeof v === 'string' && vars) v = v.replace(/\{(\w+)\}/g, (_, k) => vars[k]);
  return v;
}
