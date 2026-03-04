
import React, { useState } from 'react';
import { Location, Booking, Customer, CompanySettings } from '../../types';
import { RequestWorkflowSimulator } from '../RequestWorkflowSimulator';
import { ManualBookingForm } from '../ManualBookingForm';
import { AvailabilityCheck } from '../AvailabilityCheck';
import { BookingDetailDialog } from '../BookingDetailDialog';
import { OfferPreview } from '../OfferPreview';
import { checkAvailability } from '../../utils/occupancy';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '../ui/Dialog';

interface BookingsViewProps {
    locations: Location[];
    bookings: Booking[];
    customers: Customer[];
    companySettings: CompanySettings;
    onBookingCreated: (booking: Booking) => void;
    onBookingStatusChange: (bookingId: string, status: 'reserved' | 'confirmed') => void;
    onCancelBooking: (bookingId: string) => void;
    onDeleteBooking: (bookingId: string) => void;
    onSaveCustomer?: (customer: Customer) => void;
}

export const BookingsView: React.FC<BookingsViewProps> = ({
    locations,
    bookings,
    customers,
    companySettings,
    onBookingCreated,
    onBookingStatusChange,
    onCancelBooking,
    onDeleteBooking,
    onSaveCustomer
}) => {
    // ... (state remains the same)

    // ... (rest of the component)


    const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
    const [offerBooking, setOfferBooking] = useState<Booking | null>(null);
    const [availabilityResult, setAvailabilityResult] = useState<ReturnType<typeof checkAvailability> | null>(null);
    const [availabilityDialogOpen, setAvailabilityDialogOpen] = useState(false);

    const handleAvailabilityCheck = (result: ReturnType<typeof checkAvailability>) => {
        setAvailabilityResult(result);
        setAvailabilityDialogOpen(true);
    };

    const sortedBookings = [...bookings].sort((a, b) => {
        if (a.status === 'cancelled' && b.status !== 'cancelled') return 1;
        if (a.status !== 'cancelled' && b.status === 'cancelled') return -1;
        return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
    });

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-900">Buchungsmanagement</h2>
            </div>

            <div className="flex flex-col gap-4">
                {/* Smart Booking Wizard */}
                <section>
                    <RequestWorkflowSimulator
                        locations={locations}
                        bookings={bookings}
                        customers={customers}
                        companySettings={companySettings}
                        onBookingCreated={onBookingCreated}
                        onBookingStatusChange={onBookingStatusChange}
                    />

                    {/* Manual Booking Form */}
                    <ManualBookingForm
                        locations={locations}
                        bookings={bookings}
                        customers={customers}
                        companySettings={companySettings}
                        onBookingCreated={onBookingCreated}
                        onBookingStatusChange={onBookingStatusChange}
                        onSaveCustomer={onSaveCustomer}
                    />
                </section>

                {/* Manual Tools */}
                <section>
                    <h3 className="text-lg font-semibold mb-4 text-gray-700">Verfügbarkeitsprüfung</h3>
                    <AvailabilityCheck
                        locations={locations}
                        bookings={bookings}
                        onCheck={handleAvailabilityCheck}
                    />
                </section>
            </div>

            {/* Booking List */}
            <section className="pt-8 border-t border-gray-200">
                <h3 className="text-lg font-semibold mb-4 text-gray-700">Aktuelle Buchungen</h3>
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kunde</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Zeitraum</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Betten</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Aktionen</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {sortedBookings.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                                        Keine Buchungen vorhanden.
                                    </td>
                                </tr>
                            ) : (
                                sortedBookings.map((booking) => (
                                    <tr
                                        key={booking.id}
                                        onClick={(e) => {
                                            // Don't trigger if clicking explicit action buttons
                                            if ((e.target as HTMLElement).closest('button')) return;
                                            setSelectedBooking(booking);
                                        }}
                                        className={`cursor-pointer hover:bg-gray-50 transition-colors ${booking.status === 'cancelled' ? 'bg-gray-50 opacity-60' : ''}`}
                                    >
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="font-medium text-gray-900">{booking.customerName}</div>
                                            <div className="text-sm text-gray-500">{booking.projectName}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {booking.startDate.toLocaleDateString()} - {booking.endDate.toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {booking.bedCount}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                                                ${booking.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                                                    booking.status === 'cancelled' ? 'bg-red-100 text-red-800' : 'bg-purple-100 text-purple-800'}`}>
                                                {booking.status === 'confirmed' ? 'Bestätigt' :
                                                    booking.status === 'cancelled' ? 'Storniert' : 'Reserviert'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            {booking.status !== 'cancelled' && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onCancelBooking(booking.id);
                                                    }}
                                                    className="text-red-600 hover:text-red-900 font-semibold"
                                                >
                                                    Stornieren
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </section>


            {/* Availability Dialog (Reused) */}
            <Dialog open={availabilityDialogOpen} onOpenChange={setAvailabilityDialogOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Verfügbarkeitsprüfung Ergebnis</DialogTitle>
                        <DialogClose onClose={() => setAvailabilityDialogOpen(false)} />
                    </DialogHeader>
                    {availabilityResult && (
                        <div className="space-y-4">
                            <div
                                className={`rounded-lg p-4 ${availabilityResult.available
                                    ? 'bg-green-50 text-green-800'
                                    : 'bg-red-50 text-red-800'
                                    }`}
                            >
                                <p className="font-semibold">
                                    {availabilityResult.available
                                        ? '✓ Verfügbar'
                                        : '✗ Nicht vollständig verfügbar'}
                                </p>
                                <p className="text-sm mt-1">
                                    Angefragt: {availabilityResult.bedCount} Betten
                                </p>
                            </div>

                            {availabilityResult.suggestions.length > 0 && (
                                <div>
                                    <h3 className="font-semibold mb-2">Vorgeschlagene Zuweisung:</h3>
                                    <div className="space-y-2">
                                        {availabilityResult.suggestions.map((suggestion, index) => {
                                            const location = locations.find(l =>
                                                l.properties.some(p =>
                                                    p.rooms.some(r => r.id === suggestion.roomId)
                                                )
                                            );
                                            const property = location?.properties.find(p =>
                                                p.rooms.some(r => r.id === suggestion.roomId)
                                            );
                                            const room = property?.rooms.find(r => r.id === suggestion.roomId);

                                            return (
                                                <div
                                                    key={index}
                                                    className="rounded border border-gray-200 bg-white p-3"
                                                >
                                                    <div className="font-medium">
                                                        {property?.name} - {room?.name}
                                                    </div>
                                                    <div className="text-sm text-gray-600">
                                                        {suggestion.availableBeds} Betten zur Belegung
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Booking Detail Dialog */}
            <BookingDetailDialog
                booking={selectedBooking}
                open={!!selectedBooking}
                onOpenChange={(open) => !open && setSelectedBooking(null)}
                locations={locations}
                onStatusChange={onBookingStatusChange}
                onCancel={onCancelBooking}
                onDelete={onDeleteBooking}
                onShowOffer={() => setOfferBooking(selectedBooking)}
            />

            {offerBooking && (
                <OfferPreview
                    booking={offerBooking}
                    locations={locations}
                    open={!!offerBooking}
                    onOpenChange={(open) => !open && setOfferBooking(null)}
                    onSendOffer={() => {
                        alert('Funktion "Senden" ist noch nicht implementiert (Mock)');
                    }}
                />
            )}
        </div>
    );
};
