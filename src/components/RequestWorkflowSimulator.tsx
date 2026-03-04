import React, { useMemo, useState } from 'react';
import { addDays } from 'date-fns';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { Input } from './ui/Input';
import { Label } from './ui/Label';
import { Textarea } from './ui/Textarea';
import { Location, Booking, Customer, CompanySettings } from '../types';
import { checkAvailability } from '../utils/occupancy';
import { OfferPreview } from './OfferPreview';
import { MessageSquare, Search, Settings, CheckCircle, FileText, ArrowRight, ArrowLeft, Check } from 'lucide-react';

type AdminDecision = 'wartet' | 'bestaetigt' | 'abgelehnt';
type WizardStep = 1 | 2 | 3 | 4 | 5;

interface ParsedRequest {
  beds?: number;
  startDate?: Date;
  endDate?: Date;
  locationId?: string;
  rawLocation?: string;
  notes?: string;
}

interface RequestWorkflowSimulatorProps {
  locations: Location[];
  bookings: Booking[];
  customers?: Customer[];
  companySettings?: CompanySettings;
  onBookingCreated: (booking: Booking) => void;
  onBookingStatusChange: (bookingId: string, status: 'reserved' | 'confirmed') => void;
}

function parseDateRange(message: string): { start?: Date; end?: Date } {
  const dateRegex = /(\d{1,2})\.(\d{1,2})(?:\.(\d{2,4}))?/g;
  const matches = [...message.matchAll(dateRegex)];
  if (matches.length === 0) return {};

  const toDate = (m: RegExpMatchArray): Date => {
    const day = Number(m[1]);
    const month = Number(m[2]) - 1;
    const year = m[3] ? Number(m[3].length === 2 ? `20${m[3]}` : m[3]) : new Date().getFullYear();
    return new Date(year, month, day);
  };

  const start = toDate(matches[0]);
  const end = matches[1] ? toDate(matches[1]) : addDays(start, 6);
  return { start, end };
}

function parseCustomerMessage(message: string, locations: Location[]): { parsed: ParsedRequest; missing: string[] } {
  const lower = message.toLowerCase();
  const missing: string[] = [];

  const bedMatch = message.match(/(\d{1,3})\s*(betten|beds|bett)/i);
  const beds = bedMatch ? Number(bedMatch[1]) : undefined;
  const { start, end } = parseDateRange(message);
  const foundLocation = locations.find(loc => lower.includes(loc.name.toLowerCase()));

  if (!beds) missing.push('Anzahl Betten');
  if (!start || !end) missing.push('Zeitraum');
  if (!foundLocation) missing.push('Standort');

  return {
    parsed: {
      beds,
      startDate: start,
      endDate: end,
      locationId: foundLocation?.id,
      rawLocation: foundLocation?.name,
      notes: missing.length ? 'Unvollständig' : 'Alle Infos erkannt',
    },
    missing,
  };
}

const STEPS = [
  { id: 1, label: 'Nachricht', icon: MessageSquare },
  { id: 2, label: 'Scan', icon: Search },
  { id: 3, label: 'Konfig', icon: Settings },
  { id: 4, label: 'Bestätigen', icon: CheckCircle },
  { id: 5, label: 'Angebot', icon: FileText },
] as const;

