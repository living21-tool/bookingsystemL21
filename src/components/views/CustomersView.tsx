import React, { useState } from 'react';
import { Customer, Booking, Location } from '../../types';
import { Button } from '../ui/Button';
import { Plus, Search, User, FileText, ArrowLeft, Building2, MapPin, Mail, Phone, Trash2 } from 'lucide-react';
import { CustomerForm } from '../CustomerForm';
import { BookingDetailDialog } from '../BookingDetailDialog';
import { OfferPreview } from '../OfferPreview';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '../ui/Dialog';
import { format } from 'date-fns';

// Props to receive global state
interface CustomersViewProps {
    bookings?: Booking[];
    customers: Customer[];
    locations: Location[];
    onSaveCustomer: (customer: Customer) => void;
    onDeleteCustomer: (id: string) => void;
    onBookingStatusChange: (bookingId: string, status: 'reserved' | 'confirmed') => void;
    onCancelBooking: (bookingId: string) => void;
    onDeleteBooking: (bookingId: string) => void;
}

export const CustomersView: React.FC<CustomersViewProps> = ({
    bookings = [],
    customers,
    locations,
    onSaveCustomer,
    onDeleteCustomer,
    onBookingStatusChange,
    onCancelBooking,
    onDeleteBooking
}) => {
    // ... rest of component

    console.log('CustomersView rendered. onDeleteCustomer defined:', !!onDeleteCustomer);
    const [viewMode, setViewMode] = useState<'list' | 'detail' | 'form'>('list');
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
    const [offerBooking, setOfferBooking] = useState<Booking | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const handleSaveCustomer = (customer: Customer) => {
        onSaveCustomer(customer);
        setViewMode('list');
        setSelectedCustomer(null);
    };



    const filteredCustomers = customers.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.company && c.company.toLowerCase().includes(searchTerm.toLowerCase())) ||
        c.customerNumber.includes(searchTerm)
    );

    // Filter bookings for the selected customer
    const customerBookings = selectedCustomer
        ? bookings.filter(b => b.customerNumber === selectedCustomer.customerNumber || b.customerName === selectedCustomer.name) // Fallback to name match for mocks
        : [];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-900">Kundenmanagement</h2>
                {viewMode === 'list' && (
                    <Button onClick={() => { setSelectedCustomer(null); setViewMode('form'); }}>
                        <Plus className="w-4 h-4 mr-2" />
                        Neuer Kunde
                    </Button>
                )}
            </div>

            {/* View Switching */}
            {viewMode === 'list' && (
                <div className="space-y-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Suche nach Name, Firma, Kundennummer..."
                            className="pl-10 w-full rounded-md border border-gray-300 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nr.</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name / Firma</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kontakt</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ort</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {filteredCustomers.map((customer) => (
                                    <tr
                                        key={customer.id}
                                        className="hover:bg-gray-50 cursor-pointer"
                                        onClick={() => { setSelectedCustomer(customer); setViewMode('detail'); }}
                                    >
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                                            {customer.customerNumber}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="font-medium text-gray-900">{customer.company || customer.name}</div>
                                            {customer.company && <div className="text-sm text-gray-500">{customer.name}</div>}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            <div className="flex flex-col">
                                                <span>{customer.email}</span>
                                                <span className="text-xs">{customer.phone}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {customer.zip} {customer.city}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {filteredCustomers.length === 0 && (
                            <div className="p-8 text-center text-gray-500">
                                Keine Kunden gefunden.
                            </div>
                        )}
                    </div>
                </div>
            )}

            {viewMode === 'detail' && selectedCustomer && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <Button variant="ghost" onClick={() => setViewMode('list')} className="mb-2 pl-0 hover:bg-transparent hover:text-blue-600">
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Zurück zur Übersicht
                    </Button>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Profile Card */}
                        <div className="md:col-span-1 space-y-4">
                            <div className="bg-white rounded-lg border shadow-sm p-6">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-xl">
                                        {selectedCustomer.company ? selectedCustomer.company.charAt(0) : selectedCustomer.name.charAt(0)}
                                    </div>
                                    <div className="flex gap-2">
                                        <Button variant="outline" size="sm" onClick={() => setShowDeleteConfirm(true)}>
                                            <Trash2 className="w-4 h-4 text-red-500" />
                                        </Button>
                                        <Button variant="outline" size="sm" onClick={() => setViewMode('form')}>Bearbeiten</Button>
                                    </div>
                                </div>

                                {/* Delete Confirmation Dialog */}
                                <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
                                    <DialogContent>
                                        <DialogHeader>
                                            <DialogTitle>Kunde löschen</DialogTitle>
                                            <DialogClose onClose={() => setShowDeleteConfirm(false)} />
                                        </DialogHeader>
                                        <div className="space-y-4">
                                            <p className="text-gray-600">
                                                Möchten Sie den Kunden <strong>{selectedCustomer.company || selectedCustomer.name}</strong> wirklich löschen?
                                                <br />
                                                Diese Aktion kann nicht rückgängig gemacht werden.
                                            </p>
                                            <div className="flex justify-end gap-3">
                                                <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>Abbrechen</Button>
                                                <Button
                                                    onClick={() => {
                                                        onDeleteCustomer(selectedCustomer.id);
                                                        setShowDeleteConfirm(false);
                                                        setSelectedCustomer(null);
                                                        setViewMode('list');
                                                    }}
                                                    className="bg-red-600 hover:bg-red-700 text-white"
                                                >
                                                    Löschen
                                                </Button>
                                            </div>
                                        </div>
                                    </DialogContent>
                                </Dialog>

                                <h3 className="text-xl font-bold text-gray-900 mb-1">{selectedCustomer.company || selectedCustomer.name}</h3>
                                {selectedCustomer.company && <p className="text-gray-500 mb-4">{selectedCustomer.name}</p>}

                                <div className="space-y-3 text-sm border-t pt-4 mt-2">
                                    <div className="flex items-start gap-3">
                                        <User className="w-4 h-4 text-gray-400 mt-0.5" />
                                        <div>
                                            <span className="block text-gray-500 text-xs">Kundennummer</span>
                                            <span className="font-mono">{selectedCustomer.customerNumber}</span>
                                        </div>
                                    </div>
                                    {selectedCustomer.management && (
                                        <div className="flex items-start gap-3">
                                            <Building2 className="w-4 h-4 text-gray-400 mt-0.5" />
                                            <div>
                                                <span className="block text-gray-500 text-xs">Geschäftsführung</span>
                                                <span>{selectedCustomer.management}</span>
                                            </div>
                                        </div>
                                    )}
                                    {selectedCustomer.contactPerson && (
                                        <div className="flex items-start gap-3">
                                            <User className="w-4 h-4 text-gray-400 mt-0.5" />
                                            <div>
                                                <span className="block text-gray-500 text-xs">Ansprechpartner</span>
                                                <span>{selectedCustomer.contactPerson}</span>
                                            </div>
                                        </div>
                                    )}
                                    {selectedCustomer.accountingContact && (
                                        <div className="flex items-start gap-3">
                                            <FileText className="w-4 h-4 text-gray-400 mt-0.5" />
                                            <div>
                                                <span className="block text-gray-500 text-xs">Buchhaltung</span>
                                                <span>{selectedCustomer.accountingContact}</span>
                                            </div>
                                        </div>
                                    )}
                                    <div className="flex items-start gap-3">
                                        <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                                        <div>
                                            <span className="block text-gray-500 text-xs">Anschrift</span>
                                            {selectedCustomer.street} <br />
                                            {selectedCustomer.zip} {selectedCustomer.city}
                                            {selectedCustomer.country && selectedCustomer.country !== 'Deutschland' && (
                                                <><br />{selectedCustomer.country}</>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <Mail className="w-4 h-4 text-gray-400" />
                                        <a href={`mailto:${selectedCustomer.email}`} className="text-blue-600 hover:underline">{selectedCustomer.email}</a>
                                    </div>
                                    {selectedCustomer.phone && (
                                        <div className="flex items-center gap-3">
                                            <Phone className="w-4 h-4 text-gray-400" />
                                            <span>{selectedCustomer.phone}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Booking History & Stats */}
                        <div className="md:col-span-2 space-y-4">
                            <div className="bg-white rounded-lg border shadow-sm p-6">
                                <h4 className="font-semibold text-lg mb-4 flex items-center gap-2">
                                    <FileText className="w-5 h-5 text-gray-500" />
                                    Buchungshistorie
                                </h4>

                                {customerBookings.length > 0 ? (
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full text-sm">
                                            <thead className="bg-gray-50">
                                                <tr>
                                                    <th className="px-4 py-2 text-left font-medium text-gray-500">ID</th>
                                                    <th className="px-4 py-2 text-left font-medium text-gray-500">Zeitraum</th>
                                                    <th className="px-4 py-2 text-left font-medium text-gray-500">Betten</th>
                                                    <th className="px-4 py-2 text-left font-medium text-gray-500">Status</th>
                                                    <th className="px-4 py-2 text-right font-medium text-gray-500">Rechnung</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y">
                                                {customerBookings.map(b => (
                                                    <tr
                                                        key={b.id}
                                                        className="hover:bg-gray-50 cursor-pointer"
                                                        onClick={() => setSelectedBooking(b)}
                                                    >
                                                        <td className="px-4 py-3 font-mono text-xs">{b.id}</td>
                                                        <td className="px-4 py-3">
                                                            {format(b.startDate, 'dd.MM')} - {format(b.endDate, 'dd.MM.yyyy')}
                                                        </td>
                                                        <td className="px-4 py-3">{b.bedCount}</td>
                                                        <td className="px-4 py-3">
                                                            <span className={`px-2 py-0.5 rounded text-xs ${b.status === 'confirmed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                                                {b.status}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 text-right">
                                                            {b.invoiceNumber ? (
                                                                <span className="font-mono text-xs text-blue-600">{b.invoiceNumber}</span>
                                                            ) : (
                                                                <span className="text-gray-400">-</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <p className="text-gray-500 italic py-4">Keine Buchungen für diesen Kunden gefunden.</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )
            }

            {
                viewMode === 'form' && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                        <Button variant="ghost" onClick={() => setViewMode('list')} className="mb-2 pl-0">
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Abbrechen
                        </Button>
                        <CustomerForm
                            existingCustomer={selectedCustomer}
                            onSave={handleSaveCustomer}
                            onCancel={() => setViewMode('list')}
                        />
                    </div>
                )
            }
            {/* Detail Dialog */}
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
        </div >
    );
};

