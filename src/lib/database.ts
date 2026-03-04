
import { supabase } from './supabase';
import { Location, Property, Room, Customer, Booking, Invoice, InvoiceItem, CompanySettings } from '../types';

// ============================================
// TYPE CONVERTERS (DB <-> Frontend)
// ============================================

// Convert DB date string to JS Date
const toDate = (dateStr: string | null): Date => dateStr ? new Date(dateStr) : new Date();

// Convert JS Date to ISO string for DB
const toDateStr = (date: Date): string => date.toISOString().split('T')[0];

// ============================================
// LOCATIONS, PROPERTIES, ROOMS
// ============================================

export async function fetchLocations(): Promise<Location[]> {
    const { data: locations, error: locError } = await supabase
        .from('locations')
        .select('*')
        .order('name');

    if (locError) throw locError;
    if (!locations || locations.length === 0) return [];

    const { data: properties, error: propError } = await supabase
        .from('properties')
        .select('*')
        .order('name');

    if (propError) throw propError;

    const { data: rooms, error: roomError } = await supabase
        .from('rooms')
        .select('*')
        .order('name');

    if (roomError) throw roomError;

    // Build hierarchical structure
    return locations.map(loc => ({
        id: loc.id,
        name: loc.name,
        properties: (properties || [])
            .filter(p => p.location_id === loc.id)
            .map(prop => ({
                id: prop.id,
                name: prop.name,
                locationId: prop.location_id,
                street: prop.street || undefined,
                zip: prop.zip || undefined,
                city: prop.city || undefined,
                rooms: (rooms || [])
                    .filter(r => r.property_id === prop.id)
                    .map(room => ({
                        id: room.id,
                        name: room.name,
                        propertyId: room.property_id,
                        capacity: room.capacity,
                        roomCount: room.room_count ? parseFloat(room.room_count) : undefined,
                    }))
            }))
    }));
}

export async function saveLocation(location: { name: string }): Promise<string> {
    const { data, error } = await supabase
        .from('locations')
        .insert({ name: location.name })
        .select('id')
        .single();

    if (error) throw error;
    return data.id;
}

export async function deleteLocation(id: string): Promise<void> {
    const { error } = await supabase.from('locations').delete().eq('id', id);
    if (error) throw error;
}

export async function saveProperty(property: { name: string; locationId: string; street?: string; zip?: string; city?: string }): Promise<string> {
    const { data, error } = await supabase
        .from('properties')
        .insert({
            name: property.name,
            location_id: property.locationId,
            street: property.street,
            zip: property.zip,
            city: property.city,
        })
        .select('id')
        .single();

    if (error) throw error;
    return data.id;
}

export async function updateProperty(id: string, property: Partial<Property>): Promise<void> {
    const { error } = await supabase
        .from('properties')
        .update({
            name: property.name,
            street: property.street,
            zip: property.zip,
            city: property.city,
        })
        .eq('id', id);

    if (error) throw error;
}

export async function deleteProperty(id: string): Promise<void> {
    const { error } = await supabase.from('properties').delete().eq('id', id);
    if (error) throw error;
}

export async function saveRoom(room: { name: string; propertyId: string; capacity: number; roomCount?: number }): Promise<string> {
    const { data, error } = await supabase
        .from('rooms')
        .insert({
            name: room.name,
            property_id: room.propertyId,
            capacity: room.capacity,
            room_count: room.roomCount,
        })
        .select('id')
        .single();

    if (error) throw error;
    return data.id;
}

export async function updateRoom(id: string, room: Partial<Room>): Promise<void> {
    const { error } = await supabase
        .from('rooms')
        .update({
            name: room.name,
            capacity: room.capacity,
            room_count: room.roomCount,
        })
        .eq('id', id);

    if (error) throw error;
}

export async function deleteRoom(id: string): Promise<void> {
    const { error } = await supabase.from('rooms').delete().eq('id', id);
    if (error) throw error;
}

// ============================================
// CUSTOMERS
// ============================================

export async function fetchCustomers(): Promise<Customer[]> {
    const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('name');

    if (error) throw error;

    return (data || []).map(c => ({
        id: c.id,
        customerNumber: c.customer_number,
        name: c.name,
        email: c.email || '',
        phone: c.phone,
        company: c.company,
        street: c.street || '',
        zip: c.zip || '',
        city: c.city || '',
        country: c.country,
        management: c.management,
        contactPerson: c.contact_person,
        accountingContact: c.accounting_contact,
        billingAddress: c.billing_address_override,
    }));
}