export const RequestWorkflowSimulator: React.FC<RequestWorkflowSimulatorProps> = ({
  locations,
  bookings,
  customers = [],
  companySettings,
  onBookingCreated,
  onBookingStatusChange,
}) => {
  // Wizard state
  const [currentStep, setCurrentStep] = useState<WizardStep>(1);

  // Form state
  const [message, setMessage] = useState('Hi, wir brauchen 20 Betten in Berlin vom 12.01.2026 bis 20.01.2026. Danke!');
  const [parsed, setParsed] = useState<ParsedRequest | null>(null);
  const [missing, setMissing] = useState<string[]>([]);
  const [adminDecision, setAdminDecision] = useState<AdminDecision>('wartet');
  const [offerSent, setOfferSent] = useState(false);
  const [customerAccepted, setCustomerAccepted] = useState(false);
  const [createdBookingId, setCreatedBookingId] = useState<string | null>(null);
  const [offerPreviewOpen, setOfferPreviewOpen] = useState(false);
  const [pricePerBed, setPricePerBed] = useState(25);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');

  const availability = useMemo(() => {
    if (!parsed?.beds || !parsed.startDate || !parsed.endDate || !parsed.locationId) return null;
    const location = locations.find(l => l.id === parsed.locationId);
    if (!location) return null;
    const allRooms = location.properties.flatMap(p => p.rooms);
    const result = checkAvailability(allRooms, parsed.beds, parsed.startDate, parsed.endDate, bookings);
    return { ...result, locationName: location.name };
  }, [bookings, locations, parsed]);

  const handleScan = () => {
    const { parsed: p, missing: m } = parseCustomerMessage(message, locations);
    setParsed(p);
    setMissing(m);
    setCurrentStep(2);
  };

  const handleAdminConfirm = () => {
    if (!parsed || !availability) return;
    if (!selectedCustomerId) {
      alert("Bitte wählen Sie einen Kunden aus.");
      return;
    }

    const selectedCustomer = customers.find(c => c.id === selectedCustomerId);
    const newBooking: Booking = {
      id: Math.random().toString(36).substr(2, 9),
      propertyId: 'mock-prop-1',
      roomId: 'mock-room-1',
      startDate: parsed.startDate!,
      endDate: parsed.endDate!,
      locationId: parsed.locationId!,
      status: 'reserved',
      companyName: selectedCustomer?.company || 'Unbekannt',
      projectName: 'Montage B311',
      customerName: selectedCustomer ? (selectedCustomer.company || selectedCustomer.name) : 'Neuer Kunde',
      bedCount: availability.suggestions.reduce((acc, s) => acc + s.availableBeds, 0),
      assignedRooms: availability.suggestions.map(s => s.roomId),
      roomAssignments: availability.suggestions.map(s => ({ roomId: s.roomId, beds: s.availableBeds })),
      pricePerBedPerNight: pricePerBed,
      invoiceNumber: `RE${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      customerNumber: selectedCustomer?.customerNumber || 'C-NEW',
      billingAddress: selectedCustomer ? (
        selectedCustomer.company
          ? `${selectedCustomer.company}\n${selectedCustomer.street}\n${selectedCustomer.zip} ${selectedCustomer.city}`
          : `${selectedCustomer.name}\n${selectedCustomer.street}\n${selectedCustomer.zip} ${selectedCustomer.city}`
      ) : '',
      customerEmail: selectedCustomer?.email || '',
      customerPhone: selectedCustomer?.phone || ''
    };

    onBookingCreated(newBooking);
    setCreatedBookingId(newBooking.id);
    setAdminDecision('bestaetigt');
    setCurrentStep(5);
  };

  const handleCustomerConfirm = () => {
    setCustomerAccepted(true);
    if (createdBookingId) {
      onBookingStatusChange(createdBookingId, 'confirmed');
    }
  };

  const handleOfferSend = () => {
    setOfferSent(true);
    setOfferPreviewOpen(false);
  };

  const getFullRoomName = (roomId: string) => {
    for (const loc of locations) {
      for (const prop of loc.properties) {
        const room = prop.rooms.find(r => r.id === roomId);
        if (room) return `${prop.name} - ${room.name}`;
      }
    }
    return roomId;
  };

  const handleReset = () => {
    setCurrentStep(1);
    setParsed(null);
    setMissing([]);
    setAdminDecision('wartet');
    setOfferSent(false);
    setCustomerAccepted(false);
    setCreatedBookingId(null);
    setSelectedCustomerId('');
  };

  const canProceedToStep = (step: WizardStep): boolean => {
    switch (step) {
      case 2: return !!message.trim();
      case 3: return !!parsed && !!availability?.available;
      case 4: return !!selectedCustomerId;
      case 5: return adminDecision === 'bestaetigt';
      default: return true;
    }
  };

  const createdBooking = createdBookingId ? bookings.find(b => b.id === createdBookingId) : null;

  // Step indicator component
  const StepIndicator = () => (
    <div className="flex items-center justify-center gap-1 mb-6">
      {STEPS.map((step, idx) => {
        const Icon = step.icon;
        const isActive = currentStep === step.id;
        const isCompleted = currentStep > step.id;
        const isClickable = step.id < currentStep || (step.id === currentStep + 1 && canProceedToStep(step.id as WizardStep));

        return (
          <React.Fragment key={step.id}>
            <button
              onClick={() => isClickable && setCurrentStep(step.id as WizardStep)}
              disabled={!isClickable}
              className={`flex flex-col items-center p-2 rounded-lg transition-all ${isActive ? 'bg-blue-600 text-white scale-105' :
                isCompleted ? 'bg-green-100 text-green-700 hover:bg-green-200' :
                  isClickable ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' :
                    'bg-gray-50 text-gray-300 cursor-not-allowed'
                }`}
            >
              <div className="relative">
                <Icon className="w-5 h-5" />
                {isCompleted && (
                  <Check className="w-3 h-3 absolute -top-1 -right-1 bg-green-500 text-white rounded-full p-0.5" />
                )}
              </div>
              <span className="text-[10px] mt-1 font-medium">{step.label}</span>
            </button>
            {idx < STEPS.length - 1 && (
              <ArrowRight className={`w-4 h-4 ${isCompleted ? 'text-green-500' : 'text-gray-300'}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );

  return (
    <>
      <Card className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-900">Smart Booking</h2>
          <Button variant="ghost" size="sm" onClick={handleReset}>Neu starten</Button>
        </div>

        <StepIndicator />

        {/* Step 1: Message Input */}
        {currentStep === 1 && (
          <div className="space-y-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="font-semibold text-blue-900 mb-2">Schritt 1: Nachricht eingeben</h3>
              <p className="text-sm text-blue-700">Geben Sie eine Buchungsanfrage ein oder verwenden Sie die Beispiel-Nachricht.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="message">Kundenanfrage</Label>
              <Textarea
                id="message"
                value={message}
                onChange={e => setMessage(e.target.value)}
                rows={4}
                className="text-base"
                placeholder="z.B. Wir brauchen 10 Betten in Berlin vom 01.03 bis 15.03..."
              />
            </div>
            <div className="flex justify-end">
              <Button onClick={handleScan} disabled={!message.trim()}>
                Scan & Prüfen <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Scan Results */}
        {currentStep === 2 && parsed && (
          <div className="space-y-4">
            <div className="bg-purple-50 p-4 rounded-lg">
              <h3 className="font-semibold text-purple-900 mb-2">Schritt 2: Daten erkannt</h3>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-white border rounded-lg p-4">
                <h4 className="font-medium mb-3">Erkannte Anfrage</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-gray-500">Betten:</span><span className="font-medium">{parsed.beds ?? '—'}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Zeitraum:</span><span className="font-medium">{parsed.startDate?.toLocaleDateString()} – {parsed.endDate?.toLocaleDateString()}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Standort:</span><span className="font-medium">{parsed.rawLocation ?? '—'}</span></div>
                </div>
                {missing.length > 0 && (
                  <div className="mt-3 p-2 bg-orange-50 border border-orange-200 rounded text-xs text-orange-700">
                    ⚠️ Fehlend: {missing.join(', ')}
                  </div>
                )}
              </div>

              <div className={`border rounded-lg p-4 ${availability?.available ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                <h4 className="font-medium mb-3">Verfügbarkeit</h4>
                {availability ? (
                  <>
                    <div className={`text-lg font-bold ${availability.available ? 'text-green-700' : 'text-red-700'}`}>
                      {availability.available ? '✓ Verfügbar' : '✗ Nicht verfügbar'}
                    </div>
                    {availability.suggestions.length > 0 && (
                      <div className="mt-3 space-y-1">
                        {availability.suggestions.map(s => (
                          <div key={s.roomId} className="text-sm flex justify-between">
                            <span>{getFullRoomName(s.roomId)}</span>
                            <span className="font-medium">{s.availableBeds} Betten</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-gray-500">Daten unvollständig</div>
                )}
              </div>
            </div>

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setCurrentStep(1)}>
                <ArrowLeft className="mr-2 w-4 h-4" /> Zurück
              </Button>
              <Button onClick={() => setCurrentStep(3)} disabled={!availability?.available}>
                Weiter <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Configuration */}
        {currentStep === 3 && parsed && availability && (
          <div className="space-y-4">
            <div className="bg-orange-50 p-4 rounded-lg">
              <h3 className="font-semibold text-orange-900 mb-2">Schritt 3: Konfigurieren</h3>
              <p className="text-sm text-orange-700">Wählen Sie den Kunden und passen Sie den Preis an.</p>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <Label>Kunde auswählen *</Label>
                <select
                  className="w-full border-gray-300 rounded-md shadow-sm h-10 text-sm"
                  value={selectedCustomerId}
                  onChange={e => setSelectedCustomerId(e.target.value)}
                >
                  <option value="">-- Bitte wählen --</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.company ? `${c.company} (${c.name})` : c.name}</option>
                  ))}
                </select>

                {selectedCustomerId && (
                  <div className="bg-gray-50 p-3 rounded text-sm">
                    <div className="text-xs text-gray-500 mb-1">Rechnungsadresse</div>
                    <div className="whitespace-pre-line">
                      {(() => {
                        const c = customers.find(cust => cust.id === selectedCustomerId);
                        if (!c) return '';
                        return c.company
                          ? `${c.company}\n${c.street}\n${c.zip} ${c.city}`
                          : `${c.name}\n${c.street}\n${c.zip} ${c.city}`;
                      })()}
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <Label>Preis pro Bett/Nacht (€)</Label>
                <Input
                  type="number"
                  value={pricePerBed}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPricePerBed(Number(e.target.value))}
                  className="h-10"
                />

                <div className="bg-blue-50 p-3 rounded">
                  <div className="text-xs text-blue-600 mb-1">Vorschau</div>
                  <div className="text-lg font-bold text-blue-900">
                    {(() => {
                      const nights = parsed.startDate && parsed.endDate
                        ? Math.ceil((parsed.endDate.getTime() - parsed.startDate.getTime()) / (1000 * 60 * 60 * 24))
                        : 0;
                      const beds = availability.suggestions.reduce((acc, s) => acc + s.availableBeds, 0);
                      return (beds * pricePerBed * nights).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
                    })()}
                  </div>
                  <div className="text-xs text-blue-600">
                    {availability.suggestions.reduce((acc, s) => acc + s.availableBeds, 0)} Betten × {Math.ceil((parsed.endDate!.getTime() - parsed.startDate!.getTime()) / (1000 * 60 * 60 * 24))} Nächte × {pricePerBed}€
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setCurrentStep(2)}>
                <ArrowLeft className="mr-2 w-4 h-4" /> Zurück
              </Button>
              <Button onClick={() => setCurrentStep(4)} disabled={!selectedCustomerId}>
                Weiter <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Confirm */}
        {currentStep === 4 && parsed && availability && (
          <div className="space-y-4">
            <div className="bg-green-50 p-4 rounded-lg">
              <h3 className="font-semibold text-green-900 mb-2">Schritt 4: Bestätigen</h3>
              <p className="text-sm text-green-700">Überprüfen Sie die Buchungsdetails und reservieren Sie.</p>
            </div>

            <div className="bg-white border rounded-lg p-4">
              <h4 className="font-semibold mb-4">Buchungsübersicht</h4>
              <table className="w-full text-sm">
                <tbody className="divide-y">
                  <tr><td className="py-2 text-gray-500">Kunde</td><td className="py-2 font-medium text-right">{customers.find(c => c.id === selectedCustomerId)?.company || customers.find(c => c.id === selectedCustomerId)?.name}</td></tr>
                  <tr><td className="py-2 text-gray-500">Standort</td><td className="py-2 font-medium text-right">{availability.locationName}</td></tr>
                  <tr><td className="py-2 text-gray-500">Zeitraum</td><td className="py-2 font-medium text-right">{parsed.startDate?.toLocaleDateString()} – {parsed.endDate?.toLocaleDateString()}</td></tr>
                  <tr><td className="py-2 text-gray-500">Betten</td><td className="py-2 font-medium text-right">{availability.suggestions.reduce((acc, s) => acc + s.availableBeds, 0)}</td></tr>
                  <tr><td className="py-2 text-gray-500">Preis/Bett/Nacht</td><td className="py-2 font-medium text-right">{pricePerBed} €</td></tr>
                  <tr className="bg-blue-50"><td className="py-3 font-semibold">Gesamtbetrag</td><td className="py-3 font-bold text-right text-blue-700">
                    {(() => {
                      const nights = Math.ceil((parsed.endDate!.getTime() - parsed.startDate!.getTime()) / (1000 * 60 * 60 * 24));
                      const beds = availability.suggestions.reduce((acc, s) => acc + s.availableBeds, 0);
                      return (beds * pricePerBed * nights).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
                    })()}
                  </td></tr>
                </tbody>
              </table>
            </div>

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setCurrentStep(3)}>
                <ArrowLeft className="mr-2 w-4 h-4" /> Zurück
              </Button>
              <div className="flex gap-3">
                <Button variant="outline" className="text-red-600 border-red-300 hover:bg-red-50" onClick={() => { setAdminDecision('abgelehnt'); handleReset(); }}>
                  Ablehnen
                </Button>
                <Button className="bg-green-600 hover:bg-green-700" onClick={handleAdminConfirm}>
                  <CheckCircle className="mr-2 w-4 h-4" /> Reservieren
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Step 5: Offer */}
        {currentStep === 5 && adminDecision === 'bestaetigt' && (
          <div className="space-y-4">
            <div className="bg-emerald-50 p-4 rounded-lg">
              <h3 className="font-semibold text-emerald-900 mb-2">Schritt 5: Angebot erstellen</h3>
              <p className="text-sm text-emerald-700">Die Reservierung wurde erstellt. Erstellen Sie jetzt das Angebot.</p>
            </div>

            <div className="bg-white border-2 border-green-200 rounded-lg p-6 text-center">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h4 className="text-xl font-bold text-green-700 mb-2">Reservierung erfolgreich!</h4>
              <p className="text-gray-600 mb-4">Buchungs-ID: {createdBookingId}</p>

              <div className="flex justify-center gap-4">
                <Button onClick={() => setOfferPreviewOpen(true)} disabled={offerSent}>
                  <FileText className="mr-2 w-4 h-4" />
                  {offerSent ? 'Angebot gesendet ✓' : 'Angebot erstellen'}
                </Button>
                {offerSent && !customerAccepted && (
                  <Button variant="outline" onClick={handleCustomerConfirm}>
                    Kunde bestätigt
                  </Button>
                )}
              </div>

              {customerAccepted && (
                <div className="mt-6 p-4 bg-green-100 rounded-lg">
                  <div className="text-2xl font-bold text-green-700">🎉 Buchung bestätigt!</div>
                  <p className="text-green-600">Die Buchung wurde final bestätigt.</p>
                </div>
              )}
            </div>

            <div className="flex justify-start pt-4">
              <Button variant="outline" onClick={handleReset}>
                Neue Buchung starten
              </Button>
            </div>
          </div>
        )}
      </Card>

      {createdBooking && (
        <OfferPreview
          open={offerPreviewOpen}
          onOpenChange={setOfferPreviewOpen}
          booking={bookings.find(b => b.id === createdBookingId) || {
            id: 'mock-id',
            customerName: 'Mock Customer',
            projectName: 'Mock Project',
            locationId: locations[0]?.id || '',
            bedCount: 0,
            startDate: new Date(),
            endDate: new Date(),
            pricePerBedPerNight: 0,
            status: 'reserved'
          }}
          locations={locations}
          companySettings={companySettings}
          onSendOffer={handleOfferSend}
        />
      )}
    </>
  );
};
