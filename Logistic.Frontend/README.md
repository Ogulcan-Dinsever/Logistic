# Logistic · React arayüzü

Logistic depo yönetim projesinin React, TypeScript ve Vite ile hazırlanan arayüzü.

Kurulum, backend ayarları, API akışı ve projenin mevcut kapsamı için [ana README'ye](../README.md) bakabilirsin.

## Başlatma

Node.js 22.12+ ile bu klasörde:

```powershell
Copy-Item .env.example .env
npm ci
npm run dev
```

Arayüz [http://127.0.0.1:5173](http://127.0.0.1:5173) adresinde açılır. Varsayılan API adresi `https://localhost:7228/api`, varsayılan mod canlı bağlantıdır.

Canlı modda giriş / kayıt, ürün, raf, stok, mal kabul ve RF ile rafa yerleştirme gerçek backend'i kullanır. Özet, satış, hareket geçmişi ve kullanıcı yönetimi ekranları şimdilik demo modunda çalışır.

## Bağlantı ve demo

Giriş ekranındaki **Bağlantı ayarları** veya oturum içindeki **Ayarlar** ekranından API adresi ve çalışma modu değiştirilebilir. Tarayıcıda kaydedilen tercih `.env` varsayılanından önceliklidir.

Demo modunda MSW istekleri tarayıcıda karşılar; örnek depo verileri `localStorage` içinde tutulur. Canlı modda istekler doğrudan API'ye gider. Oturum `sessionStorage` içinde saklanır.

Hızlı girişte canlı mod `admin@logistic.demo` / `user@logistic.demo`, demo modu `admin@logistic.demo` / `employee@logistic.demo` adreslerini ve `Demo123!` parolasını kullanır. Canlı moddaki hesaplar otomatik oluşturulmaz.

`VITE_` değişkenleri tarayıcıya açıktır; JWT imzalama anahtarı veya başka gizli bilgi içermemelidir.

## Kontroller

```powershell
npm test
npm run build
npm run preview
```

Derleme çıktısı `dist/` klasöründe oluşur. Uygulama dağıtılırken `/inventory`, `/rf` gibi adresler `index.html` dosyasına yönlendirilmelidir.
