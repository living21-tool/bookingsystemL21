import { Booking, Room, OccupancyData, AvailabilityCheck, RoomSuggestion } from '../types';
import { eachDayOfInterval, startOfDay, isBefore, isAfter, isSameDay } from 'date-fns';

/**
 * Prüft ob eine Wohneinheit (Room) an einem bestimmten Tag bereits gebucht ist.
 * WICHTIG: Eine WE ist entweder komplett frei oder komplett belegt - keine Teilbelegung!
 */
export function isRoomBookedOnDate(
  room: Room,
  date: Date,
  bookings: Booking[]
): boolean {
  return bookings.some(booking => {
    // Prüfe ob diese WE in der Buchung verwendet wird
    const isRoomInBooking = booking.roomId === room.id ||
      booking.assignedRooms?.includes(room.id) ||
      booking.roomAssignments?.some(ra => ra.roomId === room.id);

    if (!isRoomInBooking) return false;

    // Prüfe ob das Datum innerhalb des Buchungszeitraums liegt
    // Nutze startOfDay für robusten Vergleich (ignoriere Uhrzeit)
    // WICHTIG: Der Check-out Tag (endDate) gilt NICHT als belegt!
    // Beispiel: Buchung 01.01-02.01 -> nur 01.01 ist belegt, am 02.01 kann neu eingecheckt werden
    const checkDate = startOfDay(date);
    const bookingStart = startOfDay(new Date(booking.startDate));
    const bookingEnd = startOfDay(new Date(booking.endDate));

    // checkDate >= bookingStart UND checkDate < bookingEnd (NICHT <=)
    return (isAfter(checkDate, bookingStart) || isSameDay(checkDate, bookingStart)) &&
      isBefore(checkDate, bookingEnd);
  });
}

/**
 * Gibt die Anzahl verfügbarer Betten für eine WE in einem Zeitraum zurück.
 * Da WEs immer komplett vermietet werden, ist es entweder 0 (belegt) oder capacity (frei).
 */
export function getAvailableBedsForRoom(
  room: Room,
  startDate: Date,
  endDate: Date,
  bookings: Booking[]
): number {
  // Validierung: Wenn Startdatum nach Enddatum liegt, gib volle Kapazität zurück
  if (!startDate || !endDate || startDate > endDate) {
    return room.capacity;
  }

  const activeBookings = bookings.filter(b => b.status !== 'cancelled');
  const dates = eachDayOfInterval({ start: startDate, end: endDate });

  // Die WE muss an JEDEM Tag des Zeitraums frei sein
  const isAvailable = dates.every(date => !isRoomBookedOnDate(room, date, activeBookings));

  return isAvailable ? room.capacity : 0;
}

/**
 * Berechnet die Belegung für ein Zimmer an einem bestimmten Tag
 * NEUE LOGIK: WE ist entweder 100% belegt oder 0% - keine Teilbelegung
 */
export function calculateRoomOccupancy(
  room: Room,
  date: Date,
  bookings: Booking[]
): OccupancyData {
  const activeBookings = bookings.filter(b => b.status !== 'cancelled');
  const isBooked = isRoomBookedOnDate(room, date, activeBookings);

  const activeBookingsForRoom = activeBookings.filter(booking => {
    const isRoomInBooking = booking.roomId === room.id ||
      booking.assignedRooms?.includes(room.id) ||
      booking.roomAssignments?.some(ra => ra.roomId === room.id);
    if (!isRoomInBooking) return false;
    const checkDate = startOfDay(date);
    const bookingStart = startOfDay(new Date(booking.startDate));
    const bookingEnd = startOfDay(new Date(booking.endDate));

    // WICHTIG: Der Check-out Tag (endDate) gilt NICHT als belegt!
    // checkDate >= bookingStart UND checkDate < bookingEnd (NICHT <=)
    return (isAfter(checkDate, bookingStart) || isSameDay(checkDate, bookingStart)) &&
      isBefore(checkDate, bookingEnd);
  });

  return {
    roomId: room.id,
    date,
    occupied: isBooked ? room.capacity : 0,
    available: isBooked ? 0 : room.capacity,
    percentage: isBooked ? 100 : 0,
    bookings: activeBookingsForRoom
  };
}

/**
 * Berechnet die Belegung für alle Zimmer in einem Zeitraum
 */
