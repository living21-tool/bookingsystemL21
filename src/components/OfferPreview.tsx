import React, { useMemo } from 'react';
import { Dialog, DialogContent, DialogClose } from './ui/Dialog';
import { Button } from './ui/Button';
import { Booking, Location, CompanySettings } from '../types';
import { format } from 'date-fns';
import { Send, Download } from 'lucide-react';
// @ts-ignore
import html2pdf from 'html2pdf.js';

interface OfferPreviewProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    booking: Booking;
    locations: Location[];
    companySettings?: CompanySettings;
    onSendOffer: () => void;
}

export const OfferPreview: React.FC<OfferPreviewProps> = ({
    open,
    onOpenChange,
    booking,
    locations,
    companySettings,
    onSendOffer,
}) => {
    const nights = Math.ceil(
        (booking.endDate.getTime() - booking.startDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Generate Invoice Items per Room
    const items = useMemo(() => {
        const createdItems: any[] = [];
        let posCounter = 1;

        // 1. Rent Items (per room)
        // 1. Rent Items (per room)
        if (booking.roomAssignments && booking.roomAssignments.length > 0) {
            booking.roomAssignments.forEach(assignment => {
                const { roomId, beds } = assignment;
                let roomName = roomId;
                let propertyName = '';

                // Detailed lookup
                for (const loc of locations) {
                    for (const prop of loc.properties) {
                        const room = prop.rooms.find(r => r.id === roomId);
                        if (room) {
                            propertyName = prop.name;
                            roomName = room.name;
                            break;
                        }
                    }
                    if (propertyName) break;
                }

                if (!propertyName) {
                    propertyName = "Unbekannt";
                    roomName = roomId;
                }

                createdItems.push({
                    pos: posCounter++,
                    description: `Miete Wohnobjekt ${propertyName} - ${roomName}`,
                    details: `${beds} Bett${beds > 1 ? 'en' : ''}, Zeitraum: ${format(booking.startDate, 'dd.MM.yyyy')} - ${format(booking.endDate, 'dd.MM.yyyy')}`,
                    quantity: nights,
                    unit: 'Tage',
                    unitPrice: beds * booking.pricePerBedPerNight,
                    vatRate: 0.07,
                    total: nights * (beds * booking.pricePerBedPerNight)
                });
            });
        }
        // Fallback for legacy bookings (using full capacity or just 1 bed per room assumption?)
        else if (booking.assignedRooms) {
            booking.assignedRooms.forEach(roomId => {
                // ... (Legacy Logic - potentially inaccurate but needed for old mocks)
                let roomName = roomId;
                let bedsInRoom = 0;
                let propertyName = '';

                for (const loc of locations) {
                    for (const prop of loc.properties) {
                        const room = prop.rooms.find(r => r.id === roomId);
                        if (room) {
                            propertyName = prop.name;
                            roomName = room.name;
                            bedsInRoom = room.capacity;
                            break;
                        }
                    }
                    if (propertyName) break;
                }

                // Fallback details...
                createdItems.push({
                    pos: posCounter++,
                    description: `Miete Wohnobjekt ${propertyName} - ${roomName}`,
                    details: `${bedsInRoom} Betten (Kapazität), Zeitraum: ${format(booking.startDate, 'dd.MM.yyyy')} - ${format(booking.endDate, 'dd.MM.yyyy')}`,
                    quantity: nights,
                    unit: 'Tage',
                    unitPrice: bedsInRoom * booking.pricePerBedPerNight,
                    vatRate: 0.07,
                    total: nights * (bedsInRoom * booking.pricePerBedPerNight)
                });
            });
        }

        // 2. Cleaning Item (Mock logic: 1 per room)
        const roomCount = booking.assignedRooms?.length || 1;
        createdItems.push({
            pos: posCounter++,
            description: 'Endreinigung',
            details: 'Pauschale pro Zimmer bei Mietbeginn',
            quantity: roomCount,
            unit: 'Stück',
            unitPrice: 90.00,
            vatRate: 0.19,
            total: roomCount * 90.00
        });

        return createdItems;
    }, [booking, locations, nights]);


    const netTotal = items.reduce((sum, item) => sum + item.total, 0);
    const vat7 = items.filter(i => i.vatRate === 0.07).reduce((sum, i) => sum + (i.total * 0.07), 0);
    const vat19 = items.filter(i => i.vatRate === 0.19).reduce((sum, i) => sum + (i.total * 0.19), 0);
    const grossTotal = netTotal + vat7 + vat19;



    const [zoom, setZoom] = React.useState(0.6);

    const handleDownloadPDF = () => {
        const element = document.getElementById('invoice-preview-container');
        if (!element) return;

        const opt = {
            margin: 0,
            filename: `Rechnung_${booking.invoiceNumber || 'Entwurf'}.pdf`,
            image: { type: 'jpeg' as const, quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as const }
        };

        html2pdf().set(opt).from(element).save();
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[95vw] h-[90vh] overflow-hidden bg-gray-100 p-0 flex flex-col items-center">
                <DialogClose className="absolute right-4 top-4 z-50 text-gray-500 hover:text-gray-900 print:hidden" onClose={() => onOpenChange(false)} />

                {/* Action Bar */}
                <div className="w-full bg-white p-4 border-b flex justify-between items-center shrink-0 z-40 print:hidden">
                    <div className="text-sm font-medium flex items-center gap-4">
                        Angebotsvorschau
                        <div className="flex items-center gap-2 bg-gray-100 rounded p-1">
                            <Button variant="ghost" size="sm" onClick={() => setZoom(Math.max(0.3, zoom - 0.1))} className="h-6 w-6 p-0">-</Button>
                            <span className="text-xs w-12 text-center">{Math.round(zoom * 100)}%</span>
                            <Button variant="ghost" size="sm" onClick={() => setZoom(Math.min(1.5, zoom + 0.1))} className="h-6 w-6 p-0">+</Button>
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="bg-white" onClick={handleDownloadPDF}>
                            <Download className="w-4 h-4 mr-2" />
                            PDF Downloaden
                        </Button>
                        <Button size="sm" onClick={onSendOffer} className="bg-blue-600 hover:bg-blue-700 text-white">
                            <Send className="w-4 h-4 mr-2" />
                            Senden
                        </Button>
                    </div>
                </div>


                {/* Scrollable Preview Area */}
                <div className="flex-1 w-full overflow-auto p-8 flex justify-center bg-gray-100">

                    {/* Zoom Wrapper */}
                    <div className="transition-transform origin-top" style={{ transform: `scale(${zoom})` }}>
                        {/* A4 Page Container - Print Target */}
                        <div
                            id="invoice-preview-container"
                            className="bg-white shadow-2xl w-[210mm] min-h-[296.8mm] p-12 text-sm text-gray-900 font-sans relative shrink-0"
                        >

                            {/* Header */}
                            <div className="flex justify-between items-start mb-16">
                                <div>
                                    <div className="w-32 h-32 bg-[#4a5d4e] rounded-xl flex items-center justify-center mb-2">
                                        <span className="text-white text-4xl font-light">L21</span>
                                    </div>
                                    <div className="text-xs text-gray-500">{companySettings?.website || 'living-21.com'}</div>
                                </div>
                                <div className="text-right space-y-1">
                                    <h1 className="text-3xl font-regular mb-4">Rechnung {booking.invoiceNumber}</h1>
                                    <div className="grid grid-cols-[100px_1fr] gap-x-4 text-sm">
                                        <span className="text-gray-600 text-right">Rechnungsnr.:</span>
                                        <span className="font-medium">{booking.invoiceNumber || 'ENTWURF'}</span>

                                        <span className="text-gray-600 text-right">Kundennr.:</span>
                                        <span className="font-medium">{booking.customerNumber || '---'}</span>

                                        <span className="text-gray-600 text-right">Datum:</span>
                                        <span className="font-medium">{format(new Date(), 'dd.MM.yyyy')}</span>

                                        <span className="text-gray-600 text-right">Leistungszeitraum:</span>
                                        <div className="text-right">
                                            {format(booking.startDate, 'dd.MM.yyyy')}<br />
                                            bis {format(booking.endDate, 'dd.MM.yyyy')}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Sender & Receiver Address */}
                            <div className="mb-16 grid grid-cols-2 gap-8">
                                <div>
                                    <div className="text-[10px] underline mb-2 text-gray-500">
                                        {companySettings?.name || 'Living 21 GmbH'}, {companySettings?.address || 'Rotberger Str. 3b'}, {companySettings?.zipCity || '12529 Schönefeld'}
                                    </div>
                                    <div className="font-medium text-lg leading-relaxed">
                                        {booking.billingAddress ? (
                                            booking.billingAddress.split('\n').map((line, index) => (
                                                <div key={index} className={index === 0 ? "font-bold" : ""}>
                                                    {line}
                                                </div>
                                            ))
                                        ) : (
                                            <div className="text-gray-400">Keine Rechnungsadresse</div>
                                        )}
                                    </div>
                                </div>
                                <div className="text-right text-sm text-gray-600 leading-relaxed">
                                    {companySettings?.name || 'Living 21 GmbH'}<br />
                                    {companySettings?.address || 'Rotberger Str. 3b'}<br />
                                    {companySettings?.zipCity || '12529 Schönefeld'}<br />
                                    {companySettings?.phone && <>Tel.: {companySettings.phone}<br /></>}
                                    {companySettings?.email || 'buchung@living-21.com'}
                                </div>
                            </div>

                            {/* Invoice Table */}
                            <table className="w-full mb-8 border-collapse">
                                <thead>
                                    <tr className="border-b-2 border-black">
                                        <th className="py-2 text-left w-12 font-bold">Pos.</th>
                                        <th className="py-2 text-left font-bold">Bezeichnung</th>
                                        <th className="py-2 text-right w-20 font-bold">Menge</th>
                                        <th className="py-2 text-center w-20 font-bold">Einheit</th>
                                        <th className="py-2 text-right w-24 font-bold">Einzel €</th>
                                        <th className="py-2 text-right w-24 font-bold">Gesamt €</th>
                                    </tr>
                                </thead>
                                <tbody className="text-sm">
                                    {items.map((item) => (
                                        <tr key={item.pos} className="border-b border-gray-300 align-top">
                                            <td className="py-4 font-medium">{item.pos}</td>
                                            <td className="py-4 pr-4">
                                                <strong className="block text-base mb-1">{item.description}</strong>
                                                <p className="text-gray-600 leading-relaxed">{item.details}</p>
                                            </td>
                                            <td className="py-4 text-right">{item.quantity}</td>
                                            <td className="py-4 text-center">{item.unit}</td>
                                            <td className="py-4 text-right">{item.unitPrice.toFixed(2).replace('.', ',')}</td>
                                            <td className="py-4 text-right text-base">{item.total.toFixed(2).replace('.', ',')}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="text-sm">
                                    <tr>
                                        <td colSpan={5} className="pt-4 pb-1 text-right">Zwischensumme (netto)</td>
                                        <td className="pt-4 pb-1 text-right">{netTotal.toFixed(2).replace('.', ',')}</td>
                                    </tr>
                                    {vat7 > 0 && (
                                        <tr>
                                            <td colSpan={5} className="py-1 text-right">Umsatzsteuer 7 %</td>
                                            <td className="py-1 text-right">{vat7.toFixed(2).replace('.', ',')}</td>
                                        </tr>
                                    )}
                                    {vat19 > 0 && (
                                        <tr>
                                            <td colSpan={5} className="py-1 text-right">Umsatzsteuer 19 %</td>
                                            <td className="py-1 text-right">{vat19.toFixed(2).replace('.', ',')}</td>
                                        </tr>
                                    )}
                                    <tr className="font-bold text-lg">
                                        <td colSpan={5} className="pt-2 pb-4 text-right">Gesamtbetrag</td>
                                        <td className="pt-2 pb-4 text-right">{grossTotal.toFixed(2).replace('.', ',')}</td>
                                    </tr>
                                </tfoot>
                            </table>

                            <div className="absolute bottom-12 left-12 right-12 text-[10px] text-gray-500 border-t border-gray-300 pt-4">
                                <div className="grid grid-cols-4 gap-4">
                                    {/* Column 1: Address */}
                                    <div>
                                        <div className="font-bold text-gray-700 mb-1">{companySettings?.name || 'Living 21 GmbH'}</div>
                                        <div>{companySettings?.address || 'Rotberger Str. 3b'}</div>
                                        <div>{companySettings?.zipCity || '12529 Schönefeld'}</div>
                                    </div>

                                    {/* Column 2: Contact */}
                                    <div>
                                        <div className="font-bold text-gray-700 mb-1">Kontakt</div>
                                        {companySettings?.phone && <div>Tel: {companySettings.phone}</div>}
                                        {companySettings?.email && <div>Email: {companySettings.email}</div>}
                                        {companySettings?.website && <div>Web: {companySettings.website}</div>}
                                    </div>

                                    {/* Column 3: Legal */}
                                    <div>
                                        <div className="font-bold text-gray-700 mb-1">Geschäftsführung</div>
                                        <div>{companySettings?.ceo || 'Max Mustermann'}</div>
                                        <div className="mt-1">{companySettings?.court || 'Amtsgericht Berlin'}</div>
                                        <div>{companySettings?.hrb || 'HRB 12345'}</div>
                                    </div>

                                    {/* Column 4: Bank & Tax */}
                                    <div>
                                        <div className="font-bold text-gray-700 mb-1">Bankverbindung & Steuern</div>
                                        <div>{companySettings?.bankName}</div>
                                        <div>IBAN: {companySettings?.iban}</div>
                                        <div>BIC: {companySettings?.bic}</div>
                                        <div className="mt-1">St.-Nr.: {companySettings?.taxId || '---'}</div>
                                        <div>USt-IdNr.: {companySettings?.vatId || '---'}</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            </DialogContent>
        </Dialog>
    );
};
