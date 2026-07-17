# Project Roadmap

> **Check this file before starting any new feature.** It is the canonical
> source for product scope, sprint planning, and the Instagram discovery
> flow that drives the platform's lead acquisition model. Architectural
> decisions (Magic Link auth, InquiryRequest entity, source tracking on
> User/Lead, DM auto-reply triggers) are documented here — implementing
> something that conflicts with the roadmap is almost always a mistake.
>
> **Pricing and plan tiers are deliberately *not* covered here** — see
> `PRICING.md`. The Starter/Pro/Studio split is still a DRAFT proposal and
> nothing in the codebase enforces it, so do not build a paywall against the
> landing page's pricing table until that document is agreed.
>
> **Galleries expire** (Starter 60 days / Pro 1 year / Studio 2 years). The
> deletion job is gated by four hard requirements — client reminder emails, a
> photographer-side extend, soft-delete before hard-delete, and AGB wording —
> in `adr/001-gallery-retention-and-deletion.md`. **Do not ship gallery expiry
> without them:** it destroys a client's wedding photos irreversibly, and the
> blame lands on the photographer.
>
> **One payment decision there is already binding and affects §4.5 below:**
> Starter pays a commission on collected payments instead of being locked out of
> them, which means **Stripe must be built on Connect (Express) from the start**
> — the platform takes an `application_fee_amount`, and photographers onboard
> with Stripe-hosted KYC before they can accept money. Building plain Checkout
> first would mean rewriting the whole payment path. See `PRICING.md` §4.

---

📸
FOTOGRAF PLATFORM
Master Sənəd — v4.1
10 Problem · Full Roadmap · Senior-Level Analiz · Instagram Entegrasiyası
Stack
Spring Boot 3 + Next.js 14
DB
PostgreSQL schema-per-tenant
Hosting
Railway → GCP
MVP Xərc
~€2–17/ay

3 feedback turu · Feedback inteqrasiya edilmiş · Final versiya
Gizli & Şəxsi — 2025

4.5 Instagram Discovery Axını — Müştəri Özü Gəlir
🔑 Bu bölmənin əhəmiyyəti
Bu axın platformanın ən kritik arxitektura qərarlarından biridir. Əgər fotoqraf hər müştərini əl ilə dəvət etməlidirsə, iş yükü azalmır — sadəcə başqa formaya keçir. Düzgün axında müştəri Instagram-dan özü gəlir, özü qeydiyyatdan keçir, özü sorğu göndərir. Fotoqrafın iş yükü: sıfır.


4.5.1 Problem — Mövcud Gap
Köhnə axında aşağıdakı problemlər var idi:
Müştəri Instagram-da DM yazır → fotoqraf əl ilə cavab verir → email göndərir → əl ilə lead yaradır
Hər yeni müştərini platformaya fotoqraf özü dəvət etməli olur — iş yükü azalmır
Instagram DM-ləri, WhatsApp, email — hamısı ayrı-ayrı, heç biri platformada deyil
Müştəri 'özü gəlmə' yolu yoxdur — hər əlaqə fotoqrafdan başlayır

4.5.2 Həll — Avtomatik Discovery Axını
Düzgün axında müştəri özü gəlir, sistem qalanını edir:
Bio link: Instagram bio-da anna-foto.fotoplatform.de/request — müştəri direkt sorğu göndərə bilər
DM avtomatizasiya: 'Hochzeit', 'Preis', 'Termin', 'Verfügbar' kimi sözlər DM-də yazılsa → auto-reply link göndərir
Self-serve axın: müştəri linki açır → magic link ilə qeydiyyat → sorğu formu → büdcə/məqsəd/tarix → göndərir
Fotoqrafın işi: yalnız son bildirişi almaq — 'Yeni sorğu: Maria Kellner, HIGH score'

