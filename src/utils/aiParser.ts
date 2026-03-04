
import { GoogleGenerativeAI } from "@google/generative-ai";
import { ParsedInvoice, ParsedPosition, extractTextFromPdf } from "./pdfParser";

// Initialize Gemini
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(API_KEY || "");

export async function parseInvoiceWithGemini(file: File): Promise<ParsedInvoice | null> {
  if (!API_KEY) {
    console.error("Gemini API Key is missing!");
    throw new Error("API Key fehlt. Bitte VITE_GEMINI_API_KEY in .env.local setzen.");
  }

  try {
    // 1. Extract text from PDF (reusing existing function)
    const text = await extractTextFromPdf(file);
    console.log("Extracted Text for AI:", text.substring(0, 500) + "...");

    // 2. Prompt Gemini
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const prompt = `
    Du bist ein Experte für Datenextraktion von Living 21 GmbH Rechnungen. Extrahiere die Rechnungsdaten aus dem folgenden Text und gib sie als reines JSON zurück.
    
    WICHTIG - POSITIONS EXTRACTION:
    - Jede Position hat typischerweise das Format: "1 RLD6 / WE2 / 29.11.-01.12.2025"
    - "property": Der GEBÄUDECODE (z.B. "RLD6", "KB40b", "ODS23"). NICHT die Adresse!
    - "unit": Die WOHNUNGSNUMMER (z.B. "WE2", "WE14", "Zi.11"). NICHT "Nacht" oder "Nächte"!
    - "roomName": Kombination aus property und unit OHNE Datum (z.B. "RLD6 / WE2"). KEINE Adressen, KEIN Datum!
    
    BEISPIELE:
    - Input: "1 RLD6 / WE2 / 29.11.-01.12.2025 2 Nacht 32,00 64,00"
      → property: "RLD6", unit: "WE2", roomName: "RLD6 / WE2"
    - Input: "2 KB40b / WE14 / 12.01.2026-18.01.2026 6 Nächte 45,00 270,00"
      → property: "KB40b", unit: "WE14", roomName: "KB40b / WE14"
    
    ACHTUNG: "Nacht" oder "Nächte" ist die EINHEIT für die Anzahl der Übernachtungen, NICHT die Wohnungsnummer!
    
    WEITERE REGELN:
    - Datum muss im ISO Format sein (YYYY-MM-DDT00:00:00.000Z)
    - Beträge müssen Zahlen sein (Kommazahlen punktgetrennt)
    - "isOneTimeFee": TRUE bei Einmalgebühren ("Reinigung", "Endreinigung", "Parkplatz", "pauschal"). Bei diesen: nights=0.
    - "customer": Extrahiere Name, Firma, Straße, PLZ, Stadt, Email.
    - PLZ ist eine 5-stellige Zahl vor der Stadt (z.B. 12345 Berlin).
    - Ignoriere "Living 21 GmbH" als Empfängeradresse, suche den KUNDEN.
    
    TEXT:
    ${text}
    
    JSON SCHEMA:
    {
      "invoiceNumber": "string",
      "customerNumber": "string",
      "invoiceDate": "string",
      "servicePeriodStart": "string",
      "servicePeriodEnd": "string",
      "netAmount": number,
      "vatRate": number,
      "vatAmount": number,
      "grossAmount": number,
      "customer": {
        "company": "string",
        "name": "string",
        "street": "string",
        "zip": "string",
        "city": "string",
        "email": "string"
      },
      "positions": [
        {
          "property": "string (Gebäudecode wie 'RLD6', NICHT Adresse)",
          "unit": "string (Wohnungsnummer wie 'WE2', NICHT 'Nacht')",
          "roomName": "string (z.B. 'RLD6 / WE2', OHNE Datum)",
          "startDate": "string (leer bei Einmalgebühren)",
          "endDate": "string (leer bei Einmalgebühren)",
          "nights": number (0 bei Einmalgebühren),
          "pricePerNightTotal": number (0 bei Einmalgebühren),
          "total": number,
          "details": "string",
          "bedCount": number (optional),
          "isOneTimeFee": boolean (true für Reinigung, Parkplatz, pauschal etc.)
        }
      ]
    }
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const textResponse = response.text();

    console.log("AI Response:", textResponse);

    // Clean up JSON (remove backticks if present)
    const jsonString = textResponse.replace(/```json/g, "").replace(/```/g, "").trim();
    const data = JSON.parse(jsonString);

    // Map to ParsedInvoice (Dates need to be Date objects)
    const parsedInvoice: ParsedInvoice = {
      ...data,
      invoiceDate: new Date(data.invoiceDate),
      servicePeriodStart: new Date(data.servicePeriodStart),
      servicePeriodEnd: new Date(data.servicePeriodEnd),
      positions: data.positions.map((p: any) => {
        const startDate = new Date(p.startDate);
        const endDate = new Date(p.endDate);

        // Check if this is a one-time fee (cleaning, parking, etc.)
        const isOneTimeFee = p.isOneTimeFee === true;

        // For one-time fees, don't calculate nights or price per night
        if (isOneTimeFee) {
          return {
            ...p,
            startDate,
            endDate,
            nights: 0,
            pricePerNightTotal: 0,
            roomName: p.roomName,
            isOneTimeFee: true
          };
        }

        // 1. Calculate nights if missing or 0 (only for regular bookings)
        let nights = p.nights;
        if (!nights || nights === 0) {
          const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          nights = diffDays > 0 ? diffDays : 1;
        }

        // 2. Fix Price Per Night
        // Always verify price per night by dividing total by nights
        let pricePerNightTotal = p.pricePerNightTotal;
        if (nights > 0 && p.total > 0) {
          const calculatedPrice = p.total / nights;
          // If the AI's price is suspiciously wrong (e.g. equal to total, or 0, or significantly different), use calculated
          if (!pricePerNightTotal || Math.abs(pricePerNightTotal - calculatedPrice) > 1.0) {
            console.log(`Recalculating price per night: AI=${pricePerNightTotal}, Calc=${calculatedPrice}`);
            pricePerNightTotal = calculatedPrice;
          }
        }

        return {
          ...p,
          startDate,
          endDate,
          nights,
          pricePerNightTotal,
          roomName: p.roomName,
          isOneTimeFee: false
        };
      })
    };

    // Post-process: Fix positions with invalid dates (cleaning fees, etc.)
    // Cleaning fees often have no date in the invoice, resulting in epoch date (1970)
    // We inherit the end date from a related apartment position
    parsedInvoice.positions = parsedInvoice.positions.map((pos, idx) => {
      // Check if this position has an invalid/epoch date (year 1970)
      if (pos.startDate.getFullYear() === 1970 || pos.endDate.getFullYear() === 1970) {
        // Extract the property identifier from roomName (e.g., "RLD6" from "Reinigung RLD6 / WE35" or "RLD6 / WE35")
        const roomNameParts = pos.roomName?.replace(/^Reinigung\s*/i, '').split('/').map((s: string) => s.trim());
        const thisProp = roomNameParts?.[0];

        // Find a related position with valid dates that shares the same property
        const relatedPos = parsedInvoice.positions.find((other, otherIdx) => {
          if (idx === otherIdx) return false;
          if (other.startDate.getFullYear() === 1970) return false;

          const otherRoomParts = other.roomName?.split('/').map((s: string) => s.trim());
          const otherProp = otherRoomParts?.[0];

          return thisProp && otherProp && thisProp === otherProp;
        });

        if (relatedPos) {
          console.log(`Fixing date for cleaning position: ${pos.roomName} -> using end date ${relatedPos.endDate}`);
          return {
            ...pos,
            startDate: relatedPos.endDate,
            endDate: relatedPos.endDate,
            nights: 0 // Cleaning is a one-time fee, not nightly
          };
        }
      }
      return pos;
    });

    return parsedInvoice;

  } catch (error) {
    console.error("AI Parsing Error:", error);
    throw error;
  }
}
