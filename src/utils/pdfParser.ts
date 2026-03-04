import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Configure PDF.js worker to use local bundled worker
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

// ============================================
// TYPES
// ============================================

export interface ParsedPosition {
    property: string;           // e.g., "KB40b"
    unit: string;               // e.g., "WE14"
    roomName: string;           // Combined: "KB40b / WE14" for matching
    startDate: Date;
    endDate: Date;
    nights: number;
    pricePerNightTotal: number; // Price for whole apartment
    total: number;
    details: string;            // Address, bed info, etc.
    bedCount?: number;          // Extracted from details if available
    isOneTimeFee?: boolean;     // True for cleaning fees, parking, etc. (flat rate, no nights)
}

export interface ParsedCustomer {
    company: string;
    name: string;
    street: string;
    zip: string;
    city: string;
    email?: string;
}

export interface ParsedInvoice {
    invoiceNumber: string;
    customerNumber: string;
    invoiceDate: Date;
    servicePeriodStart: Date;
    servicePeriodEnd: Date;
    customer: ParsedCustomer;
    positions: ParsedPosition[];
    netAmount: number;
    vatRate: number;
    vatAmount: number;
    grossAmount: number;
}

// ============================================
// PDF TEXT EXTRACTION
// ============================================

export async function extractTextFromPdf(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
            .map((item: any) => item.str)
            .join(' ');
        fullText += pageText + '\n';
    }

    return fullText;
}

// ============================================
// PARSING HELPERS
// ============================================

function parseGermanDate(dateStr: string): Date {
    const match = dateStr.match(/(\d{2})\.(\d{2})\.(\d{4})/);
    if (match) {
        const [, day, month, year] = match;
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    }
    return new Date();
}

function parseGermanNumber(numStr: string): number {
    if (!numStr) return 0;
    return parseFloat(numStr.replace(/\./g, '').replace(',', '.')) || 0;
}
// ============================================
// CUSTOMER EXTRACTION - Improved
// ============================================

