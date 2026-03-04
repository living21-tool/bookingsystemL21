import React, { useMemo, useState } from 'react';
import { addDays, format } from 'date-fns';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { Input } from './ui/Input';
import { Label } from './ui/Label';
import { Location, Booking, Customer, CompanySettings } from '../types';
import { checkAvailability, getAvailableBedsForRoom } from '../utils/occupancy';
import { OfferPreview } from './OfferPreview';
import { Search, CheckCircle, FileText, ArrowRight, ArrowLeft, Check, Edit3, UserPlus, X } from 'lucide-react';

type WizardStep = 1 | 2 | 3 | 4;

interface ManualBookingFormProps {
    locations: Location[];
    bookings: Booking[];
    customers?: Customer[];
    companySettings?: CompanySettings;
    onBookingCreated: (booking: Booking) => void;
    onBookingStatusChange: (bookingId: string, status: 'reserved' | 'confirmed') => void;
    onSaveCustomer?: (customer: Customer) => void;
}

const STEPS = [
    { id: 1, label: 'Daten', icon: Edit3 },
    { id: 2, label: 'Verfügbar', icon: Search },
    { id: 3, label: 'Bestätigen', icon: CheckCircle },
    { id: 4, label: 'Angebot', icon: FileText },
] as const;

// Inline Quick Customer Form
interface QuickCustomerFormProps {
    onSave: (customer: Customer) => void;
    onCancel: () => void;
}

const QuickCustomerForm: React.FC<QuickCustomerFormProps> = ({ onSave, onCancel }) => {
    const [formData, setFormData] = useState({
        company: '',
        name: '',
        street: '',
        zip: '',
        city: '',
        email: '',
        phone: ''
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name || !formData.street || !formData.zip || !formData.city) {
            alert('Bitte mindestens Name, Straße, PLZ und Ort ausfüllen.');
            return;
        }

        const newCustomer: Customer = {
            id: Math.random().toString(36).substr(2, 9),
            customerNumber: (Math.floor(10000 + Math.random() * 90000)).toString(),
            name: formData.name,
            company: formData.company || undefined,
            email: formData.email || '',
            phone: formData.phone || undefined,
            street: formData.street,
            zip: formData.zip,
            city: formData.city,
            country: 'Deutschland',
            billingAddress: `${formData.company ? formData.company + '\n' : ''}${formData.name}\n${formData.street}\n${formData.zip} ${formData.city}`
        };

        onSave(newCustomer);
    };

    return (
        <div className="mt-2 p-3 border-2 border-indigo-300 rounded-lg bg-indigo-50/50">
            <div className="flex justify-between items-center mb-3">
                <span className="text-sm font-semibold text-indigo-700 flex items-center gap-1">
                    <UserPlus className="w-4 h-4" /> Schnell-Erfassung
                </span>
                <button type="button" onClick={onCancel} className="text-gray-400 hover:text-gray-600">
                    <X className="w-4 h-4" />
                </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                    <Input
                        placeholder="Firma (optional)"
                        value={formData.company}
                        onChange={e => setFormData(p => ({ ...p, company: e.target.value }))}
                        className="text-sm h-8"
                    />
                    <Input
                        placeholder="Name / Ansprechpartner *"
                        value={formData.name}
                        onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                        className="text-sm h-8"
                        required
                    />
                </div>
                <div className="grid grid-cols-[1fr_80px_1fr] gap-2">
                    <Input
                        placeholder="Straße *"
                        value={formData.street}
                        onChange={e => setFormData(p => ({ ...p, street: e.target.value }))}
                        className="text-sm h-8"
                        required
                    />
                    <Input
                        placeholder="PLZ *"
                        value={formData.zip}
                        onChange={e => setFormData(p => ({ ...p, zip: e.target.value }))}
                        className="text-sm h-8"
                        required
                    />
                    <Input
                        placeholder="Ort *"
                        value={formData.city}
                        onChange={e => setFormData(p => ({ ...p, city: e.target.value }))}
                        className="text-sm h-8"
                        required
                    />
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <Input
                        placeholder="E-Mail"
                        type="email"
                        value={formData.email}
                        onChange={e => setFormData(p => ({ ...p, email: e.target.value }))}
                        className="text-sm h-8"
                    />
                    <Input
                        placeholder="Telefon"
                        value={formData.phone}
                        onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))}
                        className="text-sm h-8"
                    />
                </div>
                <div className="flex justify-end gap-2 pt-1">
                    <Button type="button" variant="ghost" size="sm" onClick={onCancel}>Abbrechen</Button>
                    <Button type="submit" size="sm">Anlegen & Auswählen</Button>
                </div>
            </form>
        </div>
    );
};