export async function findCustomerByName(nameOrCompany: string): Promise<Customer | null> {
    if (!nameOrCompany || nameOrCompany.trim().length === 0) return null;

    // Check if it matches company OR name
    const { data } = await supabase
        .from('customers')
        .select('*')
        .or(`company.ilike.%${nameOrCompany}%,name.ilike.%${nameOrCompany}%`)
        .limit(1)
        .maybeSingle();

    if (!data) return null;

    return {
        id: data.id,
        customerNumber: data.customer_number,
        name: data.name,
        email: data.email || '',
        phone: data.phone,
        company: data.company,
        street: data.street || '',
        zip: data.zip || '',
        city: data.city || '',
        country: data.country,
        management: data.management,
        contactPerson: data.contact_person,
        accountingContact: data.accounting_contact,
        billingAddress: data.billing_address_override,
    };
}

export async function saveCustomer(customer: Customer): Promise<string> {
    const payload = {
        customer_number: customer.customerNumber,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        company: customer.company,
        street: customer.street,
        zip: customer.zip,
        city: customer.city,
        country: customer.country,
        management: customer.management,
        contact_person: customer.contactPerson,
        accounting_contact: customer.accountingContact,
        billing_address_override: customer.billingAddress,
    };

    // Check if customer exists (upsert)
    const { data: existing } = await supabase
        .from('customers')
        .select('id')
        .eq('id', customer.id)
        .maybeSingle();

    if (existing) {
        const { error } = await supabase
            .from('customers')
            .update(payload)
            .eq('id', customer.id);
        if (error) throw error;
        return customer.id;
    } else {
        const { data, error } = await supabase
            .from('customers')
            .insert({ id: customer.id, ...payload })
            .select('id')
            .single();
        if (error) throw error;
        return data.id;
    }
}

export async function deleteCustomer(id: string): Promise<void> {
    const { error } = await supabase.from('customers').delete().eq('id', id);
    if (error) throw error;
}

// ============================================
// BOOKINGS
// ============================================

export async function fetchBookings(): Promise<Booking[]> {
    const { data: bookings, error } = await supabase
        .from('bookings')
        .select('*')
        .order('start_date', { ascending: false });

    if (error) throw error;

    // Fetch room assignments
    const { data: assignments } = await supabase
        .from('booking_room_assignments')
        .select('*');

    return (bookings || []).map(b => ({
        id: b.id,
        customerName: b.customer_name_snapshot || '',
        companyName: b.customer_name_snapshot, // Same as customerName
        customerId: b.customer_id,
        invoiceId: b.invoice_id,
        projectName: b.project_name || '',
        locationId: '', // Will be derived from room assignments
        propertyId: undefined,
        roomId: undefined,
        bedCount: b.bed_count,
        startDate: toDate(b.start_date),
        endDate: toDate(b.end_date),
        assignedRooms: (assignments || [])
            .filter(a => a.booking_id === b.id)
            .map(a => a.room_id),
        roomAssignments: (assignments || [])
            .filter(a => a.booking_id === b.id)
            .map(a => ({ roomId: a.room_id, beds: a.assigned_beds })),
        pricePerBedPerNight: parseFloat(b.price_per_bed_per_night) || 0,
        status: b.status as 'reserved' | 'confirmed' | 'cancelled',
        invoiceNumber: b.invoice_number_snapshot,
        customerNumber: b.customer_number_snapshot,
        billingAddress: b.billing_address_snapshot,
        customerEmail: b.customer_email_snapshot,
        customerPhone: b.customer_phone_snapshot,
    }));
}

