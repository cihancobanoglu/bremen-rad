# Moin Bremen! – Die Radtour

Bremen'de geçen, birinci şahıs bir bisiklet oyunu. Sürücü önünde çocuğuyla gerçek Bremen sokaklarında ilerler,
trafikteki engellerden kaçar, üç nitro tüpü toplayınca hızlanır. Her bölümde iki sürpriz vardır.

- **Bölüm 1 – Überseestadt Nord:** Waller Sand → Kommodore-Johnsen-Boulevard → Konsul-Smidt-Straße → Europahafen (UFO ve maymunlar)
- **Bölüm 2 – Innenstadt:** Europahafen → Faulenstraße → Obernstraße → Marktplatz (penguenler ve dinozor)
- **Araçlar:** bisiklet, elektrikli bisiklet, elektrikli scooter
- **Diller:** Deutsch, Türkçe, English (oyun dünyasındaki tabelalar Almanca kalır)

## Çalıştırma

macOS'ta `Spiel starten.command` dosyasına çift tıklayın. Elle başlatmak için:

```bash
python3 -m http.server 8765 --bind 127.0.0.1
```

Sonra tarayıcıda `http://127.0.0.1:8765/` adresini açın. Kurulum gerekmez; Three.js `lib/` klasöründedir.

Tuşlar: ← → yön, ↑ pedal, ↓ fren, boşluk nitro, K zil, P duraklat.

## Yapı

| Klasör | İçerik |
|---|---|
| `js/` | Oyun kodu (`levels.js` bölüm ayarları, `i18n.js` üç dilli metinler) |
| `data/` | Bölüm verileri (OpenStreetMap'ten üretilir) |
| `assets/` | Hava fotoğrafları, fotoğraflar, 3D modeller, gökyüzü, dokular |
| `tools/` | Bölüm üretici ve varlık indirici betikler |

Yeni bölüm eklemek için `tools/levelN.cfg.json` yazın, sonra:

```bash
python3 -I tools/build_level.py tools/levelN.cfg.json
python3 -I tools/fetch_assets.py N
```

`build_level.py`, `data/raw/` altında ham bir Overpass (OpenStreetMap) dışa aktarımı bekler; bu dosyalar depoya dahil değildir.

## Kaynaklar ve lisanslar

Oyun kodu bu depoya aittir. Üçüncü taraf içerikler kendi lisanslarına tabidir:

- Harita verisi: © OpenStreetMap katkıcıları (ODbL). `data/` klasöründeki bölüm verileri OpenStreetMap'ten türetilmiştir ve ODbL lisansındadır.
- Hava fotoğrafları: DOP20/DOP10 2023, Quelle: Landesamt GeoInformation Bremen (CC BY)
- Fotoğraflar: Wikimedia Commons – ayrıntılar `assets/photos/CREDITS*.md`
- 3D modeller: Sketchfab (CC BY 4.0) ve Kenney Car Kit (CC0) – ayrıntılar `assets/photos/CREDITS.md`
- Gökyüzü ve asfalt: Poly Haven (CC0)
- Three.js (MIT)
