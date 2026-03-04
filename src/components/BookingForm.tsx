import React, { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Label } from './ui/Label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from './ui/Dialog';
import { Location, Booking, Room } from '../types';
import { checkAvailability } from '../utils/occupancy';
// Simple UUID generator
const generateId = () => `booking-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

interface BookingFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locations: Location[];
  bookings: Booking[];
  onBookingCreated: (booking: Booking) => void;
}

export const BookingForm: React.FC<BookingFormProps> = ({
  open,
  onOpenChange,
  locations,
  bookings,
  onBookingCreated,
}) => {
  const [customerName, setCustomerName] = useState('');
  const [projectName, setProjectName] = useState('');
  const [locationId, setLocationId] = useState('');
  const [bedCount, setBedCount] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [pricePerBedPerNight, setPricePerBedPerNight] = useState('');
  const [suggestions, setSuggestions] = useState<ReturnType<typeof checkAvailability> | null>(null);
  const [selectedRooms, setSelectedRooms] = useState<string[]>([]);

  useEffect(() => {
    if (locationId && bedCount && startDate && endDate) {
      const location = locations.find(l => l.id === locationId);
      if (location) {
        const allRooms: Room[] = [];
        location.properties.forEach(property => {
          allRooms.push(...property.rooms);
        });

        const result = checkAvailability(
          allRooms,
          parseInt(bedCount) || 0,
          new Date(startDate),
          new Date(endDate),
          bookings
        );
        setSuggestions(result);
        setSelectedRooms(result.suggestions.map(s => s.roomId));
      }
    } else {
      setSuggestions(null);
      setSelectedRooms([]);
    }
  }, [locationId, bedCount, startDate, endDate, locations, bookings]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName || !projectName || !locationId || !bedCount || !startDate || !endDate || !pricePerBedPerNight) {
      return;
    }

    const location = locations.find(l => l.id === locationId);
    if (!location) return;

    const property = location.properties.find(p =>
      p.rooms.some(r => selectedRooms.includes(r.id))
    );

    const booking: Booking = {
      id: generateId(),
      customerName,
      projectName,
      locationId,
      propertyId: property?.id,
      bedCount: parseInt(bedCount),
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      assignedRooms: selectedRooms,
      pricePerBedPerNight: parseFloat(pricePerBedPerNight),
      status: 'confirmed',
    };

    onBookingCreated(booking);
    handleReset();
    onOpenChange(false);
  };

  const handleReset = () => {
    setCustomerName('');
    setProjectName('');
    setLocationId('');
    setBedCount('');
    setStartDate('');
    setEndDate('');
    setPricePerBedPerNight('');
    setSuggestions(null);
    setSelectedRooms([]);
  };

  // Berechne Gesamtpreis
  const calculateTotalPrice = (): number => {
    if (!bedCount || !startDate || !endDate || !pricePerBedPerNight) return 0;

    const start = new Date(startDate);
    const end = new Date(endDate);
    const nights = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const beds = parseInt(bedCount) || 0;
    const price = parseFloat(pricePerBedPerNight) || 0;

    return nights * beds * price;
  };

  const getRoomName = (roomId: string): string => {
    for (const location of locations) {
      for (const property of location.properties) {
        const room = property.rooms.find(r => r.id === roomId);
        if (room) return `${property.name} - ${room.name}`;
      }
    }
    return roomId;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Neue Buchung erstellen</DialogTitle>
          <DialogClose onClose={() => onOpenChange(false)} />
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="customerName">Kunde *</Label>
              <Input
                id="customerName"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                required
                placeholder="z.B. Siemens AG"
              />
            </div>
            <div>
              <Label htmlFor="projectName">Projektname *</Label>
              <Input
                id="projectName"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                required
                placeholder="z.B. Siemens Projekt"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="location">Standort *</Label>
            <select
              id="location"
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              className="mt-1 flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              required
            >
              <option value="">Standort auswählen</option>
              {locations.map(loc => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="bedCount">Anzahl Betten *</Label>
              <Input
                id="bedCount"
                type="number"
                min="1"
                value={bedCount}
                onChange={(e) => setBedCount(e.target.value)}
                required
                placeholder="z.B. 10"
              />
            </div>
            <div>
              <Label htmlFor="startDate">Von *</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="endDate">Bis *</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <Label htmlFor="pricePerBedPerNight">Preis pro Bett/Nacht (€) *</Label>
            <Input
              id="pricePerBedPerNight"
              type="number"
              min="0"
              step="0.01"
              value={pricePerBedPerNight}
              onChange={(e) => setPricePerBedPerNight(e.target.value)}
              required
              placeholder="z.B. 45.00"
            />
          </div>

          {bedCount && startDate && endDate && pricePerBedPerNight && (
            <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-700">Gesamtpreis:</span>
                <span className="text-xl font-bold text-blue-700">
                  {calculateTotalPrice().toLocaleString('de-DE', {
                    style: 'currency',
                    currency: 'EUR',
                    minimumFractionDigits: 2,
                  })}
                </span>
              </div>
              <div className="text-xs text-gray-600 mt-1">
                {(() => {
                  const start = new Date(startDate);
                  const end = new Date(endDate);
                  const nights = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
                  return `${parseInt(bedCount) || 0} Betten × ${nights} Nächte × ${parseFloat(pricePerBedPerNight) || 0} €`;
                })()}
              </div>
            </div>
          )}

          {suggestions && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h4 className="font-semibold">Vorgeschlagene Zuweisung:</h4>
                <span
                  className={`rounded-full px-3 py-1 text-sm font-medium ${suggestions.available
                    ? 'bg-green-100 text-green-800'
                    : 'bg-red-100 text-red-800'
                    }`}
                >
                  {suggestions.available ? 'Verfügbar' : 'Nicht vollständig verfügbar'}
                </span>
              </div>

              <div className="space-y-2">
                {suggestions.suggestions.map((suggestion) => (
                  <label
                    key={suggestion.roomId}
                    className="flex items-center space-x-2 rounded border border-gray-300 bg-white p-2 hover:bg-gray-50"
                  >
                    <input
                      type="checkbox"
                      checked={selectedRooms.includes(suggestion.roomId)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedRooms([...selectedRooms, suggestion.roomId]);
                        } else {
                          setSelectedRooms(selectedRooms.filter(id => id !== suggestion.roomId));
                        }
                      }}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <div className="flex-1">
                      <div className="font-medium">{getRoomName(suggestion.roomId)}</div>
                      <div className="text-sm text-gray-500">
                        {suggestion.availableBeds} Betten verfügbar
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Abbrechen
            </Button>
            <Button type="submit">
              <Plus className="mr-2 h-4 w-4" />
              Buchung erstellen
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