// Room Assignment type for manual selection
interface RoomAssignmentEntry {
    roomId: string;
    roomName: string;
    propertyName: string;
    capacity: number;
    availableBeds: number;
    selectedBeds: number;
    selected: boolean;
}

export const ManualBookingForm: React.FC<ManualBookingFormProps> = ({
    locations,
    bookings,
    customers = [],
    companySettings,
    onBookingCreated,
    onBookingStatusChange,
    onSaveCustomer,
}) => {
    const [currentStep, setCurrentStep] = useState<WizardStep>(1);
    const [isExpanded, setIsExpanded] = useState(false);

    // Form data
    const [selectedLocationId, setSelectedLocationId] = useState<string>('');
    const [bedCount, setBedCount] = useState<number>(2);
    const [startDate, setStartDate] = useState<string>(format(addDays(new Date(), 7), 'yyyy-MM-dd'));
    const [endDate, setEndDate] = useState<string>(format(addDays(new Date(), 14), 'yyyy-MM-dd'));
    const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
    const [pricePerBed, setPricePerBed] = useState(25);
    const [projectName, setProjectName] = useState('');

    // Inline customer form state
    const [showNewCustomerForm, setShowNewCustomerForm] = useState(false);

    // Manual room selection state
    const [useManualSelection, setUseManualSelection] = useState(false);
    const [manualRoomAssignments, setManualRoomAssignments] = useState<RoomAssignmentEntry[]>([]);

    // Booking state
    const [createdBookingId, setCreatedBookingId] = useState<string | null>(null);
    const [offerPreviewOpen, setOfferPreviewOpen] = useState(false);
    const [offerSent, setOfferSent] = useState(false);
    const [customerAccepted, setCustomerAccepted] = useState(false);

    const parsedStartDate = startDate ? new Date(startDate) : null;
    const parsedEndDate = endDate ? new Date(endDate) : null;

    // Get all rooms for selected location with availability
    const locationRooms = useMemo(() => {
        if (!selectedLocationId || !parsedStartDate || !parsedEndDate) return [];
        const location = locations.find(l => l.id === selectedLocationId);
        if (!location) return [];

        const rooms: RoomAssignmentEntry[] = [];
        for (const property of location.properties) {
            for (const room of property.rooms) {
                const available = getAvailableBedsForRoom(room, parsedStartDate, parsedEndDate, bookings);
                rooms.push({
                    roomId: room.id,
                    roomName: room.name,
                    propertyName: property.name,
                    capacity: room.capacity,
                    availableBeds: available,
                    selectedBeds: 0,
                    selected: false
                });
            }
        }
        return rooms;
    }, [locations, selectedLocationId, parsedStartDate, parsedEndDate, bookings]);

    const availability = useMemo(() => {
        if (!bedCount || !parsedStartDate || !parsedEndDate || !selectedLocationId) return null;
        const location = locations.find(l => l.id === selectedLocationId);
        if (!location) return null;
        const allRooms = location.properties.flatMap(p => p.rooms);
        const result = checkAvailability(allRooms, bedCount, parsedStartDate, parsedEndDate, bookings);
        return { ...result, locationName: location.name };
    }, [bookings, locations, bedCount, parsedStartDate, parsedEndDate, selectedLocationId]);

    // Initialize manual room assignments when entering step 2
    const initManualAssignments = () => {
        if (availability && availability.suggestions.length > 0) {
            // Pre-select based on smart suggestion
            const updated = locationRooms.map(room => {
                const suggestion = availability.suggestions.find(s => s.roomId === room.roomId);
                return {
                    ...room,
                    selected: !!suggestion,
                    selectedBeds: suggestion ? suggestion.availableBeds : 0
                };
            });
            setManualRoomAssignments(updated);
        } else {
            setManualRoomAssignments(locationRooms.map(r => ({ ...r, selected: false, selectedBeds: 0 })));
        }
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

    const handleCheckAvailability = () => {
        if (availability) {
            initManualAssignments();
            setCurrentStep(2);
        }
    };

    const handleNewCustomerSave = (customer: Customer) => {
        if (onSaveCustomer) {
            onSaveCustomer(customer);
        }
        setSelectedCustomerId(customer.id);
        setShowNewCustomerForm(false);
    };

    // Calculate total selected beds in manual mode
    const totalSelectedBeds = useMemo(() => {
        return manualRoomAssignments.reduce((sum, r) => sum + (r.selected ? r.selectedBeds : 0), 0);
    }, [manualRoomAssignments]);

    const handleRoomToggle = (roomId: string) => {
        setManualRoomAssignments(prev => prev.map(r => {
            if (r.roomId === roomId) {
                const newSelected = !r.selected;
                return {
                    ...r,
                    selected: newSelected,
                    selectedBeds: newSelected ? Math.min(r.availableBeds, bedCount - totalSelectedBeds + (r.selected ? r.selectedBeds : 0)) : 0
                };
            }
            return r;
        }));
    };

    const handleBedsChange = (roomId: string, beds: number) => {
        setManualRoomAssignments(prev => prev.map(r => {
            if (r.roomId === roomId) {
                return {
                    ...r,
                    selectedBeds: Math.max(0, Math.min(beds, r.availableBeds)),
                    selected: beds > 0
                };
            }
            return r;
        }));
    };

    const handleConfirmBooking = () => {
        if (!availability || !selectedCustomerId || !parsedStartDate || !parsedEndDate) return;

        const selectedCustomer = customers.find(c => c.id === selectedCustomerId);

        // Determine which room assignments to use
        let finalAssignments: { roomId: string; beds: number }[];
        if (useManualSelection) {
            finalAssignments = manualRoomAssignments
                .filter(r => r.selected && r.selectedBeds > 0)
                .map(r => ({ roomId: r.roomId, beds: r.selectedBeds }));
        } else {
            finalAssignments = availability.suggestions.map(s => ({ roomId: s.roomId, beds: s.availableBeds }));
        }

        const totalBeds = finalAssignments.reduce((sum, a) => sum + a.beds, 0);

        const newBooking: Booking = {
            id: Math.random().toString(36).substr(2, 9),
            propertyId: 'manual-prop',
            roomId: 'manual-room',
            startDate: parsedStartDate,
            endDate: parsedEndDate,
            locationId: selectedLocationId,
            status: 'reserved',
            companyName: selectedCustomer?.company || '',
            projectName: projectName || 'Manuelle Buchung',
            customerName: selectedCustomer ? (selectedCustomer.company || selectedCustomer.name) : 'Unbekannt',
            bedCount: totalBeds,
            assignedRooms: finalAssignments.map(a => a.roomId),
            roomAssignments: finalAssignments,
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
        setCurrentStep(4);
    };

    const handleOfferSend = () => {
        setOfferSent(true);
        setOfferPreviewOpen(false);
    };

    const handleCustomerConfirm = () => {
        setCustomerAccepted(true);
        if (createdBookingId) {
            onBookingStatusChange(createdBookingId, 'confirmed');
        }
    };

    const handleReset = () => {
        setCurrentStep(1);
        setSelectedLocationId('');
        setBedCount(2);
        setStartDate(format(addDays(new Date(), 7), 'yyyy-MM-dd'));
        setEndDate(format(addDays(new Date(), 14), 'yyyy-MM-dd'));
        setSelectedCustomerId('');
        setPricePerBed(25);
        setProjectName('');
        setCreatedBookingId(null);
        setOfferSent(false);
        setCustomerAccepted(false);
        setShowNewCustomerForm(false);
        setUseManualSelection(false);
        setManualRoomAssignments([]);
    };

    const canProceed = () => {
        switch (currentStep) {
            case 1: return selectedLocationId && bedCount > 0 && startDate && endDate && selectedCustomerId;
            case 2: {
                if (useManualSelection) {
                    return totalSelectedBeds > 0;
                }
                return availability?.available;
            }
            case 3: return true;
            default: return true;
        }
    };

    const nights = parsedStartDate && parsedEndDate
        ? Math.ceil((parsedEndDate.getTime() - parsedStartDate.getTime()) / (1000 * 60 * 60 * 24))
        : 0;

    const createdBooking = createdBookingId ? bookings.find(b => b.id === createdBookingId) : null;

    const StepIndicator = () => (
        <div className="flex items-center justify-center gap-1 mb-4">
            {STEPS.map((step, idx) => {
                const Icon = step.icon;
                const isActive = currentStep === step.id;
                const isCompleted = currentStep > step.id;

                return (
                    <React.Fragment key={step.id}>
                        <div className={`flex flex-col items-center p-1.5 rounded-lg ${isActive ? 'bg-indigo-600 text-white' :
                            isCompleted ? 'bg-green-100 text-green-700' :
                                'bg-gray-100 text-gray-400'
                            }`}>
                            <div className="relative">
                                <Icon className="w-4 h-4" />
                                {isCompleted && <Check className="w-2.5 h-2.5 absolute -top-1 -right-1 bg-green-500 text-white rounded-full p-0.5" />}
                            </div>
                            <span className="text-[9px] mt-0.5 font-medium">{step.label}</span>
                        </div>
                        {idx < STEPS.length - 1 && (
                            <ArrowRight className={`w-3 h-3 ${isCompleted ? 'text-green-500' : 'text-gray-300'}`} />
                        )}
                    </React.Fragment>
                );
            })}
        </div>
    );

    if (!isExpanded) {
        return (
            <Card className="p-4 mt-4 border-dashed border-2 hover:border-indigo-300 cursor-pointer transition-colors" onClick={() => setIsExpanded(true)}>
                <div className="flex items-center justify-center gap-3 text-gray-500">
                    <Edit3 className="w-5 h-5" />
                    <span className="font-medium">Manuelle Buchung erstellen</span>
                    <ArrowRight className="w-4 h-4" />
                </div>
            </Card>
        );
    }

    return (
        <>
            <Card className="p-4 mt-4 border-indigo-200 bg-indigo-50/30">
                <div className="flex justify-between items-center mb-3">
                    <h3 className="font-semibold text-indigo-900">Manuelle Buchung</h3>
                    <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={handleReset}>Reset</Button>
                        <Button variant="ghost" size="sm" onClick={() => setIsExpanded(false)}>Minimieren</Button>
                    </div>
                </div>

                <StepIndicator />

                {/* Step 1: Data Entry */}
                {currentStep === 1 && (
                    <div className="space-y-4">
                        <div className="grid md:grid-cols-2 gap-4">
                            <div className="space-y-3">
                                <div>
                                    <Label>Standort *</Label>
                                    <select
                                        className="w-full border-gray-300 rounded-md shadow-sm h-9 text-sm mt-1"
                                        value={selectedLocationId}
                                        onChange={e => setSelectedLocationId(e.target.value)}
                                    >
                                        <option value="">-- Standort wählen --</option>
                                        {locations.map(loc => (
                                            <option key={loc.id} value={loc.id}>{loc.name}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Customer Selection with Inline Create */}
                                <div>
                                    <Label>Kunde *</Label>
                                    <div className="flex gap-2 mt-1">
                                        <select
                                            className="flex-1 border-gray-300 rounded-md shadow-sm h-9 text-sm"
                                            value={selectedCustomerId}
                                            onChange={e => setSelectedCustomerId(e.target.value)}
                                            disabled={showNewCustomerForm}
                                        >
                                            <option value="">-- Kunde wählen --</option>
                                            {customers.map(c => (
                                                <option key={c.id} value={c.id}>{c.company ? `${c.company}` : c.name}</option>
                                            ))}
                                        </select>
                                        <Button
                                            type="button"
                                            variant={showNewCustomerForm ? "outline" : "default"}
                                            size="sm"
                                            onClick={() => setShowNewCustomerForm(!showNewCustomerForm)}
                                            className="whitespace-nowrap"
                                        >
                                            <UserPlus className="w-4 h-4 mr-1" />
                                            {showNewCustomerForm ? 'Abbrechen' : '+ Neu'}
                                        </Button>
                                    </div>

                                    {showNewCustomerForm && (
                                        <QuickCustomerForm
                                            onSave={handleNewCustomerSave}
                                            onCancel={() => setShowNewCustomerForm(false)}
                                        />
                                    )}
                                </div>

                                <div>
                                    <Label>Projektname</Label>
                                    <Input value={projectName} onChange={e => setProjectName(e.target.value)} placeholder="z.B. Bauprojekt XY" className="mt-1" />
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <Label>Von *</Label>
                                        <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="mt-1" />
                                    </div>
                                    <div>
                                        <Label>Bis *</Label>
                                        <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="mt-1" />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <Label>Betten *</Label>
                                        <Input type="number" min={1} value={bedCount} onChange={e => setBedCount(parseInt(e.target.value) || 0)} className="mt-1" />
                                    </div>
                                    <div>
                                        <Label>€/Bett/Nacht</Label>
                                        <Input type="number" min={0} step={0.5} value={pricePerBed} onChange={e => setPricePerBed(parseFloat(e.target.value) || 0)} className="mt-1" />
                                    </div>
                                </div>
                                {nights > 0 && bedCount > 0 && (
                                    <div className="bg-indigo-100 p-2 rounded text-sm text-indigo-800">
                                        <strong>{bedCount} Betten × {nights} Nächte × {pricePerBed}€ = {(bedCount * nights * pricePerBed).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</strong>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex justify-end pt-2">
                            <Button onClick={handleCheckAvailability} disabled={!canProceed()}>
                                Verfügbarkeit prüfen <ArrowRight className="ml-2 w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                )}

                {/* Step 2: Availability with Manual Room Selection */}
                {currentStep === 2 && availability && (
                    <div className="space-y-4">
                        <div className={`p-4 rounded-lg ${availability.available ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'}`}>
                            <div className={`text-lg font-bold ${availability.available ? 'text-green-700' : 'text-yellow-700'}`}>
                                {availability.available ? '✓ Verfügbar' : '⚠ Eingeschränkt verfügbar'}
                            </div>
                            <div className="text-sm text-gray-600 mt-1">
                                {availability.locationName} • {bedCount} Betten angefragt • {parsedStartDate?.toLocaleDateString()} – {parsedEndDate?.toLocaleDateString()}
                            </div>
                        </div>

                        {/* Selection Mode Toggle */}
                        <div className="flex items-center gap-4 p-2 bg-gray-100 rounded-lg">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    checked={!useManualSelection}
                                    onChange={() => setUseManualSelection(false)}
                                    className="w-4 h-4 text-indigo-600"
                                />
                                <span className="text-sm font-medium">Smart-Auswahl</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    checked={useManualSelection}
                                    onChange={() => setUseManualSelection(true)}
                                    className="w-4 h-4 text-indigo-600"
                                />
                                <span className="text-sm font-medium">Manuelle WE-Auswahl</span>
                            </label>
                        </div>

                        {/* Smart Selection View */}
                        {!useManualSelection && availability.suggestions.length > 0 && (
                            <div className="space-y-1 border rounded-lg p-3 bg-white">
                                <div className="text-sm font-medium text-gray-700 mb-2">Automatisch vorgeschlagene Zuweisung:</div>
                                {availability.suggestions.map(s => (
                                    <div key={s.roomId} className="text-sm flex justify-between bg-gray-50 p-2 rounded">
                                        <span>{getFullRoomName(s.roomId)}</span>
                                        <span className="font-medium text-indigo-600">{s.availableBeds} Betten</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Manual Selection View */}
                        {useManualSelection && (
                            <div className="space-y-1 border rounded-lg p-3 bg-white max-h-64 overflow-y-auto">
                                <div className="text-sm font-medium text-gray-700 mb-2">Wähle WEs und Betten manuell:</div>
                                {manualRoomAssignments.filter(r => r.availableBeds > 0).map(room => (
                                    <div
                                        key={room.roomId}
                                        className={`flex items-center justify-between p-2 rounded border ${room.selected ? 'border-indigo-300 bg-indigo-50' : 'border-gray-200 bg-gray-50'}`}
                                    >
                                        <label className="flex items-center gap-2 cursor-pointer flex-1">
                                            <input
                                                type="checkbox"
                                                checked={room.selected}
                                                onChange={() => handleRoomToggle(room.roomId)}
                                                className="w-4 h-4 text-indigo-600 rounded"
                                            />
                                            <span className="text-sm">
                                                <span className="font-medium">{room.propertyName}</span>
                                                <span className="text-gray-500 mx-1">/</span>
                                                <span>{room.roomName}</span>
                                            </span>
                                        </label>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-gray-500">{room.availableBeds} frei</span>
                                            <Input
                                                type="number"
                                                min={0}
                                                max={room.availableBeds}
                                                value={room.selectedBeds}
                                                onChange={e => handleBedsChange(room.roomId, parseInt(e.target.value) || 0)}
                                                className="w-16 h-7 text-sm text-center"
                                                disabled={!room.selected}
                                            />
                                        </div>
                                    </div>
                                ))}

                                {/* Summary */}
                                <div className={`mt-3 p-2 rounded text-sm font-medium ${totalSelectedBeds === bedCount ? 'bg-green-100 text-green-700' :
                                    totalSelectedBeds < bedCount ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                                    }`}>
                                    Summe: {totalSelectedBeds} von {bedCount} Betten
                                    {totalSelectedBeds !== bedCount && (
                                        <span className="ml-2">
                                            {totalSelectedBeds < bedCount ? `(${bedCount - totalSelectedBeds} fehlen)` : `(${totalSelectedBeds - bedCount} zu viel)`}
                                        </span>
                                    )}
                                </div>
                            </div>
                        )}

                        <div className="flex justify-between">
                            <Button variant="outline" onClick={() => setCurrentStep(1)}>
                                <ArrowLeft className="mr-2 w-4 h-4" /> Zurück
                            </Button>
                            <Button onClick={() => setCurrentStep(3)} disabled={!canProceed()}>
                                Weiter <ArrowRight className="ml-2 w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                )}

                {/* Step 3: Confirm */}
                {currentStep === 3 && availability && (
                    <div className="space-y-4">
                        <div className="bg-white border rounded-lg p-3">
                            <h4 className="font-semibold mb-2 text-sm">Buchungsübersicht</h4>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                                <div className="text-gray-500">Kunde</div>
                                <div className="font-medium">{customers.find(c => c.id === selectedCustomerId)?.company || customers.find(c => c.id === selectedCustomerId)?.name}</div>
                                <div className="text-gray-500">Standort</div>
                                <div className="font-medium">{availability.locationName}</div>
                                <div className="text-gray-500">Zeitraum</div>
                                <div className="font-medium">{parsedStartDate?.toLocaleDateString()} – {parsedEndDate?.toLocaleDateString()} ({nights} N.)</div>
                                <div className="text-gray-500">Betten</div>
                                <div className="font-medium">
                                    {useManualSelection ? totalSelectedBeds : availability.suggestions.reduce((a, s) => a + s.availableBeds, 0)}
                                </div>
                                <div className="text-gray-500">WE-Zuweisung</div>
                                <div className="font-medium text-xs">
                                    {useManualSelection
                                        ? manualRoomAssignments.filter(r => r.selected).map(r => `${r.roomName} (${r.selectedBeds})`).join(', ')
                                        : availability.suggestions.map(s => getFullRoomName(s.roomId).split(' - ')[1]).join(', ')
                                    }
                                </div>
                                <div className="text-gray-500 font-semibold">Gesamt</div>
                                <div className="font-bold text-indigo-700">
                                    {((useManualSelection ? totalSelectedBeds : availability.suggestions.reduce((a, s) => a + s.availableBeds, 0)) * nights * pricePerBed).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-between">
                            <Button variant="outline" onClick={() => setCurrentStep(2)}>
                                <ArrowLeft className="mr-2 w-4 h-4" /> Zurück
                            </Button>
                            <Button className="bg-green-600 hover:bg-green-700" onClick={handleConfirmBooking}>
                                <CheckCircle className="mr-2 w-4 h-4" /> Reservieren
                            </Button>
                        </div>
                    </div>
                )}

                {/* Step 4: Offer */}
                {currentStep === 4 && (
                    <div className="space-y-4">
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                            <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-2" />
                            <div className="font-bold text-green-700">Reservierung erstellt!</div>
                            <div className="text-sm text-gray-600">ID: {createdBookingId}</div>

                            <div className="flex justify-center gap-3 mt-4">
                                <Button onClick={() => setOfferPreviewOpen(true)} disabled={offerSent} size="sm">
                                    <FileText className="mr-1 w-3 h-3" />
                                    {offerSent ? 'Gesendet ✓' : 'Angebot'}
                                </Button>
                                {offerSent && !customerAccepted && (
                                    <Button variant="outline" size="sm" onClick={handleCustomerConfirm}>Bestätigt</Button>
                                )}
                            </div>

                            {customerAccepted && (
                                <div className="mt-3 p-2 bg-green-100 rounded text-green-700 font-bold">
                                    🎉 Buchung bestätigt!
                                </div>
                            )}
                        </div>

                        <div className="flex justify-start">
                            <Button variant="outline" size="sm" onClick={handleReset}>Neue Buchung</Button>
                        </div>
                    </div>
                )}
            </Card>

            {createdBooking && (
                <OfferPreview
                    open={offerPreviewOpen}
                    onOpenChange={setOfferPreviewOpen}
                    booking={createdBooking}
                    locations={locations}
                    companySettings={companySettings}
                    onSendOffer={handleOfferSend}
                />
            )}
        </>
    );
};
