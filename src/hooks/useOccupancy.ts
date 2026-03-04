import { useState, useMemo } from 'react';
import { Location, Booking, Room } from '../types';
import { calculateLocationOccupancy, calculateOccupancyForPeriod } from '../utils/occupancy';
import { startOfMonth, endOfMonth } from 'date-fns';

export function useOccupancy(locations: Location[], bookings: Booking[], currentDate: Date = new Date()) {
  const [selectedDate, setSelectedDate] = useState(currentDate);

  // Flache Liste aller Zimmer
  const allRooms = useMemo(() => {
    const rooms: Room[] = [];
    locations.forEach(location => {
      location.properties.forEach(property => {
        rooms.push(...property.rooms);
      });
    });
    return rooms;
  }, [locations]);

  // Gesamtauslastung für den ausgewählten Tag
  const overallOccupancy = useMemo(() => {
    return calculateLocationOccupancy(allRooms, selectedDate, bookings);
  }, [allRooms, selectedDate, bookings]);

  // Belegungsdaten für den aktuellen Monat
  const monthlyOccupancy = useMemo(() => {
    const monthStart = startOfMonth(selectedDate);
    const monthEnd = endOfMonth(selectedDate);
    return calculateOccupancyForPeriod(allRooms, monthStart, monthEnd, bookings);
  }, [allRooms, selectedDate, bookings]);

  return {
    selectedDate,
    setSelectedDate,
    overallOccupancy,
    monthlyOccupancy,
    allRooms,
  };
}

