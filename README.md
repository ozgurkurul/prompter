# Prompter

Tek bir HTML dosyasından oluşan, tarayıcı tabanlı teleprompter uygulaması.
Google Meet veya Zoom gibi görüntülü görüşme araçları kullanılırken konuşma metnini yüksek okunabilirlikle sunmak için tasarlanmıştır.
Harici bir sunucu, kütüphane veya kurulum gerektirmez — `prompter.html` dosyasını tarayıcıda açmak yeterlidir.

---

## Dosya Yapısı

```
prompter/
└── prompter.html   ← Tek dosya. Tüm HTML + CSS + JS burada.
```

---

## Temel Amaç ve Kullanım Senaryosu

Kullanıcı bir konuşma metni (Word veya düz metin) hazırlar, uygulamaya yapıştırır ve `Load Text` ile sahneye yükler.
Metin aşağı doğru otomatik olarak kayar (klasik teleprompter akışı).
Kullanıcı konuşmasını yaparken metnin kaydırma hızını ve font boyutunu gerçek zamanlı olarak ayarlayabilir.

Kritik kullanım senaryosu: Document Picture-in-Picture (PiP) özelliği sayesinde prompter penceresi Meet/Zoom toplantısının üzerinde, her zaman görünür şekilde kalmaya devam eder.

---

## Ekran Düzeni

```
┌─────────────────────────────────────────────────────────┐
│ CONTROLS (#controls) — gizlenebilir panel               │
│  ┌ TOP BAR ──────────────────────────────────────────┐  │
│  │ [words · duration]  [⏱ timer]  [Speed]  [Font]   │  │
│  │ [📋 Templates]  [▲ Hide]                          │  │
│  └──────────────────────────────────────────────────-┘  │
│  Title input field (tek satır)                           │
│  [textarea metin alanı ──────────────] [Load Text]       │
│  [▶ Start] [◀ Back] [Forward ▶] [Reset] [Fullscreen]    │
│  [⧉ Undock] [Speed ────] [Font ────]                     │
└─────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────┐
│ PROMPTER CONTAINER (#prompter-container)                 │
│                                              N: Title    │  ← top-right, 2 satıra kadar
│  - - - - - - okuma çizgisi (sarı, %33) - - - - - -     │
│                                                          │
│         METİN BURADAN AŞAĞI KAYAR                        │
│                                                          │
│ 📋 N şablon adı — X/Y           [klavye kısayolları]    │  ← bottom
└─────────────────────────────────────────────────────────┘
```

---

## Özellikler

### Metin Yükleme ve Kaydırma
- Textarea'ya metin yapıştırılır → `Load Text` veya `L` kısayolu ile sahneye alınır.
- Metin ilk yüklendiğinde **ekranın tam ortasından** başlar (`container.clientHeight / 2`).
- `▶ Start` ile kaydırma başlar; metin yukarı doğru kayar.
- Son satır ekranın **en üstünde sabitlenir** (ekrandan çıkmaz). O noktada "✓ Completed" banner'ı belirir ve kaydırma otomatik durur.
- Kaydırma hızı: `speed` değeri her animasyon frame'inde `currentPosition`'dan çıkarılır (`requestAnimationFrame` döngüsü, ~60fps).

### Hız ve Font Kontrolü
- `Speed` slider: 0.4–8 arası, 0.1 adımla.
- `Font` slider: 20–200 piksel arası, 2 adımla.
- Her ikisini de fare tekerleği (prompter alanı üzerinde) ve klavye kısayollarıyla gerçek zamanlı değiştirmek mümkündür.
- Değerler her zaman top-bar'da görünür.

### Süre Hesabı
- Kelime sayısı + güncel hız + güncel font boyutu birlikte kullanılarak tahmini **tamamlanma süresi** hesaplanır.
- `measureTextHeight(text, fontSize)` fonksiyonu: gizli bir `<div>` oluşturur, prompter metni ile aynı CSS'i uygular ve gerçek sarılmış yüksekliği ölçer. Bu sayede uzun metinlerin satır sarmasından kaynaklanan yükseklik farkı doğru hesaplanır.
- `startY = containerHeight / 2`, `endY = -(textHeight - lineHeight)`, `totalSec = (startY - endY) / (speed * 60)`.

### Geçen Süre Sayacı
- ⏱ sayacı yalnızca kaydırma sırasında artar, duraklatıldığında durur.
- `Reset` ile sıfırlanır.
- `setInterval(1s)` ile güncellenir; `clearInterval` ile durdurulur.

### Başlık Gösterimi
- `Title` input alanı → prompter alanının sağ üst köşesinde küçük yarı-saydam font ile gösterilir.
- Aktif bir şablon varsa başlığın önüne **şablon sıra numarası** eklenir: `"1: Başlık"`.
- `updateTitleDisplay()` tek merkezden çalışır; sıra değiştiğinde (reorder, delete, cycle) otomatik güncellenir.
- CSS: `left: 20px; right: 20px; text-align: right; -webkit-line-clamp: 2` — yatay alanın tamamını kullanır, 2 satıra kadar sarar.

