import React, { useState } from 'react';
import { Search } from 'lucide-react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Label } from './ui/Label';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Location, Booking, Room } from '../types';
import { checkAvailability } from '../utils/occupancy';

interface AvailabilityCheckProps {
  locations: Location[];
  bookings: Booking[];
  onCheck: (result: ReturnType<typeof checkAvailability>) => void;
}

export const AvailabilityCheck: React.FC<AvailabilityCheckProps> = ({
  locations,
  bookings,
  onCheck,
}) => {
  const [locationId, setLocationId] = useState('');
  const [bedCount, setBedCount] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const handleCheck = () => {
    if (!locationId || !bedCount || !startDate || !endDate) return;

    const location = locations.find(l => l.id === locationId);
    if (!location) return;

    const allRooms: Room[] = [];
    location.properties.forEach(property => {
      allRooms.push(...property.rooms);
    });

    const result = checkAvailability(
      allRooms,
      parseInt(bedCount),
      new Date(startDate),
      new Date(endDate),
      bookings
    );

    onCheck(result);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="h-5 w-5" />
          Verfügbarkeit prüfen
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="location">Standort</Label>
          <select
            id="location"
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
            className="mt-1 flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <option value="">Standort auswählen</option>
            {locations.map(loc => (
              <option key={loc.id} value={loc.id}>
                {loc.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <Label htmlFor="bedCount">Anzahl Betten</Label>
          <Input
            id="bedCount"
            type="number"
            min="1"
            value={bedCount}
            onChange={(e) => setBedCount(e.target.value)}
            placeholder="z.B. 50"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="startDate">Von</Label>
            <Input
              id="startDate"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="endDate">Bis</Label>
            <Input
              id="endDate"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>

        <Button onClick={handleCheck} className="w-full">
          <Search className="mr-2 h-4 w-4" />
          Verfügbarkeit prüfen
        </Button>
      </CardContent>
    </Card>
  );
};

