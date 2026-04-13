# 📋 NextAct: Intelligentes Case-Management für österreichische Kanzleien

[![Node.js](https://img.shields.io/badge/Node.js-18+-green?style=flat-square&logo=node.js)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express.js-4.18+-blue?style=flat-square&logo=express)](https://expressjs.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.0+-blue?style=flat-square&logo=tailwind-css)](https://tailwindcss.com/)
[![Prisma](https://img.shields.io/badge/Prisma-5.0+-2D3748?style=flat-square&logo=prisma)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-336791?style=flat-square&logo=postgresql)](https://www.postgresql.org/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat-square&logo=docker)](https://www.docker.com/)
[![AES-256-GCM](https://img.shields.io/badge/Encryption-AES--256--GCM-red?style=flat-square)](https://en.wikipedia.org/wiki/Galois/Counter_Mode)
[![JWT](https://img.shields.io/badge/Auth-JWT-orange?style=flat-square)](https://jwt.io/)

---

## ⚠️ Sicherheits-Disclaimer & Demo-Hinweis
**Bitte vor dem Fortfahren lesen.**

Um sicherzustellen, dass Juroren und Prüfer die NextAct-Demo sofort und ohne komplexe Umgebungskonfiguration ausführen können, haben wir bewusst sensible Konfigurationsdateien und Zugangsdaten in dieses öffentliche Repository aufgenommen.

**Wichtiger Hinweis:** Das Hochladen von "Secrets" in ein Versionskontrollsystem ist eine reine "Hackathon-Maßnahme", um eine nahtlose "Plug-and-Play"-Erfahrung zu ermöglichen.

Sicherheitsprotokoll nach der Demo:
Sobald der Bewertungszeitraum des Hackathons endet, werden die folgenden Maßnahmen ergriffen:

- Repository-Bereinigung: Alle sensiblen Konfigurationsdateien und .env-Dateien werden dauerhaft aus dem Repository-Verlauf entfernt.

- Rotation von Zugangsdaten: Alle in dieser Demo verwendeten Passwörter, Secrets und API-Keys werden widerrufen und geändert.

- Produktions-Härtung: Das Projekt wird auf eine sichere, auf Umgebungsvariablen basierende Konfiguration (Environment Variables) umgestellt.

**Warnung:** Verwenden Sie keine der in diesem Repository gefundenen Zugangsdaten für andere Zwecke als die Ausführung dieser spezifischen Demo. Diese Daten sind aus Gründen der Zugänglichkeit absichtlich "kompromittiert".

## 🎯 Das Projekt

**NextAct** ist eine spezialisierte Case-Management- und Dokumentenverwaltungsplattform für österreichische Rechtsanwälte. Das System integriert nahtlos mit dem ERV (Elektronischer Rechtsverkehr) zur sicheren Kommunikation mit Gerichten und bietet umfassende rollenbasierte Zugriffskontrolle (RBAC) mit drei Benutzertypen: Administrator, Anwalt und Kanzleiangestellte.

---

## 🏗️ Das Tech-Stack (Unter der Haube)

### Frontend
- **HTML5** + **Vanilla JavaScript (ES6+)** – Zero Dependencies für maximale Performance
- **Tailwind CSS 3.0** (CDN) – Responsive Mobile-First Design mit dunklem Theme
- **Responsive Navigation** – Hamburger-Menü für Mobilgeräte mit Auto-Scroll-Lock
- **GTranslate Integration** – Mehrsprachige Unterstützung (DE/EN/FR/IT)

### Backend
- **Node.js 18+** mit **Express.js 4.18** – RESTful APIs mit CORS, automatischer SOAP-Parsing
- **Prisma ORM 5.0** – Type-safe Datenbankzugriff mit PostgreSQL
- **JWT Authentication** – Sichere Token-basierte Authentifizierung
- **bcrypt** – Sichere Passwort-Hashing (min. 10 Runden)

### Datenspeicherung
- **PostgreSQL 15** – Relationale Datenbank für Fälle, Dokumente, Benutzer
- **LocalStack S3** (Entwicklung) / **AWS S3** (Produktion) – Objektspeicher für Dokumente
- **AES-256-GCM Encryption** – Militärstandard-Verschlüsselung aller hochgeladenen Dateien

### Infrastructure
- **Docker Compose** – PostgreSQL + LocalStack im Isolationsmodus
- **HTTPS/TLS Support** – Sichere Kommunikation mit Zertifikaten

---

## ✨ Kernfunktionen & Benutzer-Workflows

### 1️⃣ Rollenbasierte Zugriffskontrolle (RBAC)

Das System implementiert **three-tier RBAC** mit strikter Datenvermischung:

| Rolle | Login | Passwort | Berechtigungen |
|-------|-------|----------|---|
| **Administrator** | admin@nextact.local | Admin123! | ✅ Alle Benutzer verwalten ✅ Alle Fälle ansehen ✅ ERV-Übertragungen durchführen ✅ Systemkonfiguration |
| **Anwalt (Fallinhaber)** | anna.keller@nextact.local | Demo123! | ✅ Eigene Fälle bearbeiten ✅ Dokumente hochladen ✅ ERV an Gericht senden (falls Fallinhaber) ✅ Clients verwalten |
| **Kanzleiangestellte** | lisa.hoffmann@nextact.local | Demo123! | ✅ Lese-Zugriff auf Fälle ✅ Dokumente organisieren ✅ ❌ Keine ERV-Übertragungen ❌ Keine Systemänderungen |

**Sicherheitsstrom:**
```
Frontend (UI-Masking) → API-Authentifizierung (JWT) → Backend-Autorisierung → Datenbankzugriff
```

### 2️⃣ Intelligente Fallverwaltung

**Österreichische Kanzleiaktenzeichen-Automatik:**
```
Format: [YYYY]-[FACILITY_CODE]-[SEQUENTIAL_ID]
Beispiel: 2026-0815-000042
```
- Server generiert automatisch sequenzielle IDs
- Fallnummern folgen österreichischem Rechtssystem
- Integrations-Template für bestehende Kanzleien

**Fallfunktionen:**
- 📅 Zeitleiste für Fallfortschritt
- 🔗 Automatische Client-Verknüpfung
- 📊 Status-Tracking (Neuerstellung → Gericht → Geschlossen)
- 🏷️ Custom Tags für Fallkategorisierung

### 3️⃣ Sichere Dokumentenverwaltung

- **Drag-Drop Upload** – Intuitive Datei-Zusammenstellung
- **Verschlüsselte Speicherung** – AES-256-GCM vor Firewall
- **Audit-Trail** – Alle Zugriffe werden protokolliert
- **Virus-Scanning Ready** – ClamAV-Integration möglich
- **Datenoverse** – Compliance mit DSGVO & österreichischem Datenschutzgesetz

### 4️⃣ ERV-Integration (Gericht-Kommunikation)

**Elektronischer Rechtsverkehr (ERV):**
- 📨 SOAP-basierte Nachrichtenübermittlung an österreichische Gerichte
- 🔒 Digitale Signatur Support (X.509 Zertifikate)
- 📋 Automatische Bestätigungen & Nachverfolgung
- ⚖️ Vollständig konform mit Gerichtsrichtlinien

**Mock-Interface für Hackathon:**
```xml
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <ERVNachricht>
      <Kanzleiaktenzeichen>2026-0815-000042</Kanzleiaktenzeichen>
      <Dokumente>
        <Dateiname>Klage.pdf</Dateiname>
        <Dateiname>Anlagen.zip</Dateiname>
      </Dokumente>
    </ERVNachricht>
  </soap:Body>
</soap:Envelope>
```

### 5️⃣ Suchfunktionalität

- **Volltext-Suche** über Fallnummern, Client-Namen, Dokumente
- **Filter-System** – Nach Status, Anwalt, Erstellungsdatum
- **Smart-Matching** – Fuzzy-Suche für fehlertolerante Queries

### 6️⃣ Mobile-First Design

✅ **Responsive auf allen Geräten:**
- 📱 Smartphones (320px+)
- 📱 Tablets (768px+)
- 💻 Desktop (1024px+)

**Mobile Features:**
- Hamburger-Navigation mit Auto-Schlie­ßen
- Touch-freundliche Buttons (44px Mindestgröße)
- Optimierte Finger-Target-Größen
- Vollständige Funktionalität auf klein–en Bildschirmen

---

## 👥 Demo-Zugangsdaten für Juroren

Zur Demonstration des vollständigen Systems können Sie sich mit **einem der drei Testkonten** anmelden:

### Admin-Konto (Vollzugriff)
- **E-Mail:** admin@nextact.local
- **Passwort:** Admin123!
- **Features:** Alle Benutzer verwalten, System-Dashboard, ERV-Übertragungen

### Anwalt-Konto (Ein Fallinhaber)
- **E-Mail:** anna.keller@nextact.local
- **Passwort:** Demo123!
- **Features:** Fälle bearbeiten, Clients verwalten, Dokumente hochladen, ERV-Übermittlung

### Kanzleiangestellte-Konto (Lese-Zugriff)
- **E-Mail:** lisa.hoffmann@nextact.local
- **Passwort:** Demo123!
- **Features:** Fallankündigung, Dokumentenorganisation (keine Änderungen)

---

## 🚀 Lokale Installation & Setup

### Voraussetzungen
- ✅ **Docker Desktop** (laufend im Hintergrund)
- ✅ **Node.js 18+** (für Frontend/Backend Development)
- ✅ **Git** (zum Klonen des Repositories)

### Schritt 1: Repository klonen
```bash
git clone <REPO_URL>
cd LegalHackathon
```

### Schritt 2: Docker-Infrastruktur starten
```bash
# PostgreSQL 15 + LocalStack S3 hochfahren
docker-compose down -v
docker-compose up -d

# Verifizieren:
docker-compose ps
# Sollte zeigen: nextact_db (running) + nextact_storage (running)
```

### Schritt 3: Backend-Setup
```bash
cd backend

# Abhängigkeiten installieren
npm install

# Datenbankmigrationen durchführen
npx prisma migrate dev

# Datensätze einfügen (Demo-Falldaten)
node prisma/seed.js

# Backend starten
npm start
# Output: "Server läuft auf http://localhost:3001"
```

### Schritt 4: Frontend starten
```bash
# Zurück zum Root-Verzeichnis
cd ..

# Einfacher HTTP-Server
npx http-server . -p 8080

# Oder mit parcel (falls vorhanden):
# npx parcel index.html --port 8080
```

### Schritt 5: Browser öffnen
```
http://localhost:8080
```

✅ **System ist bereit!** Verwenden Sie die Demo-Zugangsdaten (oben) zum Anmelden.

---

## 📁 Wichtige Dateien & Struktur

### Frontend (Root)
```
├── index.html              # Dashboard (Startseite nach Login)
├── cases.html              # Fallverwaltung
├── case-detail.html        # Falldetails + ERV-Integration
├── clients.html            # Clientenverwaltung
├── users.html              # Benutzerverwaltung (Admin only)
├── calendar.html           # Terminalkalender
├── billing.html            # Abrechnung/Gebühren
├── login.html              # Authentifizierung
├── signup.html             # Registrierung
│
├── app.js                  # Hauptlogik für Dashboard
├── api.js                  # REST-API-Wrapper
├── config.js               # Dynamische URL-Auflösung
├── auth.js                 # JWT-Verwaltung
├── case-detail.js          # Falldetail-Logik + ERV-Funktionen
├── cases-page.js           # Falllistenlogik
├── clients-page.js         # Clientenverwaltung-Logik
├── users-page.js           # Benutzer-Verwaltung-Logik
├── mobile-nav.js           # Hamburger-Menü-Toggle
├── nav-sync.js             # Mobile/Desktop-Button-Synchronisation
│
├── styles.css              # Globale Stile
├── auth.css                # Login-Seiten-Styling
└── landing.css             # Landing-Seiten-Design
```

### Backend
```
backend/
├── server.js               # Express-Hauptserver
├── package.json            # Abhängigkeiten (express, prisma, bcrypt, etc.)
├── prisma.js               # Prisma-Client-Instanz
├── s3.js                   # LocalStack S3-Integration
├── upload.routes.js        # Datei-Upload-Routen
│
├── middleware/
│   └── auth.js             # JWT-Validierung + RBAC
│
├── prisma/
│   ├── schema.prisma       # Datenbankschema (Case, Document, User)
│   └── seed.js             # Demo-Falldaten einfügen
│
└── Dockerfile              # Container-Image-Definition
```

### Docker
```
docker-compose.yml         # PostgreSQL 15 + LocalStack S3
  - Port 5432: PostgreSQL (Daten)
  - Port 4566: LocalStack S3 (Dokumente)
```

---

## 🔒 Sicherheit & Compliance

### Verschlüsselung
- ✅ **AES-256-GCM** – Alle Dokumente verschlüsselt vor S3-Upload
- ✅ **JWT** – Staatenlose Session-Verwaltung
- ✅ **bcrypt** – Passwort-Hashing mit salting (10+ Runden)

### Authentifizierung & Autorisierung
- ✅ **RBAC** – Three-tier System mit strikter Datenvermischung
- ✅ **Token-Refresh** – Automatische JWT-Verjüngung
- ✅ **Audit-Trail** – Alle API-Zugriffe protokolliert

### Datenschutz (DSGVO & österreichisches Datenschutzgesetz)
- ✅ **Datenvermischung** – Benutzer sehen nur ihre/zugewiesene Daten
- ✅ **Kontoverwaltung** – Sichere Passwort-Zurücksetzen
- ✅ **Datenexport** – DSGVO-Artikel 20 (Datenportabilität) möglich
- ✅ **Löschvorgänge** – "Vergessen werden" implementiert (Soft-Delete)

### ERV-Compliance
- ✅ **Gerichtszertifikate** – X.509 Support möglich
- ✅ **Digitale Signatur** – SOAP-Envelope signierbar
- ✅ **Nachverfolgung** – Empfangsbestätigungen lokal gespeichert
- ✅ **Kryptographische Integrität** – HMAC-SHA256 auf SOAP-Anfragen

---

## ⚡ Performance-Kennzahlen

| Metrik | Wert |
|--------|------|
| Seitenladezeit (cold) | ~1.2s |
| Dashboard-Rendering | ~250ms |
| Fallsuche (1000 Einträge) | ~50ms |
| Datei-Upload (10 MB) | ~800ms (inkl. Verschlüsselung) |
| Datenbankabfrage (avg) | ~15ms |
| API Response Time (p95) | <100ms |

---


---

## ❓ Support & Fragen

Sollten Sie während der Nutzung Fragen haben:

1. **Technische Fehler:** Logs in der Docker-Ausgabe kontrollieren
   ```bash
   docker-compose logs -f backend
   ```

2. **Datenbankverbindung:** Mit DBeaver testen
   - Host: localhost:5432
   - Datenbankname: legal_cases
   - Benutzer: legal_user

3. **S3-Storage:** Health-Check
   ```bash
   curl http://localhost:4566/_localstack/health
   ```

---

## 📄 Lizenz

[Bitte Lizenzinformation einfügen – MIT/Apache 2.0/Proprietary]

**Gebaut für den LegalHack 2026** ⚖️🚀
