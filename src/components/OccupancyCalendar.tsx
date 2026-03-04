import React, { useState, useMemo, useCallback, memo } from 'react';
import { ChevronLeft, ChevronRight, Plus, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Label } from './ui/Label';
import { Location, Booking, Room, OccupancyData, Customer } from '../types';
import { calculateOccupancyForPeriod } from '../utils/occupancy';
import { eachDayOfInterval, startOfMonth, endOfMonth, format, addMonths, subMonths, addDays } from 'date-fns';
import { de } from 'date-fns/locale';

interface OccupancyCalendarProps {
  locations: Location[];
  bookings: Booking[];
  customers?: Customer[];
  onBookingCreated?: (booking: Booking) => void;
}

interface QuickBookingData {
  roomId: string;
  roomName: string;
  roomCapacity: number;
  locationId: string;
  startDate: Date;
}

// Memoized cell component for better performance
const CalendarCell = memo<{
  roomId: string;
  date: Date;
  dateKey: string;
  occupancy: OccupancyData | null;
  roomCapacity: number;
  canBook: boolean;
  onClick: () => void;
}>(({ date, occupancy, roomCapacity, canBook, onClick }) => {

  const cellColor = useMemo(() => {
    if (!occupancy) return 'bg-white';
    if (occupancy.percentage === 0) return 'bg-green-100';
    const hasConfirmed = occupancy.bookings.some(b => b.status === 'confirmed');
    if (hasConfirmed) {
      if (occupancy.percentage === 100) return 'bg-red-300';
      if (occupancy.percentage >= 50) return 'bg-orange-200';
      return 'bg-yellow-100';
    }
    return 'bg-purple-200';
  }, [occupancy]);

  const cellText = useMemo(() => {
    if (!occupancy) return '';
    if (occupancy.percentage === 0) return '';
    const total = roomCapacity || (occupancy.occupied + occupancy.available);
    if (occupancy.percentage === 100) return `${total}/${total}`;
    return `${occupancy.occupied}/${total}`;
  }, [occupancy, roomCapacity]);

  const tooltip = useMemo(() => {
    const dateStr = format(date, 'dd.MM.yyyy');
    if (!occupancy || occupancy.bookings.length === 0) {
      return `${dateStr}: Klicken zum Buchen`;
    }
    const bookingDetails = occupancy.bookings
      .map(b => {
        const priceInfo = b.pricePerBedPerNight ? ` (${b.pricePerBedPerNight}€/Bett)` : '';
        const statusInfo = b.status === 'reserved' ? ' [RES]' : '';
        return `${b.customerName}${statusInfo}${priceInfo}`;
      })
      .join(', ');
    return `${dateStr}: ${bookingDetails}`;
  }, [date, occupancy]);

  return (
    <div
      className={`relative w-10 flex-shrink-0 border-r border-gray-300 p-0.5 text-center text-[9px] leading-tight ${cellColor} ${canBook ? 'cursor-pointer hover:ring-2 hover:ring-blue-400 hover:z-10' : ''}`}
      onClick={canBook ? onClick : undefined}
      title={tooltip}
    >
      {cellText}
      {canBook && occupancy?.percentage === 0 && (
        <Plus className="w-2 h-2 mx-auto text-gray-400 opacity-0 hover:opacity-100 transition-opacity" />
      )}
    </div>
  );
});

CalendarCell.displayName = 'CalendarCell';

