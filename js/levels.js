// ===================================================================
//  Level- und Fahrzeug-Konfiguration
//  Hier kann man spaeter Level, Ueberraschungen und Fahrzeuge aendern,
//  ohne den restlichen Code anzufassen.
// ===================================================================

export const VEHICLES = [
  {
    id: 'fahrrad', icon: '🚲',
    vmax: 8.5, cruise: 5.5, accel: 2.4, brake: 8, steer: 4.6, halfWidth: 0.36, eye: 1.55,
    stats: { speed: 3, agile: 3, brake: 4 },
  },
  {
    id: 'ebike', icon: '⚡',
    vmax: 11, cruise: 7.5, accel: 4.5, brake: 7, steer: 3.8, halfWidth: 0.38, eye: 1.58,
    stats: { speed: 5, agile: 2, brake: 3 },
  },
  {
    id: 'scooter', icon: '🛴',
    vmax: 7.5, cruise: 5.5, accel: 3.6, brake: 5.5, steer: 6.4, halfWidth: 0.28, eye: 1.62,
    stats: { speed: 2, agile: 5, brake: 2 },
  },
];

export const NITRO = { needed: 3, duration: 4.5, factor: 2.3 };

// Ueberraschungs-Typen, die das Spiel kennt: 'ufo', 'affen', 'dino', 'pinguine'
// "at" = Position auf der Strecke (0 = Start, 1 = Ziel)
export const LEVELS = [
  {
    id: 1,
    // Titel/Untertitel stehen (dreisprachig) in i18n.js unter levels[id]
    startName: 'Überseestadt Nord', finishName: 'Europahafen',   // Schilder in der Welt (deutsch)
    data: 'data/level1.json',
    seed: 2026,
    obstacleGap: [26, 48],      // Abstand zwischen Hindernissen in Metern (min, max)
    oncomingEvery: [5, 10],     // Sekunden zwischen Gegenverkehr
    pedestrianChance: 0.45,     // Anteil der echten Zebrastreifen mit Fussgaenger
    nitroEvery: 170,            // Meter zwischen Nitro-Kanistern
    surprises: [
      { type: 'ufo', at: 0.36 },
      { type: 'affen', at: 0.71 },
    ],
    // Echte Orte mit Foto (building = Name des Gebaeudes in OpenStreetMap, oder s = Meter)
    landmarks: [
      { s: 25, title: 'Waller Sand', text: 'Der Stadtstrand an der Weser', photo: 'wallersand.jpg' },
      { building: 'Landmark Tower', title: 'Landmark Tower', text: '67 m hoch – Wohnen mit Weserblick', photo: 'landmark.jpg' },
      { building: 'Speicher XI', title: 'Speicher XI', text: 'Hafenmuseum & Hochschule für Künste', photo: 'speicher11.jpg' },
      { building: 'Speicher I', title: 'Speicher I', text: 'Alter Hafenspeicher von 1950', photo: 'speicher1.jpg' },
      { building: 'Schuppen 2', title: 'Schuppen am Europahafen', text: 'Wo früher Schiffe entladen wurden', photo: 'schuppen1.jpg' },
      { at: 0.97, title: 'Europahafen', text: 'Marina mitten in der Überseestadt', photo: 'europahafen.jpg' },
    ],
  },
  {
    id: 2,
    startName: 'Europahafen', finishName: 'Marktplatz',
    carFree: ['Hutfilterstraße', 'Obernstraße', 'Unser Lieben Frauen Kirchhof', 'Am Markt'],   // Fussgaengerzone: keine Autos
    data: 'data/level2.json',
    seed: 4711,
    obstacleGap: [24, 44],
    oncomingEvery: [5, 9],
    pedestrianChance: 0.6,
    nitroEvery: 160,
    surprises: [
      { type: 'pinguine', at: 0.33 },
      { type: 'dino', at: 0.74 },
    ],
    landmarks: [],     // Fotos kommen aus data/level2.photos.json (echte Aufnahmeorte)
  },
  // Weitere Level: gleiche Struktur + tools/levelN.cfg.json, dann
  //   python3 -I tools/build_level.py tools/levelN.cfg.json && python3 -I tools/fetch_assets.py N
];