export async function saveBooking(booking: Booking, customer?: Customer): Promise<string> {
    const payload = {
        customer_id: booking.customerId,
        invoice_id: booking.invoiceId,
        project_name: booking.projectName,
        status: booking.status,
        start_date: toDateStr(booking.startDate),
        end_date: toDateStr(booking.endDate),
        bed_count: booking.bedCount,
        price_per_bed_per_night: booking.pricePerBedPerNight,
        // Snapshots
        customer_name_snapshot: booking.customerName || booking.companyName || customer?.company || customer?.name,
        invoice_number_snapshot: booking.invoiceNumber,
        customer_number_snapshot: booking.customerNumber || customer?.customerNumber,
        billing_address_snapshot: booking.billingAddress || customer?.billingAddress,
        customer_email_snapshot: booking.customerEmail || customer?.email,
        customer_phone_snapshot: booking.customerPhone || customer?.phone,
    };

    // Check if exists
    const { data: existing } = await supabase
        .from('bookings')
        .select('id')
        .eq('id', booking.id)
        .maybeSingle();

    let bookingId: string;

    if (existing) {
        const { error } = await supabase
            .from('bookings')
            .update(payload)
            .eq('id', booking.id);
        if (error) throw error;
        bookingId = booking.id;
    } else {
        const { data, error } = await supabase
            .from('bookings')
            .insert({ id: booking.id, ...payload })
            .select('id')
            .single();
        if (error) throw error;
        bookingId = data.id;
    }

    // Update room assignments
    if (booking.roomAssignments && booking.roomAssignments.length > 0) {
        // Delete existing
        await supabase
            .from('booking_room_assignments')
            .delete()
            .eq('booking_id', bookingId);

        // Insert new
        const { error: assignError } = await supabase
            .from('booking_room_assignments')
            .insert(
                booking.roomAssignments.map(ra => ({
                    booking_id: bookingId,
                    room_id: ra.roomId,
                    assigned_beds: ra.beds,
                }))
            );
        if (assignError) throw assignError;
    }

    return bookingId;
}

export async function updateBookingStatus(id: string, status: 'reserved' | 'confirmed' | 'cancelled'): Promise<void> {
    const { error } = await supabase
        .from('bookings')
        .update({ status })
        .eq('id', id);
    if (error) throw error;
}

export async function deleteBooking(id: string): Promise<void> {
    // Assignments are deleted via CASCADE
    const { error } = await supabase.from('bookings').delete().eq('id', id);
    if (error) throw error;
}

// ============================================
// INVOICES
// ============================================

export async function fetchInvoices(): Promise<Invoice[]> {
    const { data: invoices, error } = await supabase
        .from('invoices')
        .select('*')
        .order('date', { ascending: false });

    if (error) throw error;

    const { data: items } = await supabase
        .from('invoice_items')
        .select('*')
        .order('pos');

    return (invoices || []).map(inv => ({
        id: inv.id,
        invoiceNumber: inv.invoice_number,
        customerId: inv.customer_id,
        customerName: inv.customer_name_snapshot || '',
        customerNumber: inv.customer_number_snapshot || '',
        bookingId: inv.booking_id,
        billingAddress: inv.billing_address_snapshot || '',
        date: toDate(inv.date),
        dueDate: toDate(inv.due_date),
        paidDate: inv.paid_date ? toDate(inv.paid_date) : undefined,
        servicePeriodStart: toDate(inv.service_period_start),
        servicePeriodEnd: toDate(inv.service_period_end),
        amount: parseFloat(inv.amount) || 0,
        netAmount: parseFloat(inv.net_amount) || 0,
        vatAmount: parseFloat(inv.vat_amount) || 0,
        status: inv.status as Invoice['status'],
        pdfPath: inv.pdf_path,
        created_at: toDate(inv.created_at),
        items: (items || [])
            .filter(i => i.invoice_id === inv.id)
            .map(i => ({
                pos: i.pos,
                description: i.description,
                details: i.details,
                quantity: parseFloat(i.quantity) || 0,
                unit: i.unit as InvoiceItem['unit'],
                unitPrice: parseFloat(i.unit_price) || 0,
                total: parseFloat(i.total) || 0,
                vatRate: parseFloat(i.vat_rate) || 0,
            })),
    }));
}