4.5.3 Tam Axın — Addım-addım
Aşağıdakı cədvəl 3 tərəfin (müştəri, platform, fotoqraf) hər addımda nə etdiyini göstərir:
1
Müştəri
Instagram-da DM yazır
"Hallo! Ich interessiere mich für eine Hochzeitsfotografie im Juni 2026. Habt ihr noch Termine frei?" — tetikleyici söz: 'Hochzeit'

↓
2
Platform (avtomatik)
Auto-reply göndərir — 8–10 saniyə içində
"Hallo! Danke für deine Anfrage. Um dein Datum zu prüfen, nutze bitte: anna-foto.fotoplatform.de/request?ref=ig" — fotoqrafın işi: sıfır

↓
3
Müştəri
Linki açır → Register/Login
Email daxil edir → magic link emailə gəlir → 1 kliklə daxil olur. Şifrə yoxdur. Instagram-dan gəldiyini sistem bilir (?ref=ig).

↓
4
Platform (avtomatik)
Müştəri hesabı yaranır
role=CUSTOMER, tenant_id=anna-foto, source=INSTAGRAM, ref_code=ig. Email ünvanı saxlanılır — sonradan booking ilə əlaqələndirmə üçün.

↓
5
Müştəri
Anna-ya sorğu (request) göndərir
Seans növü (Hochzeit/Portrait/Familie), büdcə aralığı (€200-500 / €500-1000 / €1000-2000 / €2000+), təxmini tarix, məkan, mərasim haqqında məlumat, xüsusi istəklər.

↓
6
Platform (avtomatik)
Lead yaranır + score hesablanır
HIGH: büdcə ≥ €500 VƏ tarix > 60 gün VƏ növ = HOCHZEIT. Score hesablanır, audit_log-a yazılır, async event tetiklənir.

↓
7
Fotoqraf (Anna)
Workspace-də bildiriş alır
"Yeni sorğu: Maria Kellner · Hochzeit · Jun 2026 · €1000–2000 · Berlin · Instagram-dan · HIGH" — Email, WhatsApp, ya da 'Booking yarat' CTA.

↓
8
Fotoqraf (Anna)
Cavab verir → razılaşırsa Booking yaradır
Anna sorğunu qəbul edir → Workspace-dən 'Booking yarat' → müştəriyə avtomatik: depozit linki + müqavilə + təsdiq emaili.

↓
9
Müştəri
Depozit ödəyir
Stripe: kart ya SEPA Debit. Ödəniş bitdikdə booking DEPOSIT_PAID statusuna keçir. Müştəri platformada booking-ini görür.

↓
10
Platform (avtomatik)
Proses davam edir — mövcud axın
Çəkiliş → post-production status bildirişləri → qalereya çatdırılması → 14 gün sonra referral email. Bölmə 4.1-dəki axın ilə birləşir.


4.5.4 Instagram Entegrasiyasının Texniki Detalları
DM Avtomatizasiyası — Tetikleyici Sözlər
Instagram Messaging API ilə aşağıdakı söz qrupları tetikleyici kimi konfiqurasiya edilir:
Kateqoriya
Alman sözlər
Nəticə
Booking niyyəti
Hochzeit, Termin, Verfügbar, Anfrage
Auto-reply + link
Qiymət sorğusu
Preis, Kosten, Paket, Angebot
Auto-reply + qiymət linki
Ümumi maraq
Fotograf, Fotos, Instagram
Sadə auto-reply
İngilis (expat)
wedding, price, booking, available
EN auto-reply


Bio Link Konfiqurasiyası
Fotoqraf bio-ya yazır: anna-foto.fotoplatform.de/request
Bu link Settings → Instagram bölməsindən kopyalanır — bir dəfəlik iş
Link həmişə aktivdir: paketlər, mövcud tarihlər (Google Calendar sync-dən), forma
Linktree/Beacons.ai əvəz edilir — hər şey platformada