export function calculateOccupancyForPeriod(
  rooms: Room[],
  startDate: Date,
  endDate: Date,
  bookings: Booking[]
): Map<string, OccupancyData[]> {
  // Validierung: Wenn Startdatum nach Enddatum liegt, gib leere Map zurück
  if (!startDate || !endDate || startDate > endDate) {
    return new Map<string, OccupancyData[]>();
  }

  const dates = eachDayOfInterval({ start: startDate, end: endDate });
  const occupancyMap = new Map<string, OccupancyData[]>();

  rooms.forEach(room => {
    const roomOccupancy: OccupancyData[] = dates.map(date =>
      calculateRoomOccupancy(room, date, bookings)
    );
    occupancyMap.set(room.id, roomOccupancy);
  });

  return occupancyMap;
}

/**
 * NEUE LOGIK: Prüft die Verfügbarkeit für eine Buchungsanfrage
 * 
 * Regeln:
 * 1. Jede WE wird immer KOMPLETT vermietet (keine Teilbelegung)
 * 2. Wenn eine WE gebucht ist, kann sie nicht erneut gebucht werden
 * 3. Finde die EFFIZIENTESTE Kombination von WEs (minimaler Überschuss)
 */
export function checkAvailability(
  rooms: Room[],
  bedsNeeded: number,
  startDate: Date,
  endDate: Date,
  bookings: Booking[]
): AvailabilityCheck {
  // Validierung: Wenn Startdatum nach Enddatum liegt, gib "nicht verfügbar" zurück
  if (!startDate || !endDate || startDate > endDate) {
    return {
      locationId: '',
      bedCount: bedsNeeded,
      startDate,
      endDate,
      available: false,
      suggestions: []
    };
  }

  const activeBookings = bookings.filter(b => b.status !== 'cancelled');
  const dates = eachDayOfInterval({ start: startDate, end: endDate });

  // Schritt 1: Finde alle WEs die im gesamten Zeitraum KOMPLETT frei sind
  const availableRooms: Room[] = rooms.filter(room => {
    // Die WE muss an JEDEM Tag des Zeitraums frei sein
    return dates.every(date => !isRoomBookedOnDate(room, date, activeBookings));
  });

  // Schritt 2: Sortiere nach Kapazität (aufsteigend) für effiziente Zuweisung
  const sortedRooms = [...availableRooms].sort((a, b) => a.capacity - b.capacity);

  // Schritt 3: Finde die optimale Kombination (Subset Sum Problem - greedy approach)
  // Wir suchen die Kombination mit minimalstem Überschuss
  const result = findOptimalRoomCombination(sortedRooms, bedsNeeded);

  // Erstelle Vorschläge
  const suggestions: RoomSuggestion[] = result.selectedRooms.map(room => ({
    roomId: room.id,
    roomName: room.name,
    propertyName: '',
    availableBeds: room.capacity, // Immer die komplette Kapazität!
    dates: dates
  }));

  return {
    locationId: '',
    bedCount: bedsNeeded,
    startDate,
    endDate,
    available: result.totalBeds >= bedsNeeded,
    suggestions
  };
}

/**
 * Findet die optimale Kombination von Wohneinheiten für die benötigte Bettenanzahl.
 * Ziel: Minimaler Überschuss (z.B. wenn 8 Betten gebraucht werden, 
 * bevorzuge H57d(3) + FBS11(5) = 8 statt FST4(14) = 6 Überschuss)
 */
function findOptimalRoomCombination(
  availableRooms: Room[],
  bedsNeeded: number
): { selectedRooms: Room[]; totalBeds: number } {

  // Wenn keine WEs verfügbar sind
  if (availableRooms.length === 0) {
    return { selectedRooms: [], totalBeds: 0 };
  }

  // Sortiere nach Kapazität (absteigend für ersten Durchlauf)
  const roomsByCapacity = [...availableRooms].sort((a, b) => b.capacity - a.capacity);

  // Strategie 1: Greedy - nimm größte WEs zuerst bis genug Betten
  let greedyResult = { selectedRooms: [] as Room[], totalBeds: 0 };
  let remaining = bedsNeeded;

  for (const room of roomsByCapacity) {
    if (remaining <= 0) break;
    greedyResult.selectedRooms.push(room);
    greedyResult.totalBeds += room.capacity;
    remaining -= room.capacity;
  }

  // Strategie 2: Versuche eine effizientere Kombination zu finden
  // Sortiere aufsteigend für "fill-up" Strategie


  // Brute-Force für kleine Anzahl von WEs (bis 15)
  if (availableRooms.length <= 15) {
    const bestCombination = findBestCombination(availableRooms, bedsNeeded);
    if (bestCombination.selectedRooms.length > 0 && bestCombination.totalBeds >= bedsNeeded) {
      // Vergleiche Überschuss
      const greedyExcess = greedyResult.totalBeds - bedsNeeded;
      const bestExcess = bestCombination.totalBeds - bedsNeeded;

      if (bestExcess < greedyExcess || greedyResult.totalBeds < bedsNeeded) {
        return bestCombination;
      }
    }
  }

  // Fallback auf Greedy wenn es funktioniert
  if (greedyResult.totalBeds >= bedsNeeded) {
    return greedyResult;
  }

  // Letzte Option: Alle verfügbaren WEs nehmen
  return {
    selectedRooms: availableRooms,
    totalBeds: availableRooms.reduce((sum, r) => sum + r.capacity, 0)
  };
}