export async function saveInvoice(invoice: Invoice): Promise<string> {
    const payload = {
        invoice_number: invoice.invoiceNumber,
        customer_id: invoice.customerId,
        booking_id: invoice.bookingId,
        customer_name_snapshot: invoice.customerName,
        customer_number_snapshot: invoice.customerNumber,
        billing_address_snapshot: invoice.billingAddress,
        date: toDateStr(invoice.date),
        due_date: toDateStr(invoice.dueDate),
        paid_date: invoice.paidDate ? toDateStr(invoice.paidDate) : null,
        service_period_start: toDateStr(invoice.servicePeriodStart),
        service_period_end: toDateStr(invoice.servicePeriodEnd),
        amount: invoice.amount,
        net_amount: invoice.netAmount,
        vat_amount: invoice.vatAmount,
        status: invoice.status,
        pdf_path: invoice.pdfPath,
    };

    const { data: existing } = await supabase
        .from('invoices')
        .select('id')
        .eq('id', invoice.id)
        .maybeSingle();

    let invoiceId: string;

    if (existing) {
        const { error } = await supabase
            .from('invoices')
            .update(payload)
            .eq('id', invoice.id);
        if (error) throw error;
        invoiceId = invoice.id;
    } else {
        const { data, error } = await supabase
            .from('invoices')
            .insert({ id: invoice.id, ...payload })
            .select('id')
            .single();
        if (error) throw error;
        invoiceId = data.id;
    }

    // Update items
    if (invoice.items && invoice.items.length > 0) {
        await supabase
            .from('invoice_items')
            .delete()
            .eq('invoice_id', invoiceId);

        const { error: itemsError } = await supabase
            .from('invoice_items')
            .insert(
                invoice.items.map(item => ({
                    invoice_id: invoiceId,
                    pos: item.pos,
                    description: item.description,
                    details: item.details,
                    quantity: item.quantity,
                    unit: item.unit,
                    unit_price: item.unitPrice,
                    total: item.total,
                    vat_rate: item.vatRate,
                }))
            );
        if (itemsError) throw itemsError;
    }

    return invoiceId;
}

export async function deleteInvoice(id: string): Promise<void> {
    const { error } = await supabase.from('invoices').delete().eq('id', id);
    if (error) throw error;
}

export async function uploadInvoicePdf(file: File, invoiceId: string): Promise<string> {
    const fileExt = file.name.split('.').pop();
    const fileName = `${invoiceId}-${Date.now()}.${fileExt}`;
    const filePath = `${fileName}`;

    const { error: uploadError } = await supabase.storage
        .from('invoices')
        .upload(filePath, file);

    if (uploadError) {
        throw uploadError;
    }

    return filePath;
}

export function getInvoicePdfUrl(path: string): string {
    const { data } = supabase.storage
        .from('invoices')
        .getPublicUrl(path);

    return data.publicUrl;
}

// ============================================
// COMPANY SETTINGS
// ============================================

export async function fetchCompanySettings(): Promise<CompanySettings | null> {
    const { data, error } = await supabase
        .from('company_settings')
        .select('*')
        .limit(1)
        .maybeSingle();

    if (error) {
        console.error('Error fetching company settings:', error);
        return null;
    }
    if (!data) return null;

    return {
        name: data.name,
        address: data.address || '',
        zipCity: data.zip_city || '',
        phone: data.phone || '',
        email: data.email || '',
        website: data.website || '',
        ceo: data.ceo || '',
        hrb: data.hrb || '',
        court: data.court || '',
        vatId: data.vat_id || '',
        taxId: data.tax_id || '',
        bankName: data.bank_name || '',
        iban: data.iban || '',
        bic: data.bic || '',
    };
}

export async function saveCompanySettings(settings: CompanySettings): Promise<void> {
    const payload = {
        name: settings.name,
        address: settings.address,
        zip_city: settings.zipCity,
        phone: settings.phone,
        email: settings.email,
        website: settings.website,
        ceo: settings.ceo,
        hrb: settings.hrb,
        court: settings.court,
        vat_id: settings.vatId,
        tax_id: settings.taxId,
        bank_name: settings.bankName,
        iban: settings.iban,
        bic: settings.bic,
    };

    // Check if exists
    const { data: existing } = await supabase
        .from('company_settings')
        .select('id')
        .limit(1)
        .maybeSingle();

    if (existing) {
        const { error } = await supabase
            .from('company_settings')
            .update(payload)
            .eq('id', existing.id);
        if (error) throw error;
    } else {
        const { error } = await supabase
            .from('company_settings')
            .insert(payload);
        if (error) throw error;
    }
}