### Controls Paneli Gizle/Göster
- `▲ Hide` / `▼ Show` butonu veya `H` kısayolu.
- Collapsed durumda yalnızca top-bar görünür (istatistikler + şablon butonu + toggle).
- CSS `max-height` geçişi ile animasyonlu açılıp kapanır.

### Adım Geri / İleri
- `◀ Back` ve `Forward ▶` butonları (veya `←`/`→` tuşları) metni tam 1 satır yüksekliği kadar geri/ileri alır.
- Satır yüksekliği: `parseInt(fontSize.value) * 1.6`.

### Tam Ekran
- `Fullscreen` butonu veya `F` kısayolu: `document.documentElement.requestFullscreen()`.

---

## Undock (Ayrı Pencere / PiP)

`⧉ Undock` butonu veya `U` kısayolu.

### Akış
1. **Document Picture-in-Picture API** denenir (`documentPictureInPicture.requestWindow`).
   - Başarılı olursa: 700×450'lik PiP penceresi açılır. PiP penceresi **her zaman üstte kalır** — Meet/Zoom ekranının üzerinde görünür.
2. **API yoksa** ya da hata olursa: `window.open(...)` ile popup fallback açılır.

### Container Taşıma
- `#prompter-container` DOM elemanı olduğu gibi (`appendChild`) yeni pencerenin `body`'sine taşınır.
- Ana pencerede yalnızca `#controls` ve `#templatesPanel` kalır.
- Kapatıldığında container tekrar ana pencereye (`containerOriginalParent`) alınır.

### Stil Kopyalama
- Ana penceredeki `<style>` bloğu `cssRules` olarak okunur ve yeni pencerenin `<head>`'ine enjekte edilir.
- Yeni pencerenin `body`'si inline CSS ile düzenlenir:
  `margin:0; background:#121212; color:#fff; height:100vh; overflow:hidden;`
- Orijinal stylesheet'teki `body { display:flex; flex-direction:column; height:100vh }` kuralı korunduğundan `flex-grow:1` ile `#prompter-container` tüm yüksekliği kaplar.

### Yeniden Ortalama
- Container taşındıktan sonra `clientHeight` değişir.
- Çift `requestAnimationFrame(() => requestAnimationFrame(recenterText))` ile layout oturmasını bekler, ardından metni yeni viewport'a göre ortalar.
- Aynısı dock-back sırasında ve `pagehide`/`beforeunload` eventlerinde de yapılır.

### Event Listener Yönetimi
- `handleKeydown` ve `handleWheel` isimsiz fonksiyon olarak değil **named function** olarak tutulur.
- Hem `document` hem `pipWindow.document` / `popupWindow.document`'a eklenir.
- Pencere kapandığında `removeEventListener` ile temizlenir.
- `resize` eventi de yeni pencereye bağlanır ve kapandığında kaldırılır.

---

## Şablonlar (Templates) Sistemi

### Veri Modeli
```js
// localStorage key: 'prompterTemplates_v1'
{
  templates: [
    { id: "t_<timestamp>_<rand>", title: "Başlık", text: "İçerik..." },
    ...
  ],
  activeId: "t_..."   // null ise aktif şablon yok
}
```

### CRUD
| İşlem | Açıklama |
|---|---|
| **Save Current** | Aktif şablon varsa → günceller. Aktif yoksa → yeni oluşturur. Asla duplicate yaratmaz. |
| **New Empty** | Tamamen boş (title: "", text: "") yeni şablon oluşturur, aktif yapar, textarea'yı temizler. |
| **▶ (Load)** | Şablonu textarea + title'a yükler, `loadText()` çağırır, prompter sahnesini sıfırlar. |
| **⟳ (Edit)** | Aktif textarea içeriğini seçili şablonun üzerine yazar. |
| **× (Delete)** | Aktif şablonu siliyorsa textarea + prompter da temizlenir. |

### Sıra Numarası
- Her şablon listede `"N: Başlık"` formatında gösterilir (N = array index + 1).
- Prompter ekranında başlık `"N: Başlık"` olarak gösterilir.
- Sıraya bağlı olduğundan drag-drop reorder sonrası numaralar otomatik güncellenir.

### Drag & Drop Sıralama
HTML5 `draggable` + `dragstart/dragover/drop/dragend` eventsları. Drop hedefine göre array'de `splice` yapılır.

### Şablon Döngüsü
`Ctrl+←` / `Ctrl+→` ile önceki/sonraki şablona geçilir. `cycleTemplate(direction)` array index'i kaydırır.