Magic Link Auth — Niyə Şifrəsiz?
Şifrəsiz qeydiyyatın əhəmiyyəti
Almanya bazarında 'şifrə qur' mərhələsi çox yüksək abandon rate-ə səbəb olur. Müştəri Instagram-dan gəlib motivasiyalıdır — əlavə friction onları itirə bilər. Magic link (email-based passwordless auth) bu problemi həll edir:
Müştəri email yazır
Sistem 1 dəqiqəlik token generasiya edir, emailə göndərir
Müştəri emaildəki düyməyə basır → JWT yaranır → avtomatik daxil olur
Sonrakı girişlər üçün eyni magic link mexanizmi — şifrə heç vaxt olmayacaq


Request Formu — Sahələr
Müştəri daxil olduqdan sonra göstərilən sorğu formu (max 6 sahə + honeypot):
Sahə
Tip
Qeyd
Seans növü
Dropdown (Hochzeit / Portrait / Familie / Event / Anderes)
Score-a təsir edir
Büdcə aralığı
Chip seçimi (€200–500 / €500–1000 / €1000–2000 / €2000+)
Score-un əsas meyarı
Təxmini tarix
Date picker (Calendar sync ilə dolu günlər deaktiv)
Score-a təsir edir
Məkan
Text (Berlin, Hamburg...)
Metadata
Mesaj
Textarea (mərasim haqqında məlumat)
Score: mesaj keyfiyyəti
Honeypot
Hidden field
Spam filtri — doldurulsa reject


4.5.5 Settings → Instagram — Bir Dəfəlik Quraşdırma
Fotoqraf Settings → Instagram bölməsindən aşağıdakıları konfiqurasiya edir:
Xüsusiyyət
Təsvir
Default
Instagram hesab bağlantısı
OAuth ilə @anna.fotografie qoşulur — bir dəfəlik
Qoşulmayıb
DM avtomatik cavab
Tetikleyici sözlər üzərindən auto-reply aktiv/deaktiv
Aktiv
Booking linki
anna-foto.fotoplatform.de/request — kopyalanabilir
Avtomatik
Post link sticker
Yeni post paylaşılsa avtomatik booking linki şərhlərə əlavə
Deaktiv
Story sticker
Story paylaşılsa 'Book me' sticker avtomatik əlavə edilir
Deaktiv
Tetikleyici sözlər
Admin paneldən özelleştirmə mümkün (alman + ingilis)
Standart siyahı


4.5.6 DB Modelləri — Yeni Sahələr
User entity-sinə əlavələr
source VARCHAR(20) — INSTAGRAM / FORM / INVITE / REFERRAL
instagram_ref VARCHAR(50) — bio linki üçün ?ref parametri
ig_dm_id VARCHAR(100) — Instagram DM thread ID (müştəri tapılması üçün)
Lead entity-sinə əlavələr
source VARCHAR(20) — INSTAGRAM_DM / PORTFOLIO_FORM / DIRECT
ig_message_id VARCHAR(100) — orijinal DM ID (audit üçün)
ig_username VARCHAR(100) — müştərinin Instagram handle-i
Yeni entity: InquiryRequest
InquiryRequest — Mövcud Lead entity-sindən fərqi
Instagram axınında müştəri əvvəlcə hesab açır, sonra sorğu göndərir. Bu Lead entity-sindən fərqlidir — burada customer_id mövcuddur (anonim deyil).
id UUID
customer_id FK → User (nullable deyil — müştəri artıq qeydiyyatdandır)
photographer_tenant_id FK → Tenant
event_type ENUM — HOCHZEIT / PORTRAIT / FAMILIE / EVENT / ANDERES
budget_range ENUM — UNDER_500 / 500_1000 / 1000_2000 / OVER_2000
proposed_date DATE
location VARCHAR(200)
message TEXT
score ENUM — HIGH / MED / LOW (eyni rule-based alqoritm)
status ENUM — PENDING / ACCEPTED / REJECTED / BOOKING_CREATED
source VARCHAR(30) — INSTAGRAM_DM / BIO_LINK / REFERRAL
created_at, updated_at TIMESTAMP


