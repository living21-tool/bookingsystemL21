import React from 'react';
import { Booking, Location } from '../types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from './ui/Dialog';

import { Trash2 } from 'lucide-react'; // Import Icon

interface BookingDetailDialogProps {
    booking: Booking | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    locations: Location[];
    onStatusChange: (bookingId: string, status: 'reserved' | 'confirmed') => void;
    onCancel: (bookingId: string) => void;
    onDelete: (bookingId: string) => void;
    onShowOffer?: () => void;
}

export const BookingDetailDialog: React.FC<BookingDetailDialogProps> = ({
    booking,
    open,
    onOpenChange,
    locations,
    onStatusChange,
    onCancel,
    onDelete,
    onShowOffer
}) => {
    // ...


    if (!booking) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-xl">
                <DialogHeader>
                    <DialogTitle>Buchungsdetails</DialogTitle>
                    <DialogClose onClose={() => onOpenChange(false)} />
                </DialogHeader>
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <h4 className="text-sm font-medium text-gray-500">Kunde</h4>
                            <p className="font-medium">{booking.customerName}</p>
                            {booking.companyName && <p className="text-sm text-gray-600">{booking.companyName}</p>}
                        </div>
                        <div>
                            <h4 className="text-sm font-medium text-gray-500">Projekt</h4>
                            <p className="font-medium">{booking.projectName}</p>
                        </div>
                        <div>
                            <h4 className="text-sm font-medium text-gray-500">Status</h4>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium 
                                ${booking.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                                    booking.status === 'cancelled' ? 'bg-red-100 text-red-800' : 'bg-purple-100 text-purple-800'}`}>
                                {booking.status === 'confirmed' ? 'Bestätigt' :
                                    booking.status === 'cancelled' ? 'Storniert' : 'Reserviert'}
                            </span>
                        </div>
                        <div>
                            <h4 className="text-sm font-medium text-gray-500">Rechnungsnummer</h4>
                            <p className="font-mono text-sm">{booking.invoiceNumber || '-'}</p>
                        </div>
                        <div>
                            <h4 className="text-sm font-medium text-gray-500">Zeitraum</h4>
                            <p>{new Date(booking.startDate).toLocaleDateString()} - {new Date(booking.endDate).toLocaleDateString()}</p>
                        </div>
                        <div>
                            <h4 className="text-sm font-medium text-gray-500">Betten</h4>
                            <p>{booking.bedCount} Betten ({booking.pricePerBedPerNight}€/Nacht)</p>
                        </div>
                    </div>

                    <div className="pt-4 border-t border-gray-100">
                        <h4 className="text-sm font-medium text-gray-500 mb-2">Rechnungsadresse</h4>
                        <div className="bg-gray-50 p-3 rounded text-sm whitespace-pre-line text-gray-700">
                            {booking.billingAddress || 'Keine Adresse hinterlegt'}
                        </div>
                    </div>

                    <div className="pt-4 border-t border-gray-100">
                        <h4 className="text-sm font-medium text-gray-500 mb-2">Zugeordnete Zimmer / Einheiten</h4>
                        <div className="bg-gray-50 rounded border border-gray-200 divide-y divide-gray-200">
                            {(booking.roomAssignments || []).length > 0 ? (
                                booking.roomAssignments?.map((assignment, idx) => {
                                    // Resolve Names
                                    let propName = 'Unbekannt';
                                    let roomName = assignment.roomId;

                                    // Find property and room
                                    for (const loc of locations) {
                                        const prop = loc.properties.find(p => p.rooms.some(r => r.id === assignment.roomId));
                                        if (prop) {
                                            propName = prop.name;
                                            const room = prop.rooms.find(r => r.id === assignment.roomId);
                                            if (room) roomName = room.name;
                                            break;
                                        }
                                    }

                                    return (
                                        <div key={idx} className="p-3 text-sm flex justify-between items-center">
                                            <div>
                                                <span className="font-semibold text-gray-900">{propName}</span>
                                                <span className="mx-2 text-gray-400">|</span>
                                                <span className="text-gray-700">WE {roomName}</span>
                                            </div>
                                            <div className="text-gray-600 bg-white border border-gray-200 px-2 py-0.5 rounded text-xs">
                                                {assignment.beds} {assignment.beds === 1 ? 'Bett' : 'Betten'}
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="p-3 text-sm text-gray-500 italic">
                                    Keine expliziten Zimmerzuweisungen (Legacy Datensatz)
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Actions Footer in Modal */}
                    <div className="flex justify-between items-center pt-4 border-t border-gray-100">
                        {/* LEFT SIDE: Delete */}
                        <button
                            onClick={() => {
                                console.log('Delete button clicked for booking:', booking.id);
                                if (onDelete) {
                                    onDelete(booking.id);
                                } else {
                                    console.error('onDelete prop is undefined!');
                                    alert('Fehler: Lösch-Funktion nicht verfügbar.');
                                }
                                onOpenChange(false);
                            }}
                            className="text-red-600 hover:text-red-900 text-sm font-medium flex items-center gap-2 hover:bg-red-50 px-3 py-2 rounded transition-colors"
                        >
                            <Trash2 className="w-4 h-4" />
                            Löschen
                        </button>

                        <div className="flex gap-3">
                            {/* New Invoice/Offer Button */}
                            <button
                                onClick={() => {
                                    onShowOffer && onShowOffer();
                                    onOpenChange(false);
                                }}
                                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded shadow-sm text-sm"
                            >
                                Rechnung / Angebot öffnen
                            </button>

                            {booking.status === 'reserved' && (
                                <button
                                    onClick={() => {
                                        if (window.confirm('Zahlungseingang bestätigen und Buchung auf "Bestätigt" setzen?')) {
                                            onStatusChange(booking.id, 'confirmed');
                                            onOpenChange(false);
                                        }
                                    }}
                                    className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded shadow-sm text-sm"
                                >
                                    Zahlungseingang bestätigen
                                </button>
                            )}

                            {booking.status !== 'cancelled' && (
                                <button
                                    onClick={() => {
                                        onCancel(booking.id);
                                        onOpenChange(false);
                                    }}
                                    className="text-orange-600 hover:text-orange-900 text-sm font-medium px-4 py-2 border border-orange-200 rounded hover:bg-orange-50"
                                >
                                    Stornieren
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};