### Export / Import
- **Export**: `Blob` + `URL.createObjectURL` → `.json` dosyası indirilir.
- **Import**: `FileReader` → JSON parse → Merge (mevcut listeye ekle) veya Replace (tümünü sil).
- ID çakışması önleme: import edilen ID'ler mevcut ID set'i ile karşılaştırılır, çakışan veya geçersizler için `newTemplateId()` üretilir.

---

## Klavye Kısayolları

| Kısayol | Eylem |
|---|---|
| `Space` | Başlat / Durdur |
| `←` / `→` | 1 satır geri / ileri |
| `Ctrl+←` / `Ctrl+→` | Önceki / sonraki şablon |
| `↑` / `↓` | Hızı 0.1 artır / azalt |
| `+` / `-` | Font boyutunu 4px artır / azalt |
| `R` | Başa dön (Reset) |
| `F` | Tam ekran |
| `L` | Metni yükle (Load Text) |
| `H` | Controls paneli gizle / göster |
| `U` | Undock / Dock |
| `T` | Şablonlar paneli aç / kapat |

> **Not:** Tüm tek-tuş kısayollar `Ctrl` / `Meta` ile birlikte basılırsa **devre dışıdır**. Tarayıcı kısayolları (Ctrl+R, Ctrl+F, Ctrl+L, Ctrl+T, Ctrl+-, Ctrl+=) korunur.
> Textarea veya title input odakta iken tüm kısayollar devre dışıdır.

### Fare Tekerleği
- Prompter alanı üzerinde tekerlek → hız değişir.
- `#controls` paneli veya `#templatesPanel` üzerinde tekerlek → doğal kaydırma (hız değişmez).

---

## Teknik Detaylar

### Kaydırma Döngüsü
```
requestAnimationFrame(scrollText)
  → currentPosition -= speed
  → clamp: currentPosition >= minPosition  (minPosition = -(textHeight - lineHeight))
  → prompterText.style.top = currentPosition + 'px'
  → tekrar requestAnimationFrame
```
Bitiş koşulunda: `isPlaying = false`, banner göster, RAF'ı iptal et.

### Pozisyon Yönetimi
- `currentPosition`: prompterText'in `top` değeri (piksel, pozitif = aşağı).
- `getStartPosition()` → `container.clientHeight / 2`
- `recenterText()` → `currentPosition = getStartPosition(); prompterText.style.top = currentPosition + 'px';`
- Resize olayında (debounce 120ms) + undock/dock geçişlerinde çağrılır.

### Yükseklik Ölçüm Helper'ı
```js
function measureTextHeight(text, fontSizePx)
// → gizli #textMeasurer div
// → aynı genişlik (container.clientWidth - 100px), aynı line-height, white-space:pre-wrap
// → offsetHeight döndürür (gerçek sarılmış yükseklik)
```

### localStorage Şeması
```json
{
  "templates": [
    { "id": "t_1718000000000_abc12", "title": "...", "text": "..." }
  ],
  "activeId": "t_1718000000000_abc12"
}
```
Key: `prompterTemplates_v1`

### CSS Tema
- Arka plan: `#121212`
- Panel: `#1e1e1e`
- Vurgu (mint): `#4ec9b0`
- Primary mavi: `#0078d4`
- Stop kırmızı: `#d13438`
- Okuma çizgisi: `rgba(255,200,0,0.4)` — ekranın %33'ünde yatay şerit

---

## Bilinen Davranışlar

- **PiP penceresi her zaman üstte kalır.** Bu, Document Picture-in-Picture API'nin doğası gereğidir; popup fallback bu garantiyi vermez.
- **Container taşındığında timer ve RAF loop devam eder.** Dock-back sonrası oynatma kaldığı yerden sürer.
- **Font değiştiğinde pozisyon sıfırlanmaz.** Mevcut konum korunur; sadece görsel boyut değişir.
- **Şablon yokken başlık prefix'i oluşmaz.** `updateTitleDisplay()` aktif template olmadığında sadece ham başlığı gösterir.
- **Sayfa yenilenince son aktif şablon otomatik yüklenir** (`loadTemplatesFromStorage()` → `loadText()`).

---

## Geliştirme Notları

- Tüm kod `prompter.html` içindedir: `<style>` bloğu → HTML → `<script>` bloğu.
- Framework veya build aracı yoktur; doğrudan tarayıcıda çalışır.
- JavaScript yorumları Türkçe'dir; UI metinleri (butonlar, placeholder'lar, alert/confirm diyalogları) İngilizce'dir.
- Yeni pencere açıldığında stylesheet'ler `cssRules` üzerinden string olarak kopyalanır. Cross-origin stylesheet varsa `<link>` olarak eklenir (güvenlik kısıtlaması nedeniyle cssRules okunamaz).
- `e.target.closest(selector)` tüm modern tarayıcılarda desteklenir; IE yoktur.
- Document Picture-in-Picture API yalnızca Chromium tabanlı tarayıcılarda (Chrome 116+) mevcuttur. Diğerlerinde popup fallback devreye girer.
