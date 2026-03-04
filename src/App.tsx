import { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { DashboardView } from './components/views/DashboardView';
import { BookingsView } from './components/views/BookingsView';
import { CalendarView } from './components/views/CalendarView';
import { CustomersView } from './components/views/CustomersView';
import { InvoicesView } from './components/views/InvoicesView';
import { InvoiceImportView } from './components/views/InvoiceImportView';
import { PortfolioView } from './components/views/PortfolioView';
import { AdminSettingsView } from './components/views/AdminSettingsView';
import { Location, Booking, CompanySettings, Invoice, Customer } from './types';
import { mockLocations, mockCustomers } from './data/mockData';
import { createInvoiceFromBooking } from './utils/invoiceUtils';
import * as db from './lib/database';
import { ConfirmationDialog } from './components/ConfirmationDialog';

function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'bookings' | 'calendar' | 'customers' | 'invoices' | 'import' | 'portfolio' | 'admin'>('dashboard');
  const [locations, setLocations] = useState<Location[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Default Company Settings
  const [companySettings, setCompanySettings] = useState<CompanySettings>({
    name: 'Living 21 GmbH',
    address: 'Rotberger Str. 3b',
    zipCity: '12529 Schönefeld',
    phone: '+49 33793 418021',
    email: 'buchung@living-21.com',
    website: 'living-21.com',
    ceo: 'Max Mustermann',
    hrb: 'HRB 12345',
    court: 'Amtsgericht Berlin',
    vatId: 'DE123456789',
    taxId: '12/345/67890',
    bankName: 'Berliner Volksbank',
    iban: 'DE00 1234 5678 9000 0000 00',
    bic: 'GENODEF1BVB'
  });

  // Confirmation Dialog State
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
  }>({
    open: false,
    title: '',
    description: '',
    onConfirm: () => { },
  });

  // ============================================
  // LOAD DATA FROM SUPABASE
  // ============================================

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Seed initial data if database is empty
      await db.seedInitialData(mockLocations, mockCustomers);

      // Load all data in parallel
      const [locs, custs, books, invs, settings] = await Promise.all([
        db.fetchLocations(),
        db.fetchCustomers(),
        db.fetchBookings(),
        db.fetchInvoices(),
        db.fetchCompanySettings(),
      ]);

      setLocations(locs);
      setCustomers(custs);
      // Enrich bookings with location info derived from assigned rooms
      const enrichedBookings = books.map(booking => {
        // If locationId is already present, keep it
        if (booking.locationId) return booking;

        // Try to find location from assigned rooms
        if (booking.assignedRooms && booking.assignedRooms.length > 0) {
          const roomId = booking.assignedRooms[0];
          for (const loc of locs) {
            for (const prop of loc.properties) {
              const room = prop.rooms.find(r => r.id === roomId);
              if (room) {
                return {
                  ...booking,
                  locationId: loc.id,
                  propertyId: prop.id,
                  roomId: room.id,
                  // Also ensure projectName includes location if needed, but keeping it simple for now
                };
              }
            }
          }
        }
        return booking;
      });

      setLocations(locs);
      setCustomers(custs);
      setBookings(enrichedBookings);
      setInvoices(invs);

      if (settings) {
        setCompanySettings(settings);
      }
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Fehler beim Laden der Daten. Bitte Seite neu laden.');
    } finally {
      setIsLoading(false);
    }
  };

  // ============================================
  // CONFIRMATION HELPER
  // ============================================
  const requestConfirmation = (title: string, description: string, onConfirm: () => void) => {
    setConfirmDialog({
      open: true,
      title,
      description,
      onConfirm
    });
  };

  // ============================================
  // INTELLIGENT DATA LINKING HANDLERS
  // ============================================

  /**
   * Creates a booking AND automatically generates a draft invoice
   */
  const handleBookingCreated = async (booking: Booking) => {
    try {
      // Find the customer
      const customer = customers.find(c =>
        c.id === booking.customerId ||
        c.customerNumber === booking.customerNumber ||
        c.company === booking.customerName ||
        c.name === booking.customerName
      );

      // Create invoice from booking
      const invoice = createInvoiceFromBooking(booking, customer, locations, 'draft');

      // Link booking to invoice
      const linkedBooking: Booking = {
        ...booking,
        invoiceId: invoice.id,
        customerId: customer?.id
      };

      // Save to database
      await db.saveBooking(linkedBooking, customer);
      await db.saveInvoice(invoice);

      // Update local state
      setBookings(prev => [...prev, linkedBooking]);
      setInvoices(prev => [...prev, invoice]);
    } catch (err) {
      console.error('Error creating booking:', err);
      setError('Fehler beim Erstellen der Buchung.');
    }
  };

  /**
   * Updates booking status and syncs with invoice
   */
  const handleBookingStatusChange = async (bookingId: string, status: 'reserved' | 'confirmed' | 'cancelled') => {
    try {
      // Update in database
      await db.updateBookingStatus(bookingId, status);

      // Update local state
      setBookings(prev => prev.map(b => {
        if (b.id === bookingId) {
          return { ...b, status };
        }
        return b;
      }));

      // Sync invoice status
      const booking = bookings.find(b => b.id === bookingId);
      if (booking?.invoiceId) {
        const invoice = invoices.find(inv => inv.id === booking.invoiceId);
        if (invoice) {
          let newStatus = invoice.status;

          if (status === 'cancelled') {
            newStatus = 'cancelled';
          } else if (status === 'confirmed' && invoice.status === 'draft') {
            newStatus = 'sent';
          }

          if (newStatus !== invoice.status) {
            const updatedInvoice = { ...invoice, status: newStatus };
            await db.saveInvoice(updatedInvoice);

            setInvoices(prev => prev.map(inv =>
              inv.id === booking.invoiceId ? updatedInvoice : inv
            ));
          }
        }
      }
    } catch (err) {
      console.error('Error updating booking status:', err);
      setError('Fehler beim Aktualisieren des Buchungsstatus.');
    }
  };

  /**
   * Cancels a booking and its linked invoice
   */
  const handleCancelBooking = (bookingId: string) => {
    requestConfirmation(
      'Buchung stornieren',
      'Möchten Sie diese Buchung wirklich stornieren? Die zugehörige Rechnung wird ebenfalls storniert.',
      () => handleBookingStatusChange(bookingId, 'cancelled')
    );
  };

  /**
   * Deletes a booking completely
   */
  const handleDeleteBooking = (bookingId: string) => {
    requestConfirmation(
      'Buchung löschen',
      'Möchten Sie diese Buchung wirklich LÖSCHEN? Dies kann nicht rückgängig gemacht werden.',
      async () => {
        console.log('Delete booking confirmed:', bookingId);
        try {
          const booking = bookings.find(b => b.id === bookingId);
          if (!booking) return;

          // Delete linked invoice first
          if (booking?.invoiceId) {
            await db.deleteInvoice(booking.invoiceId);
            setInvoices(prev => prev.filter(inv => inv.id !== booking.invoiceId));
          }

          // Delete booking
          await db.deleteBooking(bookingId);
          setBookings(prev => prev.filter(b => b.id !== bookingId));
        } catch (err) {
          console.error('Error deleting booking:', err);
          const msg = err instanceof Error ? err.message : String(err);
          window.alert('Fehler beim Löschen der Buchung: ' + msg);
          setError('Fehler beim Löschen der Buchung: ' + msg);
        }
      }
    );
  };

  /**
   * Updates an invoice (e.g., mark as paid)
   */
  const handleUpdateInvoice = async (updatedInvoice: Invoice) => {
    try {
      await db.saveInvoice(updatedInvoice);

      setInvoices(prev => prev.map(inv =>
        inv.id === updatedInvoice.id ? updatedInvoice : inv
      ));

      // If invoice marked as paid, update linked booking
      if (updatedInvoice.status === 'paid' && updatedInvoice.bookingId) {
        const booking = bookings.find(b => b.id === updatedInvoice.bookingId);
        if (booking && booking.status === 'reserved') {
          await db.updateBookingStatus(booking.id, 'confirmed');
          setBookings(prev => prev.map(b =>
            b.id === updatedInvoice.bookingId ? { ...b, status: 'confirmed' as const } : b
          ));
        }
      }
    } catch (err) {
      console.error('Error updating invoice:', err);
      setError('Fehler beim Aktualisieren der Rechnung.');
    }
  };

  /**
   * Deletes an invoice
   */
  const handleDeleteInvoice = (invoiceId: string) => {
    requestConfirmation(
      'Rechnung löschen',
      'Möchten Sie diese Rechnung wirklich LÖSCHEN?',
      async () => {
        console.log('Delete invoice confirmed:', invoiceId);
        try {
          await db.deleteInvoice(invoiceId);
          setInvoices(prev => prev.filter(inv => inv.id !== invoiceId));
        } catch (err) {
          console.error('Error deleting invoice:', err);
          const msg = err instanceof Error ? err.message : String(err);
          window.alert('Fehler beim Löschen der Rechnung: ' + msg);
          setError('Fehler beim Löschen der Rechnung: ' + msg);
        }
      }
    );
  };

  /**
   * Saves or updates a customer
   */
  const handleSaveCustomer = async (updatedCustomer: Customer) => {
    try {
      await db.saveCustomer(updatedCustomer);

      setCustomers(prev => {
        const exists = prev.find(c => c.id === updatedCustomer.id);
        if (exists) {
          return prev.map(c => c.id === updatedCustomer.id ? updatedCustomer : c);
        }
        return [...prev, updatedCustomer];
      });
    } catch (err) {
      console.error('Error saving customer:', err);
      setError('Fehler beim Speichern des Kunden.');
    }
  };

  /**
   * Deletes a customer
   */
  const handleDeleteCustomer = async (id: string) => {
    // Confirmation moved to UI component
    // if (!window.confirm('Möchten Sie diesen Kunden wirklich LÖSCHEN?')) { return; }

    try {
      await db.deleteCustomer(id);
      setCustomers(prev => prev.filter(c => c.id !== id));
    } catch (err) {
      console.error('Error deleting customer:', err);
      setError('Fehler beim Löschen des Kunden. Möglicherweise hat dieser Kunde noch Buchungen.');
    }
  };

  /**
   * Updates locations (for portfolio management)
   */
  const handleUpdateLocations = (updatedLocations: Location[]) => {
    // For now, just update local state
    // Full CRUD for locations is handled in PortfolioView
    setLocations(updatedLocations);
  };

  /**
   * Saves company settings
   */
  const handleSaveCompanySettings = async (settings: CompanySettings) => {
    try {
      await db.saveCompanySettings(settings);
      setCompanySettings(settings);
    } catch (err) {
      console.error('Error saving company settings:', err);
      setError('Fehler beim Speichern der Firmeneinstellungen.');
    }
  };

  // ============================================
  // RENDER
  // ============================================

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Lade Daten...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center bg-gray-800 p-8 rounded-lg max-w-md">
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={loadAllData}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Erneut versuchen
          </button>
        </div>
      </div>
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <DashboardView
            locations={locations}
            bookings={bookings.filter(b => b.status !== 'cancelled')}
            invoices={invoices}
          />
        );
      case 'bookings':
        return (
          <BookingsView
            locations={locations}
            bookings={bookings}
            customers={customers}
            companySettings={companySettings}
            onBookingCreated={handleBookingCreated}
            onBookingStatusChange={handleBookingStatusChange}
            onCancelBooking={handleCancelBooking}
            onDeleteBooking={handleDeleteBooking}
            onSaveCustomer={handleSaveCustomer}
          />
        );
      case 'calendar':
        return (
          <CalendarView
            locations={locations}
            bookings={bookings}
            customers={customers}
            onBookingCreated={handleBookingCreated}
          />
        );
      case 'customers':
        return (
          <CustomersView
            bookings={bookings}
            customers={customers}
            locations={locations}
            onSaveCustomer={handleSaveCustomer}
            onDeleteCustomer={handleDeleteCustomer}
            onBookingStatusChange={handleBookingStatusChange}
            onCancelBooking={handleCancelBooking}
            onDeleteBooking={handleDeleteBooking}
          />
        );
      case 'invoices':
        return (
          <InvoicesView
            invoices={invoices}
            bookings={bookings}
            onUpdateInvoice={handleUpdateInvoice}
            onDeleteInvoice={handleDeleteInvoice}
          />
        );
      case 'import':
        return (
          <InvoiceImportView
            locations={locations}
            customers={customers}
            bookings={bookings}
            onImportComplete={() => {
              loadAllData();
              setActiveTab('invoices');
            }}
          />
        );
      case 'portfolio':
        return (
          <PortfolioView
            locations={locations}
            bookings={bookings}
            onUpdateLocations={handleUpdateLocations}
          />
        );
      case 'admin':
        return <AdminSettingsView settings={companySettings} onSave={handleSaveCompanySettings} />;
      default:
        return null;
    }
  };

  return (
    <Layout activeTab={activeTab} onTabChange={setActiveTab}>
      {renderContent()}

      <ConfirmationDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog(prev => ({ ...prev, open }))}
        title={confirmDialog.title}
        description={confirmDialog.description}
        onConfirm={confirmDialog.onConfirm}
        confirmLabel="Löschen"
      />
    </Layout>
  );
}

export default App;
