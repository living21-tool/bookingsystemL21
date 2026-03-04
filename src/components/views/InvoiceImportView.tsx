import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Upload, FileText, CheckCircle, AlertTriangle, User, Building, Calendar, Euro, X, ChevronRight, Loader2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Input } from '../ui/Input';
import { Customer, Invoice, Booking, Location, Room } from '../../types';
import { parsePdfInvoice, ParsedInvoice, ParsedPosition, generateProjectName } from '../../utils/pdfParser';
import { parseInvoiceWithGemini } from '../../utils/aiParser';
import * as db from '../../lib/database';
import { format, eachDayOfInterval } from 'date-fns';
import { isRoomBookedOnDate } from '../../utils/occupancy';

interface InvoiceImportViewProps {
    locations: Location[];
    customers: Customer[];
    bookings: Booking[];
    onImportComplete: () => void;
}

interface RoomMatch {
    position: ParsedPosition;
    room: Room | null;
    property: { id: string; name: string } | null;
    locationId: string | null;
    bedCount: number;
    pricePerBed: number;
    conflict?: string; // Error message if conflict
    needsManualDate?: boolean; // True if position had invalid date (1970) and needs manual date input
}

type ImportStep = 'upload' | 'review' | 'matching' | 'importing' | 'success';

export const InvoiceImportView: React.FC<InvoiceImportViewProps> = ({
    locations,
    customers,
    bookings, // Receive bookings prop
    onImportComplete
}) => {
    // ... existing state ...
    const [step, setStep] = useState<ImportStep>('upload');
    const [file, setFile] = useState<File | null>(null);
    const [parsedData, setParsedData] = useState<ParsedInvoice | null>(null);
    const [parseError, setParseError] = useState<string | null>(null);
    const [duplicateError, setDuplicateError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [useAI, setUseAI] = useState(true); // Default to AI

    // Customer matching
    const [matchedCustomer, setMatchedCustomer] = useState<Customer | null>(null);
    const [isNewCustomer, setIsNewCustomer] = useState(false);
    const [newCustomerData, setNewCustomerData] = useState<Partial<Customer>>({});

    // Room matching
    const [roomMatches, setRoomMatches] = useState<RoomMatch[]>([]);


    // Import status
    const [importProgress, setImportProgress] = useState<string>('');
    const [importResults, setImportResults] = useState<{ invoiceId: string; bookingIds: string[] } | null>(null);

    // Flatten all rooms from locations
    const allRooms = useMemo(() => {
        const rooms: { room: Room; property: { id: string; name: string }; locationId: string }[] = [];
        locations.forEach(loc => {
            loc.properties.forEach(prop => {
                prop.rooms.forEach(room => {
                    rooms.push({
                        room,
                        property: { id: prop.id, name: prop.name },
                        locationId: loc.id
                    });
                });
            });
        });
        return rooms;
    }, [locations]);

    const handleFileDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        const droppedFile = e.dataTransfer.files[0];
        if (droppedFile && droppedFile.type === 'application/pdf') {
            await processFile(droppedFile);
        }
    }, [useAI]);

    const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            await processFile(selectedFile);
        }
    }, [useAI]);

    const processFile = async (selectedFile: File) => {
        setFile(selectedFile);
        setIsLoading(true);
        setParseError(null);

        try {
            let parsed;
            if (useAI) {
                console.log("Using AI Parser...");
                parsed = await parseInvoiceWithGemini(selectedFile);
            } else {
                console.log("Using Regex Parser...");
                parsed = await parsePdfInvoice(selectedFile);
            }

            if (parsed) {
                setParsedData(parsed);

                // Check for duplicate invoice
                if (parsed.invoiceNumber) {
                    const existingInvoice = await db.findInvoiceByNumber(parsed.invoiceNumber);
                    if (existingInvoice) {
                        setDuplicateError(`Nr. ${parsed.invoiceNumber} existiert bereits (Importiert am ${new Date(existingInvoice.created_at).toLocaleDateString()}).`);
                        // Do NOT clear parsedData, just warn
                        // setParsedData(null); 
                        setIsLoading(false);
                        // We continue to allow user to see/edit it
                    }
                }

                let foundCustomer = false;

                // Try to find existing customer by number
                if (parsed.customerNumber) {
                    const existing = await db.findCustomerByNumber(parsed.customerNumber);
                    if (existing) {
                        setMatchedCustomer(existing);
                        setIsNewCustomer(false);
                        foundCustomer = true;
                    }
                }

                if (!foundCustomer) {
                    // 2. Try to find by Email (from parsed PDF) (Priority 2)
                    if (parsed.customer.email) {
                        const existingByEmail = customers.find(c => c.email.toLowerCase() === parsed.customer.email?.toLowerCase());
                        if (existingByEmail) {
                            setMatchedCustomer(existingByEmail);
                            setIsNewCustomer(false);
                            foundCustomer = true;
                            console.log('Customer matched by email:', existingByEmail);
                        }
                    }
                }

                if (!foundCustomer) {
                    // Fallback: Try to find by name/company (Priority 3)
                    const nameToSearch = parsed.customer.company || parsed.customer.name;
                    if (nameToSearch) {
                        // Use local customers array first for consistency
                        const existingByName = customers.find(c =>
                            c.name.toLowerCase() === nameToSearch.toLowerCase() ||
                            (c.company && c.company.toLowerCase() === nameToSearch.toLowerCase())
                        );

                        if (existingByName) {
                            setMatchedCustomer(existingByName);
                            setIsNewCustomer(false);
                            foundCustomer = true;
                            console.log('Customer matched by name:', existingByName);
                        } else {
                            // Fallback to DB if huge list (but mostly covered by props)
                            const dbMatch = await db.findCustomerByName(nameToSearch);
                            if (dbMatch) {
                                setMatchedCustomer(dbMatch);
                                setIsNewCustomer(false);
                                foundCustomer = true;
                            }
                        }
                    }
                }

                if (!foundCustomer) {
                    // Customer not found -> Default to New Customer
                    setIsNewCustomer(true);
                    setNewCustomerData({
                        customerNumber: parsed.customerNumber || await db.generateNextCustomerNumber(),
                        name: parsed.customer.name || parsed.customer.company,
                        company: parsed.customer.company,
                        street: parsed.customer.street,
                        city: parsed.customer.city,
                        email: parsed.customer.email
                    });
                }

                // Match rooms... (code continues)


                // Match rooms
                const matches: RoomMatch[] = [];
                // Filter active bookings only for check
                const activeBookings = bookings.filter(b => b.status !== 'cancelled');

                for (const pos of parsed.positions) {
                    // Try to find room by roomName (e.g., "KB40b / WE14")
                    // If roomName is not available, construct it from property + unit
                    const searchName = pos.roomName || `${pos.property} / ${pos.unit}`;
                    console.log('Searching for room:', searchName);
                    const roomData = await db.findRoomByName(searchName);

                    if (roomData) {
                        const bedCount = roomData.room.capacity || 1;

                        // CHECK CONFLICT
                        let conflict: string | undefined;
                        const dates = eachDayOfInterval({ start: pos.startDate, end: pos.endDate });
                        // Don't check the very last day (checkout day)
                        const checkDates = dates.slice(0, dates.length - 1);

                        // But actually isRoomBooked helper handles checkout logic?
                        // Let's rely on isRoomBookedOnDate directly which handles logic
                        const isOccupied = checkDates.some(d => isRoomBookedOnDate(roomData.room, d, activeBookings));

                        if (isOccupied) {
                            conflict = `Bereits belegt im Zeitraum ${format(pos.startDate, 'dd.MM')} - ${format(pos.endDate, 'dd.MM')}`;
                        }

                        matches.push({
                            position: pos,
                            room: roomData.room,
                            property: { id: roomData.property.id, name: roomData.property.name },
                            locationId: roomData.locationId,
                            bedCount,
                            pricePerBed: bedCount > 0 ? pos.pricePerNightTotal / bedCount : pos.pricePerNightTotal,
                            conflict,
                            needsManualDate: pos.startDate.getFullYear() === 1970
                        });
                    } else {
                        // Room not found - need manual selection
                        matches.push({
                            position: pos,
                            room: null,
                            property: null,
                            locationId: null,
                            bedCount: pos.bedCount || 1,
                            pricePerBed: pos.pricePerNightTotal / (pos.bedCount || 1),
                            needsManualDate: pos.startDate.getFullYear() === 1970
                        });
                    }
                }
                setRoomMatches(matches);
                setStep('review');
            } else {
                setParseError('Die PDF konnte nicht geparst werden. Bitte prüfen Sie das Format.');
            }
        } catch (error) {
            console.error('Parse error:', error);
            setParseError('Fehler beim Parsen der PDF: ' + (error as Error).message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleRoomSelect = (index: number, roomId: string) => {
        const roomInfo = allRooms.find(r => r.room.id === roomId);
        if (!roomInfo) return;

        setRoomMatches(prev => prev.map((match, i) => {
            if (i === index) {
                const bedCount = roomInfo.room.capacity;

                // CHECK CONFLICT on manual select
                let conflict: string | undefined;
                const activeBookings = bookings.filter(b => b.status !== 'cancelled');
                const dates = eachDayOfInterval({ start: match.position.startDate, end: match.position.endDate });
                // Remove last day as checkout
                const checkDates = dates.slice(0, Math.max(1, dates.length - 1));

                const isOccupied = checkDates.some(d => isRoomBookedOnDate(roomInfo.room, d, activeBookings));
                if (isOccupied) {
                    conflict = `Bereits belegt im Zeitraum ${format(match.position.startDate, 'dd.MM')} - ${format(match.position.endDate, 'dd.MM')}`;
                }

                return {
                    ...match,
                    room: roomInfo.room,
                    property: roomInfo.property,
                    locationId: roomInfo.locationId,
                    bedCount,
                    pricePerBed: match.position.pricePerNightTotal / bedCount,
                    conflict
                };
            }
            return match;
        }));
    };

    const handleBedCountChange = (index: number, bedCount: number) => {
        setRoomMatches(prev => prev.map((match, i) => {
            if (i === index) {
                return {
                    ...match,
                    bedCount,
                    pricePerBed: match.position.pricePerNightTotal / bedCount
                };
            }
            return match;
        }));
    };

    // Handle manual date change for positions with invalid dates (e.g., cleaning fees)
    const handleDateChange = (index: number, dateString: string) => {
        if (!dateString) return;
        const newDate = new Date(dateString);

        setRoomMatches(prev => prev.map((match, i) => {
            if (i === index) {
                return {
                    ...match,
                    position: {
                        ...match.position,
                        startDate: newDate,
                        endDate: newDate,
                        nights: 0 // One-time fee
                    }
                };
            }
            return match;
        }));
    };

    const canProceed = useMemo(() => {
        // All rooms must be matched AND no duplicate error AND NO CONFLICTS AND valid dates
        const allRoomsMatched = roomMatches.every(m => m.room !== null && !m.conflict);
        const allDatesValid = roomMatches.every(m => m.position.startDate.getFullYear() !== 1970);
        const hasCustomer = matchedCustomer !== null || (isNewCustomer && newCustomerData.name);
        const hasInvoiceNumber = !!parsedData?.invoiceNumber;

        return allRoomsMatched && allDatesValid && hasCustomer && !duplicateError && hasInvoiceNumber;
    }, [roomMatches, matchedCustomer, isNewCustomer, newCustomerData, duplicateError, parsedData?.invoiceNumber]);

    // Check for duplicates when invoice number changes (debounced)
    useEffect(() => {
        if (!parsedData?.invoiceNumber) return;

        const checkDuplicate = async () => {
            const existing = await db.findInvoiceByNumber(parsedData.invoiceNumber);
            if (existing) {
                setDuplicateError(`Nr. ${parsedData.invoiceNumber} existiert bereits.`);
            } else {
                setDuplicateError(null);
            }
        };

        const timer = setTimeout(checkDuplicate, 500);
        return () => clearTimeout(timer);
    }, [parsedData?.invoiceNumber]);

    // LIVE CUSTOMER LOOKUP: Check if manually entered user exists (Debounced)
    // This runs when user types in the "Kunde" fields while in "Neu" mode
    useEffect(() => {
        // Only run if we are in "New Customer" mode and have some data
        if (!isNewCustomer || (!newCustomerData.name && !newCustomerData.email)) return;

        const checkCustomer = async () => {
            console.log('Live Checking Customer:', newCustomerData);
            let found: Customer | undefined;

            // 1. Check by Email (Strong Match)
            if (newCustomerData.email) {
                // Use props.customers for fast local lookup first
                found = customers.find(c => c.email.toLowerCase() === newCustomerData.email?.toLowerCase());
            }

            // 2. Check by Name / Company (if not found by email)
            if (!found && newCustomerData.name) {
                const searchName = newCustomerData.name.toLowerCase();
                found = customers.find(c =>
                    c.name.toLowerCase() === searchName ||
                    (c.company && c.company.toLowerCase() === searchName)
                );
            }

            if (found) {
                console.log('Customer match found during manual entry:', found);
                // Automatically switch to this customer? Or notify?
                // For now, let's auto-switch because that's what the user asked for:
                // "soll das system automatisch diesen kunden erkennen"
                setMatchedCustomer(found);
                setIsNewCustomer(false);
                setNewCustomerData({}); // clear manual data
            }
        };

        const timer = setTimeout(checkCustomer, 800); // 800ms debounce
        return () => clearTimeout(timer);
    }, [newCustomerData.name, newCustomerData.email, isNewCustomer, customers]);

    const handleImport = async () => {
        if (!parsedData || !canProceed) return;

        setStep('importing');
        setIsLoading(true);

        try {
            // 1. Create or get customer
            let customerId: string;
            let customerForSnapshot: Customer;

            if (isNewCustomer && newCustomerData.name) {
                // LAST SAFETY CHECK: Does this customer already exist by name?
                // The user might have manually entered a name that exists
                const existingByName = await db.findCustomerByName(newCustomerData.company || newCustomerData.name);

                if (existingByName) {
                    console.log('Found existing customer by name, using instead of creating new:', existingByName);
                    customerId = existingByName.id;
                    customerForSnapshot = existingByName;
                    setImportProgress(`Vorhandener Kunde gefunden: ${existingByName.company || existingByName.name}`);
                } else {
                    setImportProgress('Kunde wird angelegt...');
                    const nextNumber = await db.generateNextCustomerNumber();
                    const newCustomer: Customer = {
                        id: crypto.randomUUID(),
                        customerNumber: parsedData.customerNumber || nextNumber,
                        name: newCustomerData.name,
                        email: newCustomerData.email || '',
                        phone: newCustomerData.phone,
                        company: newCustomerData.company,
                        street: newCustomerData.street || '',
                        zip: newCustomerData.zip || '',
                        city: newCustomerData.city || '',
                    };
                    customerId = await db.saveCustomer(newCustomer);
                    customerForSnapshot = newCustomer;
                }
            } else if (matchedCustomer) {
                customerId = matchedCustomer.id;
                customerForSnapshot = matchedCustomer;
            } else {
                throw new Error('Kein Kunde ausgewählt');
            }

            // 2. Create invoice
            setImportProgress('Rechnung wird erstellt...');
            const invoiceId = crypto.randomUUID();

            // Upload PDF
            let pdfPath = undefined;
            if (file) {
                try {
                    setImportProgress('PDF wird hochgeladen...');
                    pdfPath = await db.uploadInvoicePdf(file, invoiceId);
                } catch (error) {
                    console.error('Error uploading PDF:', error);
                    // Continue without PDF
                }
            }

            const invoice: Invoice = {
                id: invoiceId,
                invoiceNumber: parsedData.invoiceNumber,
                customerId,
                customerName: customerForSnapshot.company || customerForSnapshot.name,
                customerNumber: customerForSnapshot.customerNumber,
                billingAddress: `${customerForSnapshot.street}\n${customerForSnapshot.zip} ${customerForSnapshot.city}`,
                date: parsedData.invoiceDate,
                dueDate: new Date(parsedData.invoiceDate.getTime() + 14 * 24 * 60 * 60 * 1000), // +14 days
                servicePeriodStart: parsedData.servicePeriodStart,
                servicePeriodEnd: parsedData.servicePeriodEnd,
                netAmount: parsedData.netAmount,
                vatAmount: parsedData.vatAmount,
                amount: parsedData.grossAmount,
                status: 'paid', // Assuming imported invoices are already paid
                pdfPath,
                items: parsedData.positions.map((pos, idx) => ({
                    pos: idx + 1,
                    description: `${pos.property} / ${pos.unit} / ${format(pos.startDate, 'dd.MM.yyyy')}-${format(pos.endDate, 'dd.MM.yyyy')}`,
                    details: pos.details,
                    quantity: pos.nights,
                    unit: 'Tage' as const,
                    unitPrice: pos.pricePerNightTotal,
                    total: pos.total,
                    vatRate: parsedData.vatRate,
                })),
                created_at: new Date()
            };

            await db.saveInvoice(invoice);

            // 3. Create bookings for each position
            const bookingIds: string[] = [];

            for (let i = 0; i < roomMatches.length; i++) {
                const match = roomMatches[i];
                const pos = match.position;

                setImportProgress(`Buchung ${i + 1}/${roomMatches.length} wird erstellt...`);

                const bookingId = crypto.randomUUID();
                const projectName = generateProjectName(
                    parsedData.customerNumber,
                    pos.property,
                    pos.startDate,
                    pos.endDate
                );

                const booking: Booking = {
                    id: bookingId,
                    customerName: customerForSnapshot.company || customerForSnapshot.name,
                    companyName: customerForSnapshot.company,
                    customerId,
                    invoiceId,
                    projectName,
                    locationId: match.locationId || '',
                    propertyId: match.property?.id,
                    roomId: match.room?.id,
                    bedCount: match.bedCount,
                    startDate: pos.startDate,
                    endDate: pos.endDate,
                    roomAssignments: match.room ? [{ roomId: match.room.id, beds: match.bedCount }] : [],
                    pricePerBedPerNight: match.pricePerBed,
                    status: 'confirmed',
                    invoiceNumber: parsedData.invoiceNumber,
                    customerNumber: parsedData.customerNumber,
                    billingAddress: invoice.billingAddress,
                };

                await db.saveBooking(booking, customerForSnapshot);
                bookingIds.push(bookingId);
            }

            setImportResults({ invoiceId, bookingIds });
            setStep('success');
        } catch (error: any) {
            console.error('Import error:', error);
            if (error?.code === '23505' || error?.message?.includes('duplicate key')) {
                setParseError(`Diese Rechnung (Nr. ${parsedData?.invoiceNumber}) wurde bereits importiert.`);
            } else {
                setParseError('Import fehlgeschlagen: ' + (error instanceof Error ? error.message : String(error)));
            }
            setStep('review');
        } finally {
            setIsLoading(false);
        }
    };

    const resetImport = () => {
        setFile(null);
        setParsedData(null);
        setParseError(null);
        setMatchedCustomer(null);
        setIsNewCustomer(false);
        setNewCustomerData({});
        setRoomMatches([]);
        setImportResults(null);
        setStep('upload');
    };

    const formatCurrency = (amount: number) =>
        new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount);

    const formatDate = (date: Date) => format(date, 'dd.MM.yyyy');

    // Render upload step
    if (step === 'upload') {
        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Rechnungs-Import</h1>
                        <p className="text-gray-500 mt-1">PDF-Rechnungen importieren und automatisch Buchungen erstellen</p>
                    </div>
                </div>

                <Card className="border-2 border-dashed border-gray-300 hover:border-blue-400 transition-colors">
                    <CardContent className="p-12">
                        <div
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={handleFileDrop}
                            className="text-center"
                        >
                            {isLoading ? (
                                <div className="flex flex-col items-center gap-4">
                                    <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
                                    <p className="text-gray-600">PDF wird verarbeitet...</p>
                                </div>
                            ) : (
                                <>
                                    <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                                        PDF-Rechnung hochladen
                                    </h3>
                                    <p className="text-gray-500 mb-4">
                                        Ziehen Sie eine PDF-Datei hierher oder klicken Sie zum Auswählen
                                    </p>
                                    <input
                                        type="file"
                                        accept=".pdf"
                                        onChange={handleFileSelect}
                                        className="hidden"
                                        id="pdf-upload"
                                    />
                                    <label
                                        htmlFor="pdf-upload"
                                        className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700 transition-colors font-medium"
                                    >
                                        PDF auswählen
                                    </label>
                                </>
                            )}
                        </div>

                        <div className="mt-6 flex items-center justify-center gap-2">
                            <input
                                type="checkbox"
                                id="useAI"
                                checked={useAI}
                                onChange={(e) => setUseAI(e.target.checked)}
                                className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                            />
                            <label htmlFor="useAI" className="text-sm text-gray-700 select-none cursor-pointer">
                                AI-Erkennung nutzen (Gemini) - Empfohlen
                            </label>
                        </div>
                    </CardContent>
                </Card>

                {parseError && (
                    <Card className="bg-red-50 border-red-200">
                        <CardContent className="p-4 flex items-center gap-3">
                            <AlertTriangle className="w-5 h-5 text-red-500" />
                            <p className="text-red-700">{parseError}</p>
                        </CardContent>
                    </Card>
                )}
            </div>
        );
    }

    // Render review step
    if (step === 'review' && parsedData) {
        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Import prüfen</h1>
                        <p className="text-gray-500 mt-1">
                            {file?.name} - {parsedData.invoiceNumber}
                        </p>
                    </div>
                    <Button variant="outline" onClick={resetImport}>
                        <X className="w-4 h-4 mr-2" />
                        Abbrechen
                    </Button>
                </div>

                {/* Invoice Info */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <FileText className="w-5 h-5" />
                            Rechnungsdaten
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                                <p className="text-sm text-gray-500 mb-1">Rechnungsnummer</p>
                                <Input
                                    value={parsedData.invoiceNumber}
                                    onChange={(e) => {
                                        const newNumber = e.target.value;
                                        setParsedData(prev => prev ? { ...prev, invoiceNumber: newNumber } : null);
                                        // Reset duplicate error when typing
                                        if (duplicateError) setDuplicateError(null);
                                    }}
                                    className={duplicateError ? "border-red-500 bg-red-50" : ""}
                                />
                                {duplicateError && <p className="text-xs text-red-600 mt-1">{duplicateError}</p>}
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">Kundennummer</p>
                                <p className="font-medium">{parsedData.customerNumber}</p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">Datum</p>
                                <p className="font-medium">{formatDate(parsedData.invoiceDate)}</p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">Netto</p>
                                <p className="font-medium">{formatCurrency(parsedData.netAmount)}</p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">MwSt ({parsedData.vatRate}%)</p>
                                <p className="font-medium">{formatCurrency(parsedData.vatAmount)}</p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">Gesamt (Brutto)</p>
                                <p className="font-medium text-green-600">{formatCurrency(parsedData.grossAmount)}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Customer Info */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <User className="w-5 h-5" />
                                Kunde
                                {matchedCustomer && (
                                    <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                                        Gefunden
                                    </span>
                                )}
                                {isNewCustomer && (
                                    <span className="ml-2 px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded-full">
                                        Neu
                                    </span>
                                )}
                            </div>
                            {matchedCustomer && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                        // Allow user to manually create new if wrong match
                                        setMatchedCustomer(null);
                                        setIsNewCustomer(true);
                                        setNewCustomerData({
                                            name: parsedData.customer.name,
                                            company: parsedData.customer.company,
                                            email: parsedData.customer.email, // Keep extracted email
                                        });
                                    }}
                                    className="h-6 text-xs text-blue-600 hover:text-blue-800"
                                >
                                    Ändern / Neu anlegen
                                </Button>
                            )}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {matchedCustomer ? (
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                <div>
                                    <p className="text-sm text-gray-500">Firma</p>
                                    <p className="font-medium">{matchedCustomer.company || matchedCustomer.name}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500">Kundennummer</p>
                                    <p className="font-medium">{matchedCustomer.customerNumber}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500">Adresse</p>
                                    <p className="font-medium">{matchedCustomer.street}, {matchedCustomer.zip} {matchedCustomer.city}</p>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <p className="text-sm text-yellow-700 bg-yellow-50 p-3 rounded">
                                    Kein existierender Kunde mit Nummer {parsedData.customerNumber} gefunden.
                                    Bitte vervollständigen Sie die Kundendaten:
                                </p>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Firma / Name *
                                        </label>
                                        <Input
                                            value={newCustomerData.name || ''}
                                            onChange={(e) => setNewCustomerData(prev => ({ ...prev, name: e.target.value }))}
                                            placeholder="Firmenname"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Email
                                        </label>
                                        <Input
                                            type="email"
                                            value={newCustomerData.email || ''}
                                            onChange={(e) => setNewCustomerData(prev => ({ ...prev, email: e.target.value }))}
                                            placeholder="email@example.com"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Straße
                                        </label>
                                        <Input
                                            value={newCustomerData.street || ''}
                                            onChange={(e) => setNewCustomerData(prev => ({ ...prev, street: e.target.value }))}
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">PLZ</label>
                                            <Input
                                                value={newCustomerData.zip || ''}
                                                onChange={(e) => setNewCustomerData(prev => ({ ...prev, zip: e.target.value }))}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Stadt</label>
                                            <Input
                                                value={newCustomerData.city || ''}
                                                onChange={(e) => setNewCustomerData(prev => ({ ...prev, city: e.target.value }))}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Positions / Bookings */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Building className="w-5 h-5" />
                            Buchungen ({roomMatches.length})
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {roomMatches.map((match, index) => (
                                <div
                                    key={index}
                                    className={`p-4 rounded-lg border ${match.room ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className="font-medium">
                                                    {match.position.roomName || match.position.unit}
                                                </span>
                                                {match.room && !match.conflict ? (
                                                    <CheckCircle className="w-4 h-4 text-green-500" />
                                                ) : (
                                                    <AlertTriangle className="w-4 h-4 text-red-500" />
                                                )}
                                                {match.conflict && (
                                                    <span className="text-xs font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded">
                                                        {match.conflict}
                                                    </span>
                                                )}
                                            </div>
                                            <div className={`grid gap-3 text-sm ${match.position.isOneTimeFee ? 'grid-cols-2 md:grid-cols-2' : 'grid-cols-2 md:grid-cols-4'}`}>
                                                <div>
                                                    <p className="text-gray-500">{match.position.isOneTimeFee ? 'Datum' : 'Zeitraum'}</p>
                                                    {/* Show date input if position needs manual date entry */}
                                                    {match.needsManualDate ? (
                                                        <div className="flex items-center gap-2">
                                                            <input
                                                                type="date"
                                                                className="p-1 border border-orange-300 rounded bg-orange-50 text-sm"
                                                                value={match.position.startDate.getFullYear() !== 1970
                                                                    ? match.position.startDate.toISOString().split('T')[0]
                                                                    : ''}
                                                                onChange={(e) => handleDateChange(index, e.target.value)}
                                                            />
                                                            {match.position.startDate.getFullYear() === 1970 && (
                                                                <span className="text-xs text-orange-600">(Datum wählen)</span>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <p>
                                                            {match.position.isOneTimeFee
                                                                ? formatDate(match.position.startDate)
                                                                : `${formatDate(match.position.startDate)} - ${formatDate(match.position.endDate)}`
                                                            }
                                                        </p>
                                                    )}
                                                </div>
                                                {/* Only show nights and price/night for regular bookings, not one-time fees */}
                                                {!match.position.isOneTimeFee && (
                                                    <>
                                                        <div>
                                                            <p className="text-gray-500">Nächte</p>
                                                            <p>{match.position.nights}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-gray-500">Preis/Nacht (Wohnung)</p>
                                                            <p>{formatCurrency(match.position.pricePerNightTotal)}</p>
                                                        </div>
                                                    </>
                                                )}
                                                <div>
                                                    <p className="text-gray-500">
                                                        {match.position.isOneTimeFee ? 'Pauschal' : 'Gesamt'}
                                                    </p>
                                                    <p className="font-medium">{formatCurrency(match.position.total)}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Room selection if not matched */}
                                    {!match.room && (
                                        <div className="mt-4 pt-4 border-t border-yellow-300">
                                            <p className="text-sm text-yellow-700 mb-2">
                                                Wohnung "{match.position.roomName || match.position.unit}" nicht gefunden. Bitte manuell zuordnen:
                                            </p>
                                            <select
                                                className="w-full p-2 border rounded"
                                                onChange={(e) => handleRoomSelect(index, e.target.value)}
                                                value=""
                                            >
                                                <option value="">Wohnung auswählen...</option>
                                                {allRooms.map(r => (
                                                    <option key={r.room.id} value={r.room.id}>
                                                        {r.property.name} - {r.room.name} ({r.room.capacity} Betten)
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    )}

                                    {/* Bed count and price per bed - only for regular bookings, not one-time fees */}
                                    {match.room && !match.position.isOneTimeFee && (
                                        <div className="mt-4 pt-4 border-t border-green-300 flex items-center gap-6">
                                            <div className="flex items-center gap-2">
                                                <label className="text-sm text-gray-600">Betten:</label>
                                                <Input
                                                    type="number"
                                                    min={1}
                                                    value={match.bedCount}
                                                    onChange={(e) => handleBedCountChange(index, parseInt(e.target.value) || 1)}
                                                    className="w-20"
                                                />
                                            </div>
                                            <div className="text-sm">
                                                <span className="text-gray-500">Preis pro Bett/Nacht:</span>
                                                <span className="ml-2 font-medium text-blue-600">
                                                    {formatCurrency(match.pricePerBed)}
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Validation Warnings */}
                {!canProceed && (
                    <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded text-yellow-800">
                        <p className="font-bold flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4" />
                            Import nicht möglich:
                        </p>
                        <ul className="list-disc pl-5 mt-1 text-sm">
                            {roomMatches.some(m => m.room === null) && (
                                <li>Bitte alle rot markierten Wohnungen manuell zuordnen.</li>
                            )}
                            {roomMatches.some(m => m.position.startDate.getFullYear() === 1970) && (
                                <li>Bitte für alle Positionen ein gültiges Datum wählen.</li>
                            )}
                            {isNewCustomer && !newCustomerData.name && (
                                <li>Bitte den Namen des Kunden angeben.</li>
                            )}
                        </ul>
                    </div>
                )}

                {/* Import Button */}
                <div className="flex justify-end gap-4">
                    <Button variant="outline" onClick={resetImport}>
                        Abbrechen
                    </Button>
                    <Button
                        onClick={() => {
                            console.log('Button clicked. CanProceed:', canProceed, 'Docs:', { parsedData, roomMatches, newCustomerData });
                            handleImport();
                        }}
                        disabled={!canProceed || isLoading}
                        className="bg-green-600 hover:bg-green-700 disabled:opacity-50"
                    >
                        <ChevronRight className="w-4 h-4 mr-2" />
                        {isLoading ? 'Import läuft...' : 'Import starten'}
                    </Button>
                </div>

                {parseError && (
                    <Card className="bg-red-50 border-red-200">
                        <CardContent className="p-4 flex items-center gap-3">
                            <AlertTriangle className="w-5 h-5 text-red-500" />
                            <p className="text-red-700">{parseError}</p>
                        </CardContent>
                    </Card>
                )}
            </div>
        );
    }

    // Render importing step
    if (step === 'importing') {
        return (
            <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="w-16 h-16 text-blue-500 animate-spin mb-6" />
                <h2 className="text-xl font-medium text-gray-900 mb-2">Import läuft...</h2>
                <p className="text-gray-500">{importProgress}</p>
            </div>
        );
    }

    // Render success step
    if (step === 'success' && importResults) {
        return (
            <div className="space-y-6">
                <Card className="bg-green-50 border-green-200">
                    <CardContent className="p-8 text-center">
                        <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                        <h2 className="text-2xl font-bold text-green-800 mb-2">Import erfolgreich!</h2>
                        <p className="text-green-700 mb-6">
                            Die Rechnung und {importResults.bookingIds.length} Buchung(en) wurden angelegt.
                        </p>
                        <div className="flex justify-center gap-4">
                            <Button variant="outline" onClick={resetImport}>
                                Weitere Rechnung importieren
                            </Button>
                            <Button onClick={onImportComplete}>
                                Fertig
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return null;
};
