# Bed Inventory & Occupancy Manager

Eine Web-Applikation zur Verwaltung von Bettenvermietung in gewerblichen Unterkünften.

## Features

- **Dashboard mit KPIs**: Gesamtkapazität, Belegung, Verfügbarkeit und Auslastung
- **Master-Belegungskalender**: Interaktive Matrix-Ansicht (Gantt-Chart) mit hierarchischer Struktur
- **Buchungsmanagement**: Formular zum Erstellen von Buchungen mit automatischer Zuweisungslogik
- **Verfügbarkeitsprüfung**: Schnell-Check für Verfügbarkeit von Betten

## Technologie-Stack

- React 18 mit TypeScript
- Vite als Build-Tool
- Tailwind CSS für Styling
- Radix UI Komponenten
- Lucide React für Icons
- date-fns für Datumsoperationen

## Installation

```bash
npm install
```

## Entwicklung

```bash
npm run dev
```

## Build

```bash
npm run build
```

## Projektstruktur

```
src/
├── components/        # React Komponenten
│   ├── ui/           # Basis UI Komponenten
│   ├── Dashboard.tsx
│   ├── OccupancyCalendar.tsx
│   ├── BookingForm.tsx
│   └── AvailabilityCheck.tsx
├── types/            # TypeScript Type Definitionen
├── utils/            # Utility Funktionen
├── hooks/            # Custom React Hooks
├── data/             # Mock-Daten
└── App.tsx           # Hauptkomponente
```

## Datenstruktur

Die App verwendet eine hierarchische Struktur:
- **Standort (Location)** > **Objekt (Property)** > **Zimmer (Room)** > **Betten (Capacity)**

## Belegungslogik

- Ein Zimmer mit 4 Betten kann an 4 verschiedene Personen oder als Gruppe vermietet werden
- Verfügbarkeitsberechnung: Freie_Betten = Gesamtkapazität - Summe(belegte_Betten)
- Automatische Zuweisungslogik schlägt optimale Zimmerverteilung vor

