
function parseGermanDate(dateStr) {
    const match = dateStr.match(/(\d{2})\.(\d{2})\.(\d{4})/);
    if (match) {
        const [, day, month, year] = match;
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    }
    return new Date();
}

function extractPositions(text) {
    const textNormalized = text.replace(/\s+/g, ' ');
    console.log("Normalized text:", textNormalized);

    // NEW Regex: Capture the whole identifier string until the date separator
    const regex = /(\d+)\s+(.+?)\s*\/\s*(\d{2}\.\d{2}\.\d{4})\s*[-–]\s*(\d{2}\.\d{2}\.\d{4})/gi;

    let match;
    let found = false;
    while ((match = regex.exec(textNormalized)) !== null) {
        found = true;
        const [fullMatch, quantity, identifierStr, startDateStr, endDateStr] = match;

        console.log(`Matched!`);
        console.log(`Identifier: ${identifierStr}`);

        // Split identifier into property and unit
        const parts = identifierStr.split('/').map(p => p.trim());
        const property = parts[0];
        const unit = parts.slice(1).join(' / ');

        console.log(`Property: ${property}`);
        console.log(`Unit: ${unit}`);
        console.log(`Date: ${startDateStr} - ${endDateStr}`);
    }

    if (!found) {
        console.log("NO MATCH FOUND with new regex.");
    }
}

const text = "Pos. Bezeichnung Menge Einheit Einzel € Gesamt € 2 ODS23 / Aufg.1 / Zi.11 / 11.12.2025- 20.12.2025 Oderstraße 23, 14513 Teltow / Zimmer 11 / 2 Betten 9 Nacht 24,00 216,00";

extractPositions(text);