export async function findInvoiceByNumber(invoiceNumber: string): Promise<Invoice | null> {
    const { data } = await supabase
        .from('invoices')
        .select('*')
        .eq('invoice_number', invoiceNumber)
        .maybeSingle();

    if (!data) return null;

    return {
        id: data.id,
        invoiceNumber: data.invoice_number,
        customerId: data.customer_id,
        customerName: data.customer_name,
        customerNumber: data.customer_number,
        billingAddress: data.billing_address,
        date: new Date(data.date),
        dueDate: new Date(data.due_date),
        servicePeriodStart: new Date(data.service_period_start),
        servicePeriodEnd: new Date(data.service_period_end),
        netAmount: data.net_amount,
        vatAmount: data.vat_amount,
        amount: data.amount,
        status: data.status,
        paidDate: data.paid_date ? new Date(data.paid_date) : undefined,
        items: [],
        created_at: new Date(data.created_at)
    };
}

// ============================================
// SEED INITIAL DATA
// ============================================

export async function seedInitialData(
    locations: Location[],
    customers: Customer[]
): Promise<void> {
    // Check if we have any data - if yes, skip seeding entirely
    const { data: existingLocs, error: checkError } = await supabase
        .from('locations')
        .select('id')
        .limit(1);

    if (checkError) {
        console.error('Error checking existing data:', checkError);
        return;
    }

    if (existingLocs && existingLocs.length > 0) {
        console.log('Database already has data, skipping seed');
        return;
    }

    console.log('Seeding initial data...');

    // Use upsert to avoid conflicts
    for (const loc of locations) {
        const { error: locError } = await supabase
            .from('locations')
            .upsert({ id: loc.id, name: loc.name }, { onConflict: 'id' });

        if (locError) {
            console.error('Error upserting location:', locError);
            continue;
        }

        // Insert properties
        for (const prop of loc.properties) {
            const { error: propError } = await supabase
                .from('properties')
                .upsert({
                    id: prop.id,
                    location_id: loc.id,
                    name: prop.name,
                    street: prop.street,
                    zip: prop.zip,
                    city: prop.city,
                }, { onConflict: 'id' });

            if (propError) {
                console.error('Error upserting property:', propError);
                continue;
            }

            // Insert rooms
            for (const room of prop.rooms) {
                const { error: roomError } = await supabase
                    .from('rooms')
                    .upsert({
                        id: room.id,
                        property_id: prop.id,
                        name: room.name,
                        capacity: room.capacity,
                        room_count: room.roomCount,
                    }, { onConflict: 'id' });

                if (roomError) {
                    console.error('Error upserting room:', roomError);
                }
            }
        }
    }

    // Insert customers
    for (const customer of customers) {
        const { error } = await supabase
            .from('customers')
            .upsert({
                id: customer.id,
                customer_number: customer.customerNumber,
                name: customer.name,
                email: customer.email,
                phone: customer.phone,
                company: customer.company,
                street: customer.street,
                zip: customer.zip,
                city: customer.city,
                country: customer.country,
                billing_address_override: customer.billingAddress,
            }, { onConflict: 'id' });

        if (error) {
            console.error('Error upserting customer:', error);
        }
    }

    console.log('Seed complete!');
}

// ============================================
// IMPORT HELPERS
// ============================================

export async function findCustomerByNumber(customerNumber: string): Promise<Customer | null> {
    const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('customer_number', customerNumber)
        .maybeSingle();

    if (error || !data) return null;

    return {
        id: data.id,
        customerNumber: data.customer_number,
        name: data.name,
        email: data.email || '',
        phone: data.phone,
        company: data.company,
        street: data.street || '',
        zip: data.zip || '',
        city: data.city || '',
        country: data.country,
        management: data.management,
        contactPerson: data.contact_person,
        accountingContact: data.accounting_contact,
        billingAddress: data.billing_address_override,
    };
}