function extractCustomerInfo(text: string): ParsedCustomer {
    // PDF has TWO address blocks:
    // LEFT: Customer (Shvets Bau GmbH, Yevhenii Shvets, Mühlengasse 8, 91332 Heiligenstadt)
    // RIGHT: Company (Living 21 GmbH, Gartenstr. 52, 12529 Schönefeld)
    // 
    // We need to extract the CUSTOMER data (left side), NOT Living 21 data

    let company = '';
    let name = '';
    let street = '';
    let zip = '';
    let city = '';

    console.log('=== CUSTOMER EXTRACTION ===');

    // Find ALL companies in the text (ending with GmbH, AG, etc.)
    // Pattern requires at least 2+ word characters before the legal form (not just "GmbH" alone)
    // But EXCLUDE "Living 21 GmbH" or "Living21" which is the sender
    const companyPattern = /([A-Za-zäöüÄÖÜß][A-Za-zäöüÄÖÜß\s\-&\.]{2,40}(?:GmbH|AG|KG|e\.K\.|UG|Co\.|OHG|mbH|GbR))/gi;
    const allCompanies = text.matchAll(companyPattern);

    for (const match of allCompanies) {
        const foundCompany = match[1].trim();
        // Skip Living 21 GmbH (our own company) and skip if too short (like just "GmbH")
        if (!/Living\s*21|Living21/i.test(foundCompany) && foundCompany.length > 6) {
            company = foundCompany;
            console.log('Customer company found (not Living 21):', company);
            break;  // Take the first non-Living 21 company
        } else {
            console.log('Skipping:', foundCompany, '(own company or too short)');
        }
    }

    if (company) {
        // Get text after company to find name
        const companyEndIndex = text.indexOf(company) + company.length;
        const afterCompany = text.substring(companyEndIndex);
        console.log('After customer company:', afterCompany.substring(0, 150));

        // Name is typically 2 words (FirstName LastName) right after company
        const nameMatch = afterCompany.match(/^\s*([A-Za-zäöüÄÖÜß]+)\s+([A-Za-zäöüÄÖÜß]+)/);
        if (nameMatch) {
            const firstName = nameMatch[1];
            const lastName = nameMatch[2];
            // Check that it's not a street name and not "Gartenstr" or similar
            if (!/(straße|gasse|weg|platz|allee|str|ring|damm|ufer|garten)/i.test(firstName + lastName)) {
                name = `${firstName} ${lastName}`;
                console.log('Name found:', name);
            }
        }

        // Find street + house number AFTER the company (in customer block)
        // Look for pattern BEFORE "Living 21" appears
        const customerBlockEnd = afterCompany.search(/Living\s*21|Living21/i);
        const customerBlock = customerBlockEnd > 0 ? afterCompany.substring(0, customerBlockEnd) : afterCompany.substring(0, 200);
        console.log('Customer block:', customerBlock);

        // Find street in customer block
        const streetPatterns = [
            /([A-Za-zäöüÄÖÜß\-]+(?:straße|gasse|weg|platz|allee|ring|damm|ufer|chaussee))\s*(\d+[a-z]?)/i,
            /([A-Za-zäöüÄÖÜß\-]+str\.?)\s*(\d+[a-z]?)/i,
            /([A-Za-zäöüÄÖÜß\-]+)\s+(\d+[a-z]?)\s+\d{5}/i
        ];

        for (const pattern of streetPatterns) {
            const streetMatch = customerBlock.match(pattern);
            if (streetMatch) {
                // Make sure it's not Gartenstr (Living 21's address)
                if (!/Garten/i.test(streetMatch[1])) {
                    street = `${streetMatch[1].trim()} ${streetMatch[2]}`;
                    console.log('Customer street found:', street);
                    break;
                }
            }
        }

        // Find PLZ + City in customer block (NOT 12529 Schönefeld which is Living 21's)
        // Use word boundary \b to ensure PLZ is not part of a phone number
        const zipCityMatch = customerBlock.match(/(?:^|\s)(\d{5})\s+([A-Za-zäöüÄÖÜß][A-Za-zäöüÄÖÜß\s\.\-i]+?)(?=\s+Living|\s+Tel|\s+Pos\.|\s+[A-Z]{2}\d|$)/i);
        if (zipCityMatch) {
            // Exclude 12529 Schönefeld (Living 21's address)
            // Also exclude any PLZ that matches phone patterns (like last 5 digits of phone)
            if (zipCityMatch[1] !== '12529' && !customerBlock.includes('+49') || customerBlock.indexOf(zipCityMatch[1]) < customerBlock.indexOf('+49')) {
                zip = zipCityMatch[1];
                city = zipCityMatch[2].trim().replace(/\s+(Living|Tel|Rechnungs).*/i, '').trim();
                console.log('Customer zip/city found:', zip, city);
            }
        }

        // Fallback: if zip not found yet, search in original text but exclude 12529 and phone patterns
        if (!zip) {
            // Look for pattern: 5 digits followed by capital letter (city name start)
            // Must NOT be preceded by a digit (to exclude phone numbers like 418021)
            const fallbackZipCity = text.match(/(?<!\d)(\d{5})\s+([A-ZÄÖÜ][A-Za-zäöüÄÖÜß\.\-\s]{2,40})/g);
            if (fallbackZipCity) {
                for (const match of fallbackZipCity) {
                    const parts = match.match(/(\d{5})\s+(.+)/);
                    // Exclude Living 21's PLZ (12529)
                    if (parts && parts[1] !== '12529') {
                        zip = parts[1];
                        city = parts[2].trim().split(/\s+(?:Living|Tel)/)[0].trim();
                        console.log('Customer zip/city (fallback):', zip, city);
                        break;
                    }
                }
            }
        }
    }

    console.log('=== FINAL CUSTOMER DATA ===');
    console.log({ company, name, street, zip, city });

    // Extract Email (New Feature)
    let email: string | undefined;
    const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

    // Search in the customer block first to avoid our own email
    const customerBlockEnd = text.search(/Living\s*21|Living21/i);
    const customerText = customerBlockEnd > 0 ? text.substring(0, customerBlockEnd) : text.substring(0, 500); // Limit search to top part/customer block

    const emails = customerText.match(emailPattern);
    if (emails && emails.length > 0) {
        // Filter out our own emails if they happen to appear
        const validEmails = emails.filter(e => !e.includes('living-21.com') && !e.includes('living21.de'));
        if (validEmails.length > 0) {
            email = validEmails[0];
            console.log('Customer Email found:', email);
        }
    }

    return { company, name, street, zip, city, email };
}

// ============================================
// POSITION EXTRACTION
// ============================================