/**
 * Findet die beste Kombination mit minimalem Überschuss durch Ausprobieren aller Kombinationen
 */
function findBestCombination(
  rooms: Room[],
  bedsNeeded: number
): { selectedRooms: Room[]; totalBeds: number } {
  let best = { selectedRooms: [] as Room[], totalBeds: Infinity };

  // Generiere alle möglichen Kombinationen (2^n)
  const numCombinations = Math.pow(2, rooms.length);

  for (let i = 1; i < numCombinations; i++) {
    const combination: Room[] = [];
    let totalBeds = 0;

    for (let j = 0; j < rooms.length; j++) {
      if ((i & (1 << j)) !== 0) {
        combination.push(rooms[j]);
        totalBeds += rooms[j].capacity;
      }
    }

    // Prüfe ob diese Kombination ausreicht
    if (totalBeds >= bedsNeeded) {
      const excess = totalBeds - bedsNeeded;
      const bestExcess = best.totalBeds - bedsNeeded;

      // Bevorzuge Kombination mit weniger Überschuss
      if (excess < bestExcess) {
        best = { selectedRooms: combination, totalBeds };
      }
      // Bei gleichem Überschuss bevorzuge weniger WEs
      else if (excess === bestExcess && combination.length < best.selectedRooms.length) {
        best = { selectedRooms: combination, totalBeds };
      }
    }
  }

  // Falls keine Kombination ausreicht, gib die mit den meisten Betten zurück
  if (best.totalBeds === Infinity) {
    return {
      selectedRooms: rooms,
      totalBeds: rooms.reduce((sum, r) => sum + r.capacity, 0)
    };
  }

  return best;
}

/**
 * Berechnet die Gesamtauslastung für einen Standort
 */
export function calculateLocationOccupancy(
  rooms: Room[],
  date: Date,
  bookings: Booking[]
): { total: number; occupied: number; percentage: number } {
  const total = rooms.reduce((sum, room) => sum + room.capacity, 0);
  let occupied = 0;

  rooms.forEach(room => {
    const occupancy = calculateRoomOccupancy(room, date, bookings);
    occupied += occupancy.occupied;
  });

  const percentage = total > 0 ? (occupied / total) * 100 : 0;

  return { total, occupied, percentage };
}

/**
 * Berechnet die durchschnittliche Belegung für einen Zeitraum (z.B. Woche, Monat)
 */
export function calculateAverageOccupancyForPeriod(
  rooms: Room[],
  startDate: Date,
  endDate: Date,
  bookings: Booking[]
): { averageOccupied: number; averageAvailable: number; averagePercentage: number; totalCapacity: number } {
  const totalCapacity = rooms.reduce((sum, room) => sum + room.capacity, 0);

  // Validierung: Wenn Startdatum nach Enddatum liegt, gib Standardwerte zurück
  if (!startDate || !endDate || startDate > endDate) {
    return {
      averageOccupied: 0,
      averageAvailable: totalCapacity,
      averagePercentage: 0,
      totalCapacity
    };
  }

  const dates = eachDayOfInterval({ start: startDate, end: endDate });

  if (dates.length === 0) {
    return {
      averageOccupied: 0,
      averageAvailable: totalCapacity,
      averagePercentage: 0,
      totalCapacity
    };
  }

  let sumOccupied = 0;

  dates.forEach(date => {
    const dailyOccupancy = calculateLocationOccupancy(rooms, date, bookings);
    sumOccupied += dailyOccupancy.occupied;
  });

  const averageOccupied = sumOccupied / dates.length;
  const averageAvailable = totalCapacity - averageOccupied;
  const averagePercentage = totalCapacity > 0 ? (averageOccupied / totalCapacity) * 100 : 0;

  return {
    averageOccupied, // Kann Dezimalzahl sein
    averageAvailable, // Kann Dezimalzahl sein
    averagePercentage,
    totalCapacity
  };
}