4.5.7 API Endpointlər — Yeni
Endpoint
Metod
Təsvir
POST /api/instagram/webhook
Platform (public)
Instagram DM webhook — tetikleyici söz yoxlanır, auto-reply göndərilir
POST /api/auth/magic-link
Public
Email → magic link generasiya et, Resend ilə göndər
GET /api/auth/magic-link/verify
Public
Token doğrula → JWT set et → müştəri daxil olur
POST /api/public/inquiry/{subdomain}
Public (auth required)
Müştəri sorğu göndərir — InquiryRequest yaranır
GET /api/inquiries
Photographer (auth)
Bütün sorğular — score/status filter, cursor pagination
POST /api/inquiries/{id}/accept
Photographer (auth)
Sorğu qəbul et → Booking yarat → müştəriyə email
POST /api/inquiries/{id}/reject
Photographer (auth)
Sorğu rədd et → müştəriyə nazik email


4.5.8 Sprint Planlaması — Bu Axın Harda Düşür?
⚠️ MVP-yə Əlavə — Sprint 3-ə Daxil Edilməlidir
Instagram DM webhook və magic link auth MVP üçün kritikdir — platformanın əsas discovery kanalı budur. Sprint 3-ün mövcud iş yüküne əlavə edilməli, ya da Sprint 3b kimi ayrılmalıdır.
Sprint 3 (MVP): Magic link auth + InquiryRequest entity + /request public form
Sprint 3b (opsional): Instagram Messaging API webhook + DM auto-reply
v2.0: Post link sticker + Story sticker avtomatizasiyası
v2.0: Settings → Instagram tam panel (tetikleyici söz özelleştirme)


4.5.9 Bu Axının 4.1 (Booking Fəlsəfəsi) ilə Əlaqəsi
Mövcud Bölmə 4.1-dəki axın (Addım 1–10) bu yeni axınla birləşir:
Bölmə 4.1 Addım 1: 'Müştəri portfolioya baxır → bəyənir → əlaqə saxla basır' — BU AXIN HƏMIN ADDIMI ƏVƏZ EDİR
Bölmə 4.5 Addım 1–6: Yeni Instagram-first discovery axını
Bölmə 4.5 Addım 7 (Anna cavab verir) → Bölmə 4.1 Addım 5 (fotograf şəxsən cavab verir) ilə birləşir
Bölmə 4.5 Addım 8 (Booking yaranır) → Bölmə 4.1 Addım 7 (fotograf admin paneldən booking yaradır) ilə birləşir
Bölmə 4.5 Addım 9–10 → Bölmə 4.1 Addım 8–10 (ödəniş, seans, çatdırılma, referral) ilə birbaşa davam edir

Nəticə — İş Yükü Müqayisəsi
Köhnə axın (əl ilə):
DM oxu → cavab yaz → email göndər → lead yarat → booking yarat = ~30 dəqiqə/müştəri
Yeni axın (avtomatik):
Bildiriş al (HIGH score) → 'Booking yarat' bas → hazır = ~2 dəqiqə/müştəri
Qənaət: Aylıq 20 lead × 28 dəqiqə = 560 dəqiqə (9.3 saat) azalır. Bu platformanın əsas dəyər təklifidir.


Qeyd — v4.1 Yenilikləri
Bu versiyada (v4.1) aşağıdakı yeni bölmə əlavə edilmişdir:
Bölmə 4.5 — Instagram Discovery Axını (tam yeni bölmə)
4.5.1 — Problem təsviri
4.5.2 — Həll strategiyası
4.5.3 — Addım-addım tam axın (10 addım, 3 tərəf)
4.5.4 — Texniki detallar (DM tetikleyicilər, bio link, magic link)
4.5.5 — Settings → Instagram konfiqurasiyası
4.5.6 — DB modelləri (yeni sahələr + InquiryRequest entity)
4.5.7 — Yeni API endpointlər (7 endpoint)
4.5.8 — Sprint planlaması (Sprint 3 + 3b + v2.0)
4.5.9 — Mövcud Bölmə 4.1 ilə əlaqə
Qalan bölmələr (1–4.4, 5–8) dəyişdirilməmişdir.