function extractPositions(text: string): ParsedPosition[] {
    const positions: ParsedPosition[] = [];
    const textNormalized = text.replace(/\s+/g, ' ');

    console.log('=== POSITION EXTRACTION ===');

    // Pattern: "1 KB40b / WE14 / 12.01.2026- 18.01.2026"
    // IMPROVED REGEX: Captures "ODS23 / Aufg.1 / Zi.11" type patterns too
    // Updated to use {1,80} instead of + to avoid greedy matching across the whole invoice header
    // Updated to use \d{1,4} for the leading number to avoid matching 5-digit Zip codes (e.g. 41236)
    const linePattern = /(\d{1,4})\s+(.{1,80}?)\s*\/\s*(\d{2}\.\d{2}\.\d{4})\s*[-–]\s*(\d{2}\.\d{2}\.\d{4})/gi;

    let match;
    while ((match = linePattern.exec(textNormalized)) !== null) {
        const [fullMatch, quantityStr, identifierStr, startDateStr, endDateStr] = match;

        // Safety check: specific room/unit identifiers shouldn't be massive paragraphs
        // If it's too long, it's likely we matched from the start of the invoice text (e.g. customer number) across headers
        if (identifierStr.length > 80) {
            console.log('Skipping match with suspiciously long identifier:', identifierStr.substring(0, 50) + '...');
            // Reset index to avoid infinite loop if needed, but regex.exec updates automatically.
            // However, we want to try to find a "better" match within this chunk or just skip it?
            // Actually, since the regex is global, we should just continue.
            // But wait, if we matched "10001 ... lots of text ... DATE", we consumed all that text.
            // The REAL match "1 BBS6 / WE1 ..." might be INSIDE that consumed text if the regex was greedy.
            // Since we used `.+?` (non-greedy), it finds the FIRST occurrence of the date pattern.
            // If the text starts with "10001" and there is a date pattern later, it matches everything in between.

            // To fix this, we should enforce that the identifier doesn't contain ridiculous characters or is shorter.
            // We can't do that easily with `.` in JS regex (no atomic groups or variable lookbehind flexibility).
            // ALTERNATIVE: Use a max length quantifier `{1,80}` instead of `+`.
            continue;
        }

        console.log('Position match:', fullMatch);

        // Split identifier into property and unit
        // Identifier could be "KB40b / WE14" or "ODS23 / Aufg.1 / Zi.11"
        const parts = identifierStr.split('/').map(p => p.trim());
        const property = parts[0];
        const unit = parts.length > 1 ? parts.slice(1).join(' / ') : '';

        const startDate = parseGermanDate(startDateStr);
        const endDate = parseGermanDate(endDateStr);

        // Look for nights and prices after the date range
        const afterMatch = textNormalized.substring(match.index + fullMatch.length);
        // NEW REGEX PROPOSAL: Handles both verify_parser.js logic and original
        const priceMatch = afterMatch.match(/(\d+)\s*(Nacht|Monat|Nächte)\s*([\d.,]+)\s+([\d.,]+)/i);

        let nights = 0;
        let pricePerNightTotal = 0;
        let total = 0;

        if (priceMatch) {
            const quantity = parseInt(priceMatch[1]) || 0;
            const unitType = priceMatch[2]; // Nacht, Nächte, or Monat
            const price3 = parseGermanNumber(priceMatch[3]);
            const price4 = parseGermanNumber(priceMatch[4]);

            if (/monat/i.test(unitType)) {
                // For monthly rates:
                // 1. Calculate nights from dates
                const calculatedNights = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
                nights = calculatedNights > 0 ? calculatedNights : 30; // Fallback to 30 if dates match exactly same day (weird)

                // 2. Quantity is number of months (usually 1)
                // 3. Price3 is price per MONTH
                // 4. Price4 is TOTAL price

                total = price4;

                // Price per night = Total / Nights
                if (nights > 0) {
                    pricePerNightTotal = total / nights;
                }
                console.log('Processed monthly rate:', { nights, total, pricePerNightTotal });
            } else {
                // assume 'Nacht' or 'Nächte'
                nights = quantity;
                pricePerNightTotal = price3; // Single price per night
                total = price4; // Total price
            }
        } else {
            // Fallback for when no price line is found (rare but possible)
            nights = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        }

        // Look for bed count
        const bedMatch = afterMatch.match(/Betten[:\s]*(\d+)/i);
        const bedCount = bedMatch ? parseInt(bedMatch[1]) : undefined;

        const roomName = `${property} / ${unit}`;

        positions.push({
            property,
            unit,
            roomName,
            startDate,
            endDate,
            nights,
            pricePerNightTotal,
            total,
            details: afterMatch.substring(0, 200),
            bedCount
        });
    }

    // Fallback pattern if main pattern doesn't match
    if (positions.length === 0) {
        console.log('Trying fallback pattern...');
        const simplePattern = /([A-Z]{2,3}\d+[a-z]?)\s*\/\s*(WE\d+)\s*\/\s*(\d{2}\.\d{2}\.\d{4})\s*[-–]?\s*(\d{2}\.\d{2}\.\d{4})/gi;

        while ((match = simplePattern.exec(textNormalized)) !== null) {
            const [, property, unit, startDateStr, endDateStr] = match;
            const startDate = parseGermanDate(startDateStr);
            const endDate = parseGermanDate(endDateStr);
            const roomName = `${property} / ${unit}`;
            const nights = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

            positions.push({
                property,
                unit,
                roomName,
                startDate,
                endDate,
                nights,
                pricePerNightTotal: 0,
                total: 0,
                details: ''
            });
        }
    }

    console.log('Total positions:', positions.length);
    return positions;
}

