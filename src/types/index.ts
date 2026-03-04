export interface Location {
  id: string;
  name: string;
  properties: Property[];
}

export interface Property {
  id: string;
  name: string;
  locationId: string;
  rooms: Room[];
  street?: string; // Optional for now to be backward compatible
  zip?: string;
  city?: string;
}

export interface Room {
  id: string;
  name: string;
  propertyId: string;
  capacity: number; // Anzahl der Betten
  roomCount?: number; // Anzahl der Zimmer (kann Dezimalzahlen wie 1,5 enthalten)
}

export interface Booking {
  id: string;
  customerName: string;
  companyName?: string;
  customerId?: string; // Primäre Verknüpfung zum Kunden
  invoiceId?: string; // Verknüpfung zur Rechnung
  projectName: string;
  locationId: string;
  propertyId?: string;
  roomId?: string;
  bedCount: number;
  startDate: Date;
  endDate: Date;
  assignedRooms?: string[]; // Array von Room-IDs
  roomAssignments?: { roomId: string; beds: number }[]; // Precise assignment
  pricePerBedPerNight: number; // Preis pro Bett pro Nacht in Euro
  status: 'reserved' | 'confirmed' | 'cancelled';

  // Snapshot Data for Invoices
  invoiceNumber?: string;
  customerNumber?: string;
  billingAddress?: string;
  customerEmail?: string;
  customerPhone?: string;
}

export interface OccupancyData {
  roomId: string;
  date: Date;
  occupied: number;
  available: number;
  percentage: number;
  bookings: Booking[];
}

export interface AvailabilityCheck {
  locationId: string;
  bedCount: number;
  startDate: Date;
  endDate: Date;
  available: boolean;
  suggestions: RoomSuggestion[];
}

export interface RoomSuggestion {
  roomId: string;
  roomName: string;
  propertyName: string;
  availableBeds: number;
  dates: Date[];
}

export interface Customer {
  id: string;
  customerNumber: string; // e.g., 11287
  name: string;
  email: string;
  phone?: string;
  company?: string;
  // Structured Address
  street: string;
  zip: string;
  city: string;
  country?: string; // Land

  // Additional Contact Info
  management?: string; // Geschäftsführung
  contactPerson?: string; // Ansprechpartner
  accountingContact?: string; // Buchhaltung (Email/Kontakt)

  billingAddress?: string; // Optional override
}

export interface Invoice {
  id: string;
  invoiceNumber: string; // e.g., RE2024-0442
  customerId: string;
  customerName: string;
  customerNumber: string;
  bookingId?: string; // Verknüpfung zur Buchung
  billingAddress: string;
  date: Date;
  dueDate: Date;
  paidDate?: Date; // Datum der Zahlung
  servicePeriodStart: Date;
  servicePeriodEnd: Date;
  amount: number; // Gross total
  netAmount: number;
  vatAmount: number; // Total VAT
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  items: InvoiceItem[];
  pdfPath?: string;
  created_at: Date;
  updated_at?: Date;
}

export interface InvoiceItem {
  pos: number;
  description: string; // Title
  details?: string; // Additional text like "2 Vollmöblierte Zimmer..."
  quantity: number;
  unit: 'Tage' | 'Stück' | 'Pauschale';
  unitPrice: number;
  total: number;
  vatRate: number; // e.g. 0.07 or 0.19
}


export interface CompanySettings {
  name: string;
  address: string;
  zipCity: string;
  phone: string;
  email: string;
  website: string;
  ceo: string;
  hrb: string;
  court: string;
  vatId: string;
  taxId: string;
  bankName: string;
  iban: string;
  bic: string;
}