export const OccupancyCalendar: React.FC<OccupancyCalendarProps> = ({
  locations,
  bookings,
  onBookingCreated
}) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [quickBooking, setQuickBooking] = useState<QuickBookingData | null>(null);
  const [bookingForm, setBookingForm] = useState({
    customerName: '',
    projectName: '',
    bedCount: 1,
    nights: 1,
    pricePerBedPerNight: 25
  });

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const dates = useMemo(() => eachDayOfInterval({ start: monthStart, end: monthEnd }), [monthStart, monthEnd]);

  // Erstelle hierarchische Struktur - memoized
  const hierarchy = useMemo(() => {
    const items: Array<{
      type: 'location' | 'property' | 'room';
      id: string;
      name: string;
      parentId?: string;
      room?: Room;
      level: number;
      roomCount?: number;
      locationId?: string;
    }> = [];

    locations.forEach(location => {
      items.push({
        type: 'location',
        id: location.id,
        name: location.name,
        level: 0,
      });

      location.properties.forEach(property => {
        items.push({
          type: 'property',
          id: property.id,
          name: property.name,
          parentId: location.id,
          level: 1,
        });

        property.rooms.forEach(room => {
          items.push({
            type: 'room',
            id: room.id,
            name: room.name,
            parentId: property.id,
            room,
            level: 2,
            roomCount: room.roomCount || 1,
            locationId: location.id
          });
        });
      });
    });

    return items;
  }, [locations]);

  // Pre-compute all occupancy data in a more efficient structure
  const occupancyLookup = useMemo(() => {
    const allRooms: Room[] = [];
    locations.forEach(location => {
      location.properties.forEach(property => {
        allRooms.push(...property.rooms);
      });
    });

    const occupancyMap = calculateOccupancyForPeriod(allRooms, monthStart, monthEnd, bookings);

    // Create a fast lookup: Map<"roomId|dateIndex", OccupancyData>
    const lookup = new Map<string, OccupancyData>();
    occupancyMap.forEach((occList, roomId) => {
      occList.forEach((occ, idx) => {
        lookup.set(`${roomId}|${idx}`, occ);
      });
    });

    return lookup;
  }, [locations, monthStart, monthEnd, bookings]);

  const getOccupancyForCell = useCallback((roomId: string, dateIndex: number): OccupancyData | null => {
    return occupancyLookup.get(`${roomId}|${dateIndex}`) || null;
  }, [occupancyLookup]);

  const formatRoomCount = (count?: number): string => {
    if (!count) return '1';
    return count % 1 === 0 ? count.toString() : count.toFixed(1).replace('.', ',');
  };

  const handleCellClick = useCallback((item: typeof hierarchy[0], date: Date) => {
    if (!item.room || !onBookingCreated) return;

    setQuickBooking({
      roomId: item.id,
      roomName: item.name,
      roomCapacity: item.room.capacity,
      locationId: item.locationId || '',
      startDate: date
    });
    setBookingForm(prev => ({
      ...prev,
      bedCount: Math.min(prev.bedCount, item.room!.capacity)
    }));
  }, [onBookingCreated]);

  const handleCreateBooking = () => {
    if (!quickBooking || !onBookingCreated) return;
    if (!bookingForm.customerName || !bookingForm.projectName) {
      alert('Bitte Kundenname und Projektname eingeben.');
      return;
    }

    const newBooking: Booking = {
      id: `b-${Date.now()}`,
      customerName: bookingForm.customerName,
      projectName: bookingForm.projectName,
      locationId: quickBooking.locationId,
      roomId: quickBooking.roomId,
      bedCount: bookingForm.bedCount,
      startDate: quickBooking.startDate,
      endDate: addDays(quickBooking.startDate, bookingForm.nights),
      assignedRooms: [quickBooking.roomId],
      roomAssignments: [{ roomId: quickBooking.roomId, beds: bookingForm.bedCount }],
      pricePerBedPerNight: bookingForm.pricePerBedPerNight,
      status: 'reserved'
    };

    onBookingCreated(newBooking);
    setQuickBooking(null);
    setBookingForm({
      customerName: '',
      projectName: '',
      bedCount: 1,
      nights: 1,
      pricePerBedPerNight: 25
    });
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Master-Belegungskalender</CardTitle>
            <div className="flex items-center gap-2">
              <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="rounded-md p-1 hover:bg-gray-100">
                <ChevronLeft className="h-5 w-5" />
              </button>
              <span className="min-w-[200px] text-center font-semibold">
                {format(currentMonth, 'MMMM yyyy', { locale: de })}
              </span>
              <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="rounded-md p-1 hover:bg-gray-100">
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <div className="inline-block min-w-full">
              {/* Header */}
              <div className="flex border-b border-gray-300">
                <div className="w-48 flex-shrink-0 border-r border-gray-300 px-2 py-1 text-xs font-semibold">
                  Standort / Objekt / WE
                </div>
                <div className="w-12 flex-shrink-0 border-r border-gray-300 px-1 py-1 text-center text-[9px] font-semibold">Zi.</div>
                <div className="w-12 flex-shrink-0 border-r border-gray-300 px-1 py-1 text-center text-[9px] font-semibold">Betten</div>
                <div className="flex flex-1">
                  {dates.map(date => (
                    <div key={date.toISOString()} className="w-10 flex-shrink-0 border-r border-gray-300 px-0.5 py-1 text-center text-[10px] font-semibold">
                      {format(date, 'dd')}<br /><span className="text-[9px] text-gray-600">{format(date, 'EEE', { locale: de })}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Rows */}
              {hierarchy.map(item => {
                if (item.type === 'room' && !item.room) return null;
                const isRoom = item.type === 'room';
                const paddingLeft = item.level * 16;

                return (
                  <div key={item.id} className={`flex border-b border-gray-200 ${item.type === 'location' ? 'bg-gray-100' : ''} ${item.type === 'property' ? 'bg-gray-50' : ''}`}>
                    <div className="w-48 flex-shrink-0 border-r border-gray-300 px-2 py-1 text-xs" style={{ paddingLeft: `${paddingLeft}px` }}>
                      <span className={item.type === 'location' ? 'font-bold' : item.type === 'property' ? 'font-semibold' : ''}>{item.name}</span>
                    </div>
                    <div className="w-12 flex-shrink-0 border-r border-gray-300 px-1 py-1 text-center text-[9px]">
                      {isRoom ? formatRoomCount(item.roomCount) : ''}
                    </div>
                    <div className="w-12 flex-shrink-0 border-r border-gray-300 px-1 py-1 text-center text-[9px]">
                      {isRoom ? item.room?.capacity || '' : ''}
                    </div>
                    <div className="flex flex-1">
                      {dates.map((date, dateIndex) => {
                        if (!isRoom) {
                          return <div key={date.toISOString()} className="w-10 flex-shrink-0 border-r border-gray-300" />;
                        }
                        const occupancy = getOccupancyForCell(item.id, dateIndex);
                        const canBook = !!onBookingCreated && (!occupancy || occupancy.percentage < 100);

                        return (
                          <CalendarCell
                            key={date.toISOString()}
                            roomId={item.id}
                            date={date}
                            dateKey={date.toISOString()}
                            occupancy={occupancy}
                            roomCapacity={item.room?.capacity || 0}
                            canBook={canBook}
                            onClick={() => handleCellClick(item, date)}
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Legend */}
          <div className="mt-3 flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5"><div className="h-3 w-3 rounded bg-green-100" /><span>Verfügbar</span></div>
            <div className="flex items-center gap-1.5"><div className="h-3 w-3 rounded bg-purple-200" /><span>Reserviert</span></div>
            <div className="flex items-center gap-1.5"><div className="h-3 w-3 rounded bg-yellow-100" /><span>1-49%</span></div>
            <div className="flex items-center gap-1.5"><div className="h-3 w-3 rounded bg-orange-200" /><span>50-99%</span></div>
            <div className="flex items-center gap-1.5"><div className="h-3 w-3 rounded bg-red-300" /><span>Voll</span></div>
            {onBookingCreated && <div className="ml-4 text-blue-600">Klicken zum Buchen</div>}
          </div>
        </CardContent>
      </Card>

      {/* Quick Booking Modal */}
      {quickBooking && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Quick-Buchung</CardTitle>
              <button onClick={() => setQuickBooking(null)} className="p-1 hover:bg-gray-100 rounded">
                <X className="h-5 w-5" />
              </button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-blue-50 p-3 rounded-lg text-sm">
                <div className="font-semibold">{quickBooking.roomName}</div>
                <div className="text-gray-600">
                  Ab {format(quickBooking.startDate, 'dd.MM.yyyy')} • Max. {quickBooking.roomCapacity} Betten
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Kundenname *</Label>
                  <Input
                    value={bookingForm.customerName}
                    onChange={e => setBookingForm({ ...bookingForm, customerName: e.target.value })}
                    placeholder="Firma / Name"
                  />
                </div>
                <div>
                  <Label>Projektname *</Label>
                  <Input
                    value={bookingForm.projectName}
                    onChange={e => setBookingForm({ ...bookingForm, projectName: e.target.value })}
                    placeholder="Projekt"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Betten</Label>
                  <Input
                    type="number"
                    min={1}
                    max={quickBooking.roomCapacity}
                    value={bookingForm.bedCount}
                    onChange={e => setBookingForm({ ...bookingForm, bedCount: Math.min(parseInt(e.target.value) || 1, quickBooking.roomCapacity) })}
                  />
                </div>
                <div>
                  <Label>Nächte</Label>
                  <Input
                    type="number"
                    min={1}
                    value={bookingForm.nights}
                    onChange={e => setBookingForm({ ...bookingForm, nights: parseInt(e.target.value) || 1 })}
                  />
                </div>
                <div>
                  <Label>€/Bett/Nacht</Label>
                  <Input
                    type="number"
                    min={0}
                    step={0.5}
                    value={bookingForm.pricePerBedPerNight}
                    onChange={e => setBookingForm({ ...bookingForm, pricePerBedPerNight: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="text-sm text-gray-600">Voraussichtliche Summe:</div>
                <div className="text-xl font-bold">
                  {(bookingForm.bedCount * bookingForm.nights * bookingForm.pricePerBedPerNight).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setQuickBooking(null)}>Abbrechen</Button>
                <Button onClick={handleCreateBooking}>Reservieren</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
};
