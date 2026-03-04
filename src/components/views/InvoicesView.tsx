import React, { useState, useMemo } from 'react';
import { Invoice, Booking } from '../../types';
import { Button } from '../ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Input } from '../ui/Input';
import * as db from '../../lib/database';
import {
    Search, FileText, CheckCircle, Clock, AlertTriangle, XCircle, ArrowLeft, Send, Trash2, Calendar, X, ArrowUpDown, ArrowUp, ArrowDown
} from 'lucide-react';
import { format, isBefore, isAfter, parseISO, startOfDay, endOfDay } from 'date-fns';

interface InvoicesViewProps {
    invoices: Invoice[];
    bookings?: Booking[];
    onUpdateInvoice: (invoice: Invoice) => void;
    onDeleteInvoice: (id: string) => void;
}

type StatusFilter = 'all' | 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
type SortField = 'invoiceNumber' | 'dueDate' | null;
type SortDirection = 'asc' | 'desc';

export const InvoicesView: React.FC<InvoicesViewProps> = ({
    invoices,
    bookings = [],
    onUpdateInvoice,
    onDeleteInvoice
}) => {
    // ... (state remains the same)
    const [viewMode, setViewMode] = useState<'list' | 'detail'>('list');
    const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const [dueDateFrom, setDueDateFrom] = useState<string>('');
    const [dueDateTo, setDueDateTo] = useState<string>('');
    const [sortField, setSortField] = useState<SortField>(null);
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

    // Auto-detect overdue invoices
    const processedInvoices = useMemo(() => {
        const today = new Date();
        return invoices.map(inv => {
            if (inv.status === 'sent' && isBefore(new Date(inv.dueDate), today)) {
                return { ...inv, status: 'overdue' as const };
            }
            return inv;
        });
    }, [invoices]);

    // Filter invoices
    const filteredInvoices = useMemo(() => {
        let result = processedInvoices.filter(inv => {
            const matchesSearch =
                inv.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                inv.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                inv.customerNumber.includes(searchTerm);
            const matchesStatus = statusFilter === 'all' || inv.status === statusFilter;

            // Date range filter for due date
            let matchesDueDate = true;
            const invDueDate = startOfDay(new Date(inv.dueDate));

            if (dueDateFrom) {
                const fromDate = startOfDay(parseISO(dueDateFrom));
                if (isBefore(invDueDate, fromDate)) {
                    matchesDueDate = false;
                }
            }
            if (dueDateTo) {
                const toDate = endOfDay(parseISO(dueDateTo));
                if (isAfter(invDueDate, toDate)) {
                    matchesDueDate = false;
                }
            }

            return matchesSearch && matchesStatus && matchesDueDate;
        });

        // Apply sorting
        if (sortField) {
            result = [...result].sort((a, b) => {
                let comparison = 0;
                if (sortField === 'invoiceNumber') {
                    comparison = a.invoiceNumber.localeCompare(b.invoiceNumber, 'de', { numeric: true });
                } else if (sortField === 'dueDate') {
                    comparison = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
                }
                return sortDirection === 'asc' ? comparison : -comparison;
            });
        }

        return result;
    }, [processedInvoices, searchTerm, statusFilter, dueDateFrom, dueDateTo, sortField, sortDirection]);

    // Statistics (Same as before)
    const stats = useMemo(() => {
        const total = processedInvoices.length;
        const paid = processedInvoices.filter(i => i.status === 'paid').length;
        const open = processedInvoices.filter(i => i.status === 'sent').length;
        const overdue = processedInvoices.filter(i => i.status === 'overdue').length;
        const openAmount = processedInvoices
            .filter(i => i.status === 'sent' || i.status === 'overdue')
            .reduce((sum, i) => sum + i.amount, 0);
        const paidAmount = processedInvoices
            .filter(i => i.status === 'paid')
            .reduce((sum, i) => sum + i.amount, 0);
        return { total, paid, open, overdue, openAmount, paidAmount };
    }, [processedInvoices]);

    // Helpers (getStatusIcon, getStatusLabel, getStatusColor, handlers...)
    const getStatusIcon = (status: Invoice['status']) => {
        switch (status) {
            case 'paid': return <CheckCircle className="w-4 h-4 text-green-500" />;
            case 'sent': return <Clock className="w-4 h-4 text-blue-500" />;
            case 'overdue': return <AlertTriangle className="w-4 h-4 text-red-500" />;
            case 'draft': return <FileText className="w-4 h-4 text-gray-400" />;
            case 'cancelled': return <XCircle className="w-4 h-4 text-gray-400" />;
        }
    };

    const getStatusLabel = (status: Invoice['status']) => {
        switch (status) {
            case 'paid': return 'Bezahlt';
            case 'sent': return 'Gesendet';
            case 'overdue': return 'Überfällig';
            case 'draft': return 'Entwurf';
            case 'cancelled': return 'Storniert';
        }
    };

    const getStatusColor = (status: Invoice['status']) => {
        switch (status) {
            case 'paid': return 'bg-green-100 text-green-800';
            case 'sent': return 'bg-blue-100 text-blue-800';
            case 'overdue': return 'bg-red-100 text-red-800';
            case 'draft': return 'bg-gray-100 text-gray-600';
            case 'cancelled': return 'bg-gray-100 text-gray-500';
        }
    };

    const handleMarkAsPaid = (invoice: Invoice) => {
        onUpdateInvoice({
            ...invoice,
            status: 'paid',
            paidDate: new Date()
        });
    };

    const handleSendInvoice = (invoice: Invoice) => {
        onUpdateInvoice({
            ...invoice,
            status: 'sent'
        });
    };

    const getLinkedBooking = (bookingId?: string) => {
        if (!bookingId) return null;
        return bookings.find(b => b.id === bookingId);
    };

    const formatCurrency = (amount: number) => {
        return amount.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
    };

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            // Toggle direction or clear if already desc
            if (sortDirection === 'asc') {
                setSortDirection('desc');
            } else {
                setSortField(null);
            }
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };

    const getSortIcon = (field: SortField) => {
        if (sortField !== field) {
            return <ArrowUpDown className="w-3 h-3 ml-1 opacity-40" />;
        }
        return sortDirection === 'asc'
            ? <ArrowUp className="w-3 h-3 ml-1 text-blue-600" />
            : <ArrowDown className="w-3 h-3 ml-1 text-blue-600" />;
    };

    const renderListView = () => (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Rechnungen</h2>
                    <p className="text-gray-500 text-sm mt-1">
                        {stats.total} Rechnungen • {formatCurrency(stats.openAmount)} offen • {formatCurrency(stats.paidAmount)} bezahlt
                    </p>
                </div>
            </div>

            {/* Stats Cards (Same as before) */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="p-4 cursor-pointer hover:ring-2 hover:ring-blue-500" onClick={() => setStatusFilter('all')}>
                    <div className="flex items-center gap-3">
                        <FileText className="w-8 h-8 text-gray-400" />
                        <div>
                            <p className="text-2xl font-bold">{stats.total}</p>
                            <p className="text-xs text-gray-500">Gesamt</p>
                        </div>
                    </div>
                </Card>
                <Card className="p-4 cursor-pointer hover:ring-2 hover:ring-blue-500" onClick={() => setStatusFilter('sent')}>
                    <div className="flex items-center gap-3">
                        <Clock className="w-8 h-8 text-blue-500" />
                        <div>
                            <p className="text-2xl font-bold text-blue-600">{stats.open}</p>
                            <p className="text-xs text-gray-500">Offen</p>
                        </div>
                    </div>
                </Card>
                <Card className="p-4 cursor-pointer hover:ring-2 hover:ring-red-500" onClick={() => setStatusFilter('overdue')}>
                    <div className="flex items-center gap-3">
                        <AlertTriangle className="w-8 h-8 text-red-500" />
                        <div>
                            <p className="text-2xl font-bold text-red-600">{stats.overdue}</p>
                            <p className="text-xs text-gray-500">Überfällig</p>
                        </div>
                    </div>
                </Card>
                <Card className="p-4 cursor-pointer hover:ring-2 hover:ring-green-500" onClick={() => setStatusFilter('paid')}>
                    <div className="flex items-center gap-3">
                        <CheckCircle className="w-8 h-8 text-green-500" />
                        <div>
                            <p className="text-2xl font-bold text-green-600">{stats.paid}</p>
                            <p className="text-xs text-gray-500">Bezahlt</p>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Search and Filter */}
            <div className="flex flex-wrap gap-4">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                        placeholder="Suche nach Rechnungsnummer, Kunde..."
                        className="pl-10"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                {/* Due Date Range Filter */}
                <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-gray-400" />
                    <span className="text-sm text-gray-500">Fällig:</span>
                    <input
                        type="date"
                        className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                        value={dueDateFrom}
                        onChange={(e) => setDueDateFrom(e.target.value)}
                        placeholder="Von"
                    />
                    <span className="text-gray-400">–</span>
                    <input
                        type="date"
                        className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                        value={dueDateTo}
                        onChange={(e) => setDueDateTo(e.target.value)}
                        placeholder="Bis"
                    />
                    {(dueDateFrom || dueDateTo) && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => { setDueDateFrom(''); setDueDateTo(''); }}
                            className="p-1 h-auto"
                            title="Datumsfilter zurücksetzen"
                        >
                            <X className="h-4 w-4 text-gray-400" />
                        </Button>
                    )}
                </div>

                <select
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                >
                    <option value="all">Alle Status</option>
                    <option value="draft">Entwurf</option>
                    <option value="sent">Gesendet</option>
                    <option value="overdue">Überfällig</option>
                    <option value="paid">Bezahlt</option>
                    <option value="cancelled">Storniert</option>
                </select>
            </div>

            {/* Invoice Table */}
            <Card>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th
                                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 select-none"
                                    onClick={() => handleSort('invoiceNumber')}
                                >
                                    <span className="flex items-center">
                                        Nr.
                                        {getSortIcon('invoiceNumber')}
                                    </span>
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kunde</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Datum</th>
                                <th
                                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 select-none"
                                    onClick={() => handleSort('dueDate')}
                                >
                                    <span className="flex items-center">
                                        Fällig
                                        {getSortIcon('dueDate')}
                                    </span>
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Betrag</th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Aktionen</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {filteredInvoices.map(invoice => (
                                <tr
                                    key={invoice.id}
                                    className="hover:bg-gray-50 cursor-pointer"
                                    onClick={() => { setSelectedInvoice(invoice); setViewMode('detail'); }}
                                >
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-blue-600">
                                        {invoice.invoiceNumber}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="font-medium text-gray-900">{invoice.customerName}</div>
                                        <div className="text-xs text-gray-500">#{invoice.customerNumber}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {format(new Date(invoice.date), 'dd.MM.yyyy')}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {format(new Date(invoice.dueDate), 'dd.MM.yyyy')}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-semibold">
                                        {formatCurrency(invoice.amount)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-center">
                                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(invoice.status)}`}>
                                            {getStatusIcon(invoice.status)}
                                            {getStatusLabel(invoice.status)}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right" onClick={e => e.stopPropagation()}>
                                        <div className="flex justify-end gap-2">
                                            {/* DELETE ACTION */}
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="hover:bg-red-50 text-red-600 hover:text-red-700 hover:border-red-200"
                                                onClick={() => {
                                                    console.log('Delete button clicked for invoice:', invoice.id);
                                                    onDeleteInvoice(invoice.id);
                                                }}
                                                title="Löschen"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>

                                            {/* Existing Actions */}
                                            {invoice.pdfPath && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        const url = db.getInvoicePdfUrl(invoice.pdfPath!);
                                                        window.open(url, '_blank');
                                                    }}
                                                    title="PDF anzeigen"
                                                >
                                                    <FileText className="w-4 h-4 text-blue-600" />
                                                </Button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {filteredInvoices.length === 0 && (
                        <div className="p-8 text-center text-gray-500">
                            Keine Rechnungen gefunden.
                        </div>
                    )}
                </div>
            </Card>
        </div>
    );

    const renderDetailView = () => {
        if (!selectedInvoice) return null;

        return (
            <div className="space-y-6">
                <Button variant="ghost" onClick={() => setViewMode('list')} className="pl-0">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Zurück zur Übersicht
                </Button>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Invoice Info (Same as before) */}
                    <Card className="md:col-span-2">
                        <CardHeader>
                            <div className="flex justify-between items-start">
                                <div>
                                    <CardTitle className="text-xl">{selectedInvoice.invoiceNumber}</CardTitle>
                                    <p className="text-gray-500 mt-1">{selectedInvoice.customerName}</p>
                                </div>
                                <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(selectedInvoice.status)}`}>
                                    {getStatusIcon(selectedInvoice.status)}
                                    {getStatusLabel(selectedInvoice.status)}
                                </span>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* Dates */}
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <span className="text-xs text-gray-500 block">Rechnungsdatum</span>
                                    <span className="font-medium">{format(new Date(selectedInvoice.date), 'dd.MM.yyyy')}</span>
                                </div>
                                <div>
                                    <span className="text-xs text-gray-500 block">Fälligkeitsdatum</span>
                                    <span className="font-medium">{format(new Date(selectedInvoice.dueDate), 'dd.MM.yyyy')}</span>
                                </div>
                                {selectedInvoice.paidDate && (
                                    <div>
                                        <span className="text-xs text-gray-500 block">Bezahlt am</span>
                                        <span className="font-medium text-green-600">{format(new Date(selectedInvoice.paidDate), 'dd.MM.yyyy')}</span>
                                    </div>
                                )}
                            </div>

                            {/* Service Period */}
                            <div>
                                <span className="text-xs text-gray-500 block">Leistungszeitraum</span>
                                <span className="font-medium">
                                    {format(new Date(selectedInvoice.servicePeriodStart), 'dd.MM.yyyy')} - {format(new Date(selectedInvoice.servicePeriodEnd), 'dd.MM.yyyy')}
                                </span>
                            </div>

                            {/* Items */}
                            <div>
                                <h4 className="font-semibold mb-3">Positionen</h4>
                                <table className="min-w-full text-sm">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-3 py-2 text-left">Beschreibung</th>
                                            <th className="px-3 py-2 text-right">Menge</th>
                                            <th className="px-3 py-2 text-right">Einzelpreis</th>
                                            <th className="px-3 py-2 text-right">Gesamt</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {selectedInvoice.items.map((item, idx) => (
                                            <tr key={idx}>
                                                <td className="px-3 py-2">{item.description}</td>
                                                <td className="px-3 py-2 text-right">{item.quantity}</td>
                                                <td className="px-3 py-2 text-right">{formatCurrency(item.unitPrice)}</td>
                                                <td className="px-3 py-2 text-right font-medium">{formatCurrency(item.total)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot className="border-t-2">
                                        <tr>
                                            <td colSpan={3} className="px-3 py-2 text-right">Netto</td>
                                            <td className="px-3 py-2 text-right">{formatCurrency(selectedInvoice.netAmount)}</td>
                                        </tr>
                                        <tr>
                                            <td colSpan={3} className="px-3 py-2 text-right">MwSt. (19%)</td>
                                            <td className="px-3 py-2 text-right">{formatCurrency(selectedInvoice.vatAmount)}</td>
                                        </tr>
                                        <tr className="font-bold text-lg">
                                            <td colSpan={3} className="px-3 py-2 text-right">Gesamtbetrag</td>
                                            <td className="px-3 py-2 text-right">{formatCurrency(selectedInvoice.amount)}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Actions & Customer */}
                    <div className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">Aktionen</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                {selectedInvoice.status === 'draft' && (
                                    <Button className="w-full" onClick={() => handleSendInvoice(selectedInvoice)}>
                                        <Send className="w-4 h-4 mr-2" />
                                        Rechnung senden
                                    </Button>
                                )}
                                {(selectedInvoice.status === 'sent' || selectedInvoice.status === 'overdue') && (
                                    <Button className="w-full" onClick={() => handleMarkAsPaid(selectedInvoice)}>
                                        <CheckCircle className="w-4 h-4 mr-2" />
                                        Als bezahlt markieren
                                    </Button>
                                )}
                                {selectedInvoice.pdfPath && (
                                    <Button variant="outline" className="w-full" onClick={() => {
                                        const url = db.getInvoicePdfUrl(selectedInvoice.pdfPath!);
                                        window.open(url, '_blank');
                                    }}>
                                        <FileText className="w-4 h-4 mr-2" />
                                        PDF anzeigen
                                    </Button>
                                )}

                                <div className="border-t border-gray-100 my-2 pt-2"></div>

                                <Button
                                    className="w-full bg-red-100 text-red-700 hover:bg-red-200"
                                    onClick={() => {
                                        if (window.confirm('Rechnung wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.')) {
                                            onDeleteInvoice(selectedInvoice.id);
                                            setViewMode('list');
                                            setSelectedInvoice(null);
                                        }
                                    }}
                                >
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Rechnung löschen
                                </Button>
                            </CardContent>
                        </Card>

                        {/* Linked Booking (Same as before) */}
                        {selectedInvoice.bookingId && (
                            <Card className="border-blue-200 bg-blue-50/50">
                                <CardHeader>
                                    <CardTitle className="text-base text-blue-800">Verknüpfte Buchung</CardTitle>
                                </CardHeader>
                                <CardContent className="text-sm">
                                    {(() => {
                                        const booking = getLinkedBooking(selectedInvoice.bookingId);
                                        if (!booking) return <span className="text-gray-500">Buchung nicht gefunden</span>;
                                        return (
                                            <div className="space-y-1">
                                                <div><strong>{booking.projectName}</strong></div>
                                                <div>{new Date(booking.startDate).toLocaleDateString()} – {new Date(booking.endDate).toLocaleDateString()}</div>
                                                <div>{booking.bedCount} Betten</div>
                                                <div className={`inline-block px-2 py-0.5 rounded text-xs ${booking.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                                                    booking.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                                                        'bg-purple-100 text-purple-700'
                                                    }`}>
                                                    {booking.status === 'confirmed' ? 'Bestätigt' :
                                                        booking.status === 'cancelled' ? 'Storniert' : 'Reserviert'}
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </CardContent>
                            </Card>
                        )}

                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">Rechnungsadresse</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm whitespace-pre-line">{selectedInvoice.billingAddress}</p>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6">
            {viewMode === 'list' && renderListView()}
            {viewMode === 'detail' && renderDetailView()}
        </div>
    );
};