// ============================================
// MAIN PARSING LOGIC
// ============================================

export function parseInvoiceText(text: string): ParsedInvoice | null {
    try {
        console.log('=== RAW PDF TEXT ===');
        console.log(text);
        console.log('=== END RAW TEXT ===');

        // Invoice number (handling Rechnungsnr. or Rechnungsnummer)
        // Look for stronger patterns first, then fallback
        const invoiceNumberMatch = text.match(/(?:Rechnungsnr\.?|Rechnungsnummer)[.:]?\s*([A-Z0-9-]+)/i);
        const invoiceNumber = invoiceNumberMatch?.[1] || '';
        console.log('Invoice Number:', invoiceNumber);

        // Customer number (handling Kundennr. or Kundennummer)
        const customerNumberMatch = text.match(/(?:Kundennr\.?|Kundennummer)[.:]?\s*(\d+)/i);
        const customerNumber = customerNumberMatch?.[1] || '';
        console.log('Customer Number:', customerNumber);

        // Invoice date (handling Datum or Rechnungsdatum)
        const invoiceDateMatch = text.match(/(?:Datum|Rechnungsdatum)[.:]?\s*(\d{2}\.\d{2}\.\d{4})/i);
        const invoiceDate = invoiceDateMatch ? parseGermanDate(invoiceDateMatch[1]) : new Date();

        // Service period
        const servicePeriodMatch = text.match(/(?:Leistungszeitraum|Leistungsdatum)[.:]?\s*(\d{2}\.\d{2}\.\d{4})\s*bis\s*(\d{2}\.\d{2}\.\d{4})/i);
        const servicePeriodStart = servicePeriodMatch ? parseGermanDate(servicePeriodMatch[1]) : new Date();
        const servicePeriodEnd = servicePeriodMatch ? parseGermanDate(servicePeriodMatch[2]) : new Date();

        // Positions
        const positions = extractPositions(text);

        // Amounts
        const netMatch = text.match(/Zwischensumme\s*\(?netto\)?\s*([\d.,]+)/i);
        const netAmount = netMatch ? parseGermanNumber(netMatch[1]) : 0;

        const vatMatch = text.match(/Umsatzsteuer\s*(\d+)\s*%\s*([\d.,]+)/i);
        const vatRate = vatMatch ? parseInt(vatMatch[1]) / 100 : 0.07;
        const vatAmount = vatMatch ? parseGermanNumber(vatMatch[2]) : 0;

        const grossMatch = text.match(/(?:Gesamtbetrag|Gesamt|Zahlbetrag)[.:]?\s*([\d.,]+)[\s€]*$/im);
        // Note: added $ anchor and alternative labels to be more precise
        let grossAmount = grossMatch ? parseGermanNumber(grossMatch[1]) : 0;

        // Fallback: If gross amount is 0, sum up from positions or net+vat
        if (grossAmount === 0 && positions.length > 0) {
            console.log('Gross amount not found, calculating from positions...');
            grossAmount = positions.reduce((sum, pos) => sum + pos.total, 0);
        }

        // Customer info
        const customer = extractCustomerInfo(text);
        // Safety check: if customer name looks like a total, clear it
        if (customer.name.startsWith('Gesamt') || customer.company?.startsWith('Gesamt')) {
            customer.name = '';
            customer.company = '';
        }

        return {
            invoiceNumber,
            customerNumber,
            invoiceDate,
            servicePeriodStart,
            servicePeriodEnd,
            customer,
            positions,
            netAmount,
            vatRate,
            vatAmount,
            grossAmount: grossAmount
        };
    } catch (error) {
        console.error('Error parsing invoice text:', error);
        return null;
    }
}

// ============================================
// MAIN PARSER FUNCTION
// ============================================

export async function parsePdfInvoice(file: File): Promise<ParsedInvoice | null> {
    try {
        const text = await extractTextFromPdf(file);
        return parseInvoiceText(text);
    } catch (error) {
        console.error('Error parsing PDF invoice:', error);
        return null;
    }
}

// ============================================
// PROJECT NAME GENERATOR
// ============================================

export function generateProjectName(
    customerNumber: string,
    property: string,
    startDate: Date,
    endDate: Date
): string {
    const formatDate = (d: Date) => {
        const day = d.getDate().toString().padStart(2, '0');
        const month = (d.getMonth() + 1).toString().padStart(2, '0');
        return `${day}.${month}`;
    };

    const year = endDate.getFullYear();
    return `${customerNumber} / ${property} / ${formatDate(startDate)}-${formatDate(endDate)}.${year}`;
}