export async function findRoomByName(roomName: string): Promise<{ room: Room; property: Property; locationId: string } | null> {
    // Normalize the room name: "KB40b / WE14" should match "KB40b / WE14"
    // Also handle variations like "KB40b/WE14" or "KB40b  /  WE14"
    const normalizedName = roomName.trim().replace(/\s*\/\s*/g, ' / ');

    console.log('Looking for room:', normalizedName);

    // Try exact match first
    let { data: roomData, error: roomError } = await supabase
        .from('rooms')
        .select('*')
        .eq('name', normalizedName)
        .maybeSingle();

    // If not found, try with ILIKE for case-insensitive and pattern matching
    if (!roomData) {
        const likePattern = `%${normalizedName}%`;
        const result = await supabase
            .from('rooms')
            .select('*')
            .ilike('name', likePattern)
            .maybeSingle();

        roomData = result.data;
        roomError = result.error;
    }

    // Still not found? Try matching just the unit part (WE14) within a property pattern
    if (!roomData && roomName.includes('/')) {
        const parts = roomName.split('/').map(p => p.trim());
        if (parts.length >= 2) {
            const property = parts[0];
            const unit = parts[1];

            // Helper to make pattern flexible: "MST323" -> "%MST%323%"
            // This allows matching "MST 323" when input is "MST323"
            const makeFlexible = (str: string) => {
                // Insert % between letters and numbers
                return str.replace(/([a-zA-Z])(\d)/g, '$1%$2')
                    .replace(/(\d)([a-zA-Z])/g, '$1%$2');
            };

            const flexProperty = makeFlexible(property);
            const flexUnit = makeFlexible(unit);

            // Strategy 1: Search for name containing both property and unit
            const searchPattern = `%${flexProperty}%${flexUnit}%`;

            console.log('Trying flexible pattern:', searchPattern);

            let result = await supabase
                .from('rooms')
                .select('*')
                .ilike('name', searchPattern)
                .maybeSingle();

            roomData = result.data;
            roomError = result.error;

            // Strategy 2: Search for ANY room matching the UNIT, then check if Property matches
            // This helps if room name in DB is just "WE6" but invoice says "RLD6 / WE6"
            if (!roomData) {
                console.log(`Trying split strategy: Find room matching unit '${unit}' and property '${property}'`);

                // Find ALL rooms that match the unit fuzzy
                // e.g. "WE6" -> "%WE%6%"

                const unitPattern = `%${flexUnit}%`;
                const { data: candidates } = await supabase
                    .from('rooms')
                    .select('*, properties!inner(*)') // Inner join to properties to filter
                    .ilike('name', unitPattern);

                if (candidates && candidates.length > 0) {
                    // Filter in memory for the property name
                    const matched = candidates.find((r: any) => {
                        const propName = r.properties?.name || "";
                        // Check if property name contains our search property OR vice versa (fuzzy)
                        // e.g. "Dorfstraße 25" (DB) matching "Dorfstraße 25C" (Input)
                        const simplifiedPropDB = propName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
                        const simplifiedPropSearch = property.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
                        return simplifiedPropDB.includes(simplifiedPropSearch) || simplifiedPropSearch.includes(simplifiedPropDB);
                    });

                    if (matched) {
                        console.log('Found match via Split Strategy:', matched.name);
                        roomData = matched;
                    }
                }
            }

            // Strategy 3: Loose matching (numbers only)
            if (!roomData) {
                const propNums = property.match(/\d+/);
                const unitNums = unit.match(/\d+/);
                if (propNums && unitNums) {
                    const loosePattern = `%${propNums[0]}%${unit}%`;
                    console.log('Trying loose pattern:', loosePattern);
                    const looseResult = await supabase
                        .from('rooms')
                        .select('*')
                        .ilike('name', loosePattern)
                        .maybeSingle();
                    roomData = looseResult.data;
                }
            }
        }
    }

    if (roomError || !roomData) {
        console.log('Room not found:', normalizedName);
        return null;
    }

    console.log('Found room:', roomData.name);

    const { data: propData, error: propError } = await supabase
        .from('properties')
        .select('*')
        .eq('id', roomData.property_id)
        .single();

    if (propError || !propData) return null;

    return {
        room: {
            id: roomData.id,
            name: roomData.name,
            propertyId: roomData.property_id,
            capacity: roomData.capacity,
            roomCount: roomData.room_count ? parseFloat(roomData.room_count) : undefined,
        },
        property: {
            id: propData.id,
            name: propData.name,
            locationId: propData.location_id,
            street: propData.street,
            zip: propData.zip,
            city: propData.city,
            rooms: [],
        },
        locationId: propData.location_id,
    };
}

export async function generateNextCustomerNumber(): Promise<string> {
    const { data } = await supabase
        .from('customers')
        .select('customer_number')
        .order('customer_number', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (data && data.customer_number) {
        const num = parseInt(data.customer_number);
        if (!isNaN(num)) {
            return String(num + 1);
        }
    }
    return '10001';
}
