import { Booking, Invoice, InvoiceItem, Customer, Location } from '../types';
import { addDays, differenceInDays } from 'date-fns';

/**
 * Creates an Invoice from a Booking
 */
export function createInvoiceFromBooking(
    booking: Booking,
    customer: Customer | undefined,
    locations: Location[],
    status: 'draft' | 'sent' = 'draft'
): Invoice {
    const nights = differenceInDays(new Date(booking.endDate), new Date(booking.startDate));
    const pricePerNight = booking.pricePerBedPerNight || 25;

    // Find location and property names for description
    const location = locations.find(l => l.id === booking.locationId);
    const locationName = location?.name || 'Unterkunft';

    // Create invoice items from room assignments
    const items: InvoiceItem[] = [];
    let netTotal = 0;

    if (booking.roomAssignments && booking.roomAssignments.length > 0) {
        booking.roomAssignments.forEach((assignment, idx) => {
            // Find room name
            let roomName = assignment.roomId;
            if (location) {
                for (const prop of location.properties) {
                    const room = prop.rooms.find(r => r.id === assignment.roomId);
                    if (room) {
                        roomName = `${prop.name} - ${room.name}`;
                        break;
                    }
                }
            }

            const itemTotal = assignment.beds * pricePerNight * nights;
            netTotal += itemTotal;

            items.push({
                pos: idx + 1,
                description: `Unterkunft ${roomName}`,
                details: `${assignment.beds} Betten x ${nights} Nächte x ${pricePerNight.toFixed(2)} €`,
                quantity: nights,
                unit: 'Tage',
                unitPrice: assignment.beds * pricePerNight,
                total: itemTotal,
                vatRate: 0.07 // Beherbergung 7%
            });
        });
    } else {
        // Fallback: single item based on total beds
        const itemTotal = booking.bedCount * pricePerNight * nights;
        netTotal = itemTotal;

        items.push({
            pos: 1,
            description: `Unterkunft ${locationName}`,
            details: `${booking.bedCount} Betten x ${nights} Nächte x ${pricePerNight.toFixed(2)} €`,
            quantity: nights,
            unit: 'Tage',
            unitPrice: booking.bedCount * pricePerNight,
            total: itemTotal,
            vatRate: 0.07
        });
    }

    const vatAmount = netTotal * 0.07;
    const grossTotal = netTotal + vatAmount;

    const invoice: Invoice = {
        id: `inv-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        invoiceNumber: booking.invoiceNumber || generateInvoiceNumber(),
        customerId: customer?.id || '',
        customerName: booking.customerName,
        customerNumber: customer?.customerNumber || booking.customerNumber || '',
        bookingId: booking.id,
        billingAddress: booking.billingAddress || (customer ? formatBillingAddress(customer) : ''),
        date: new Date(),
        dueDate: addDays(new Date(), 14),
        servicePeriodStart: new Date(booking.startDate),
        servicePeriodEnd: new Date(booking.endDate),
        amount: grossTotal,
        netAmount: netTotal,
        vatAmount: vatAmount,
        status: status,
        items: items
    };

    return invoice;
}

/**
 * Generates a unique invoice number
 */
export function generateInvoiceNumber(): string {
    const year = new Date().getFullYear();
    const random = Math.floor(1000 + Math.random() * 9000);
    return `RE${year}-${random}`;
}

/**
 * Formats customer billing address
 */
export function formatBillingAddress(customer: Customer): string {
    if (customer.company) {
        return `${customer.company}\n${customer.street}\n${customer.zip} ${customer.city}`;
    }
    return `${customer.name}\n${customer.street}\n${customer.zip} ${customer.city}`;
}

/**
 * Updates invoice status based on booking status
 */
export function syncInvoiceStatusWithBooking(
    invoice: Invoice,
    bookingStatus: Booking['status']
): Invoice {
    if (bookingStatus === 'cancelled') {
        return { ...invoice, status: 'cancelled' };
    }
    return invoice;
}

/**
 * Calculate total revenue from invoices
 */
export function calculateTotalRevenue(invoices: Invoice[], status?: Invoice['status']): number {
    return invoices
        .filter(inv => !status || inv.status === status)
        .reduce((sum, inv) => sum + inv.amount, 0);
}
