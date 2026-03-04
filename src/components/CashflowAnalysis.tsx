import React, { useState, useMemo } from 'react';
import { TrendingUp, DollarSign, ChevronLeft, ChevronRight, MapPin, Building2, Home, ChevronDown, Percent, BedDouble } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Booking, Location, Property, Room } from '../types';
import {
  calculateDailyCashflows,
  calculateCashflowSummary,
} from '../utils/cashflow';
import { startOfMonth, endOfMonth, addMonths, subMonths, format, eachDayOfInterval, isWithinInterval } from 'date-fns';
import { de } from 'date-fns/locale';

interface CashflowAnalysisProps {
  bookings: Booking[];
  locations: Location[];
}

type ViewMode = 'daily' | 'monthly';

// Hierarchie-Ebene
type DrillLevel = 'locations' | 'properties' | 'rooms';

interface LocationStat {
  location: Location;
  totalRevenue: number;
  averageBedsOccupied: number;
  averagePricePerBed: number;
  totalBedNights: number;
  totalCapacity: number; // Gesamte Bettenkapazität des Standorts
  occupancyRate: number; // Auslastung in %
}

interface PropertyStat {
  property: Property;
  totalRevenue: number;
  averageBedsOccupied: number;
  averagePricePerBed: number;
  totalBedNights: number;
  totalCapacity: number; // Gesamte Bettenkapazität des Objekts
  occupancyRate: number; // Auslastung in %
}

interface RoomStat {
  room: Room;
  totalRevenue: number;
  occupiedNights: number;
  averagePricePerBed: number;
  capacity: number;
  occupancyRate: number; // Auslastung in %
}

export const CashflowAnalysis: React.FC<CashflowAnalysisProps> = ({ bookings, locations }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('monthly');

  // Drill-Down State
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);

  // Bestimme aktuelle Drill-Level
  const drillLevel: DrillLevel = selectedPropertyId ? 'rooms' : selectedLocationId ? 'properties' : 'locations';

  // Finde ausgewählte Objekte
  const selectedLocation = locations.find(l => l.id === selectedLocationId);
  const selectedProperty = selectedLocation?.properties.find(p => p.id === selectedPropertyId);

  // Erweitere den Zeitraum für bessere Visualisierung (3 Monate) für Daily View
  const viewStart = subMonths(monthStart, 1);
  const viewEnd = addMonths(monthEnd, 1);

  const dailyCashflows = useMemo(() => {
    return calculateDailyCashflows(bookings, viewStart, viewEnd);
  }, [bookings, viewStart, viewEnd]);

  const summary = useMemo(() => {
    return calculateCashflowSummary(bookings, monthStart, monthEnd);
  }, [bookings, monthStart, monthEnd]);

  // Filtere nur den aktuellen Monat für die tägliche Ansicht
  const currentMonthCashflows = useMemo(() => {
    return dailyCashflows.filter(cf =>
      cf.date >= monthStart && cf.date <= monthEnd
    );
  }, [dailyCashflows, monthStart, monthEnd]);

  const maxRevenue = Math.max(...dailyCashflows.map(cf => cf.revenue), 1);

  // --- LOCATION STATS ---
  const locationStats = useMemo((): LocationStat[] => {
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
    const numDaysInMonth = daysInMonth.length;

    return locations.map(location => {
      // Berechne Gesamtkapazität des Standorts (Summe aller Betten in allen Zimmern)
      const totalCapacity = location.properties.reduce((sum, property) => {
        return sum + property.rooms.reduce((roomSum, room) => roomSum + room.capacity, 0);
      }, 0);

      const locationBookings = bookings.filter(b => {
        const matchesLocation = b.locationId === location.id;
        if (!matchesLocation) return false;
        const bookingStart = b.startDate;
        const bookingEnd = b.endDate;
        return (bookingStart <= monthEnd) && (bookingEnd >= monthStart);
      });

      let totalRevenue = 0;
      let totalBedNights = 0;

      locationBookings.forEach(booking => {
        daysInMonth.forEach(day => {
          // Inklusive Zählung: Start- und Enddatum zählen als belegte Bettnächte
          if (isWithinInterval(day, { start: booking.startDate, end: booking.endDate })) {
            const dailyRev = booking.bedCount * booking.pricePerBedPerNight;
            totalRevenue += dailyRev;
            totalBedNights += booking.bedCount;
          }
        });
      });

      const averageBedsOccupied = numDaysInMonth > 0 ? totalBedNights / numDaysInMonth : 0;
      const averagePricePerBed = totalBedNights > 0 ? totalRevenue / totalBedNights : 0;

      // Auslastung = belegte Bett-Nächte / verfügbare Bett-Nächte * 100
      const availableBedNights = totalCapacity * numDaysInMonth;
      const occupancyRate = availableBedNights > 0 ? (totalBedNights / availableBedNights) * 100 : 0;

      return {
        location,
        totalRevenue,
        averageBedsOccupied,
        averagePricePerBed,
        totalBedNights,
        totalCapacity,
        occupancyRate
      };
    }).sort((a, b) => b.totalRevenue - a.totalRevenue);
  }, [bookings, locations, monthStart, monthEnd]);

  // --- GLOBAL STATS FOR ACTIVE LOCATIONS ---
  const globalActiveStats = useMemo(() => {
    const activeStats = locationStats.filter(stat => stat.location.name !== 'NRW-Mülheim');
    const totalBedNights = activeStats.reduce((sum, stat) => sum + stat.totalBedNights, 0);
    const totalRevenue = activeStats.reduce((sum, stat) => sum + stat.totalRevenue, 0);
    const totalCapacity = activeStats.reduce((sum, stat) => sum + stat.totalCapacity, 0);
    const numDays = eachDayOfInterval({ start: monthStart, end: monthEnd }).length;

    const avgPrice = totalBedNights > 0 ? totalRevenue / totalBedNights : 0;
    const totalAvailableBedNights = totalCapacity * numDays;
    const occupancyRate = totalAvailableBedNights > 0 ? (totalBedNights / totalAvailableBedNights) * 100 : 0;

    return {
      totalBedNights,
      avgPrice,
      occupancyRate
    };
  }, [locationStats, monthStart, monthEnd]);

  // --- PROPERTY STATS (wenn Standort ausgewählt) ---
  const propertyStats = useMemo((): PropertyStat[] => {
    if (!selectedLocation) return [];

    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
    const numDaysInMonth = daysInMonth.length;

    return selectedLocation.properties.map(property => {
      // Berechne Gesamtkapazität des Objekts
      const totalCapacity = property.rooms.reduce((sum, room) => sum + room.capacity, 0);

      // Filtere Buchungen für dieses Objekt
      const propertyBookings = bookings.filter(b => {
        // Check if booking is for this property OR if assigned rooms belong to this property
        const matchesProperty = b.propertyId === property.id ||
          b.roomAssignments?.some(ra => property.rooms.some(r => r.id === ra.roomId)) ||
          b.assignedRooms?.some(roomId => property.rooms.some(r => r.id === roomId));

        // Fallback: Check if booking is for parent location and try to match via room
        const matchesLocation = b.locationId === selectedLocation.id;

        if (!matchesProperty && !matchesLocation) return false;

        // For location-level bookings without specific property, distribute to first property
        // This is a simplification - in reality you might need more sophisticated logic
        if (!matchesProperty && matchesLocation && !b.propertyId && !b.roomAssignments?.length) {
          // Only count for first property as fallback
          return property.id === selectedLocation.properties[0]?.id;
        }

        if (!matchesProperty) return false;

        const bookingStart = b.startDate;
        const bookingEnd = b.endDate;
        return (bookingStart <= monthEnd) && (bookingEnd >= monthStart);
      });

      let totalRevenue = 0;
      let totalBedNights = 0;

      propertyBookings.forEach(booking => {
        daysInMonth.forEach(day => {
          if (isWithinInterval(day, { start: booking.startDate, end: booking.endDate })) {
            const dailyRev = booking.bedCount * booking.pricePerBedPerNight;
            totalRevenue += dailyRev;
            totalBedNights += booking.bedCount;
          }
        });
      });

      const averageBedsOccupied = numDaysInMonth > 0 ? totalBedNights / numDaysInMonth : 0;
      const averagePricePerBed = totalBedNights > 0 ? totalRevenue / totalBedNights : 0;

      // Auslastung = belegte Bett-Nächte / verfügbare Bett-Nächte * 100
      const availableBedNights = totalCapacity * numDaysInMonth;
      const occupancyRate = availableBedNights > 0 ? (totalBedNights / availableBedNights) * 100 : 0;

      return {
        property,
        totalRevenue,
        averageBedsOccupied,
        averagePricePerBed,
        totalBedNights,
        totalCapacity,
        occupancyRate
      };
    }).sort((a, b) => b.totalRevenue - a.totalRevenue);
  }, [bookings, selectedLocation, monthStart, monthEnd]);

  // --- ROOM STATS (wenn Objekt ausgewählt) ---
  const roomStats = useMemo((): RoomStat[] => {
    if (!selectedProperty) return [];

    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
    const numDaysInMonth = daysInMonth.length;

    return selectedProperty.rooms.map(room => {
      // Filtere Buchungen für dieses Zimmer
      const roomBookings = bookings.filter(b => {
        const matchesRoom = b.roomId === room.id ||
          b.roomAssignments?.some(ra => ra.roomId === room.id) ||
          b.assignedRooms?.includes(room.id);

        if (!matchesRoom) return false;

        const bookingStart = b.startDate;
        const bookingEnd = b.endDate;
        return (bookingStart <= monthEnd) && (bookingEnd >= monthStart);
      });

      let totalRevenue = 0;
      let totalBedNightsInRoom = 0;

      roomBookings.forEach(booking => {
        daysInMonth.forEach(day => {
          if (isWithinInterval(day, { start: booking.startDate, end: booking.endDate })) {
            // Bei Room-level stats nehmen wir an, dass die Buchung dieses Zimmer nutzt
            const bedsInRoom = booking.roomAssignments?.find(ra => ra.roomId === room.id)?.beds || booking.bedCount;
            const dailyRev = bedsInRoom * booking.pricePerBedPerNight;
            totalRevenue += dailyRev;
            totalBedNightsInRoom += bedsInRoom;
          }
        });
      });

      // Berechne den durchschnittlichen Preis pro Bett (Umsatz geteilt durch belegte Bett-Nächte)
      const averagePricePerBed = totalBedNightsInRoom > 0 ? totalRevenue / totalBedNightsInRoom : 0;

      // Auslastung = belegte Bett-Nächte / verfügbare Bett-Nächte * 100
      const availableBedNights = room.capacity * numDaysInMonth;
      const occupancyRate = availableBedNights > 0 ? (totalBedNightsInRoom / availableBedNights) * 100 : 0;

      return {
        room,
        totalRevenue,
        occupiedNights: totalBedNightsInRoom, // Wir nutzen hier die Bett-Nächte für die Anzeige
        averagePricePerBed,
        capacity: room.capacity,
        occupancyRate
      };
    }).sort((a, b) => b.totalRevenue - a.totalRevenue);
  }, [bookings, selectedProperty, monthStart, monthEnd]);

  const getBarColor = (revenue: number): string => {
    if (revenue === 0) return 'bg-gray-100';
    const percentage = (revenue / maxRevenue) * 100;
    if (percentage < 25) return 'bg-blue-200';
    if (percentage < 50) return 'bg-blue-400';
    if (percentage < 75) return 'bg-blue-600';
    return 'bg-blue-800';
  };

  const formatCurrency = (amount: number): string => {
    return amount.toLocaleString('de-DE', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  };

  // Navigation Handlers
  const handleLocationClick = (locationId: string) => {
    setSelectedLocationId(locationId);
    setSelectedPropertyId(null);
  };

  const handlePropertyClick = (propertyId: string) => {
    setSelectedPropertyId(propertyId);
  };

  const handleBreadcrumbClick = (level: DrillLevel) => {
    if (level === 'locations') {
      setSelectedLocationId(null);
      setSelectedPropertyId(null);
    } else if (level === 'properties') {
      setSelectedPropertyId(null);
    }
  };

  // Breadcrumb Component
  const Breadcrumb = () => (
    <div className="flex items-center gap-2 text-sm mb-4">
      <button
        onClick={() => handleBreadcrumbClick('locations')}
        className={`flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-100 transition-colors ${drillLevel === 'locations' ? 'font-semibold text-blue-600' : 'text-gray-600'
          }`}
      >
        <MapPin className="w-4 h-4" />
        Alle Standorte
      </button>

      {selectedLocation && (
        <>
          <ChevronDown className="w-4 h-4 text-gray-400 rotate-[-90deg]" />
          <button
            onClick={() => handleBreadcrumbClick('properties')}
            className={`flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-100 transition-colors ${drillLevel === 'properties' ? 'font-semibold text-blue-600' : 'text-gray-600'
              }`}
          >
            <Building2 className="w-4 h-4" />
            {selectedLocation.name}
          </button>
        </>
      )}

      {selectedProperty && (
        <>
          <ChevronDown className="w-4 h-4 text-gray-400 rotate-[-90deg]" />
          <span className="flex items-center gap-1 px-2 py-1 font-semibold text-blue-600">
            <Home className="w-4 h-4" />
            {selectedProperty.name}
          </span>
        </>
      )}
    </div>
  );

  // Render Tabellen basierend auf Drill-Level
  const renderMonthlyTable = () => {
    if (drillLevel === 'locations') {
      const totalRevenue = locationStats.reduce((sum, stat) => sum + stat.totalRevenue, 0);
      const totalBedNights = locationStats.reduce((sum, stat) => sum + stat.totalBedNights, 0);
      const totalAvgBedsOccupied = locationStats.reduce((sum, stat) => sum + stat.averageBedsOccupied, 0);
      const totalAvgPrice = totalBedNights > 0 ? totalRevenue / totalBedNights : 0;
      const totalCapacity = locationStats.reduce((sum, stat) => sum + stat.totalCapacity, 0);
      const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd }).length;
      const totalAvailableBedNights = totalCapacity * daysInMonth;
      const totalOccupancyRate = totalAvailableBedNights > 0 ? (totalBedNights / totalAvailableBedNights) * 100 : 0;

      return (
        <div>
          <h3 className="text-lg font-semibold mb-4">
            Einnahmen nach Standorten ({format(currentMonth, 'MMMM yyyy', { locale: de })})
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-700 font-semibold border-b border-gray-200">
                <tr>
                  <th className="p-3 rounded-tl-lg">Standort</th>
                  <th className="p-3 text-right">Auslastung</th>
                  <th className="p-3 text-right">Vermietete Betten</th>
                  <th className="p-3 text-right">Ø Preis/Bett</th>
                  <th className="p-3 text-right rounded-tr-lg">Umsatz</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {locationStats.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-gray-500">
                      Keine Standorte gefunden.
                    </td>
                  </tr>
                ) : (
                  locationStats.map((stat) => (
                    <tr
                      key={stat.location.id}
                      onClick={() => handleLocationClick(stat.location.id)}
                      className="hover:bg-blue-50 transition-colors cursor-pointer group"
                    >
                      <td className="p-3 font-medium text-gray-900 flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-gray-400 group-hover:text-blue-500" />
                        {stat.location.name}
                        <ChevronDown className="w-4 h-4 text-gray-300 group-hover:text-blue-500 rotate-[-90deg] ml-auto" />
                      </td>
                      <td className="p-3 text-right font-medium text-gray-600">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${stat.occupancyRate >= 80 ? 'bg-green-100 text-green-700' :
                          stat.occupancyRate >= 50 ? 'bg-yellow-100 text-yellow-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                          {stat.occupancyRate.toFixed(1)}%
                        </span>
                      </td>
                      <td className="p-3 text-right font-medium text-gray-600">
                        {stat.totalBedNights}
                      </td>
                      <td className="p-3 text-right font-medium text-gray-600">
                        {formatCurrency(stat.averagePricePerBed)}
                      </td>
                      <td className="p-3 text-right font-bold text-blue-700">
                        {formatCurrency(stat.totalRevenue)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot className="bg-gray-100 font-bold border-t-2 border-gray-200">
                <tr>
                  <td className="p-3">Gesamt</td>
                  <td className="p-3 text-right">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${totalOccupancyRate >= 80 ? 'bg-green-100 text-green-700' :
                      totalOccupancyRate >= 50 ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                      {totalOccupancyRate.toFixed(1)}%
                    </span>
                  </td>
                  <td className="p-3 text-right">{totalBedNights}</td>
                  <td className="p-3 text-right">{formatCurrency(totalAvgPrice)}</td>
                  <td className="p-3 text-right text-blue-800">{formatCurrency(totalRevenue)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      );
    }

    if (drillLevel === 'properties') {
      const totalRevenue = propertyStats.reduce((sum, stat) => sum + stat.totalRevenue, 0);
      const totalBedNights = propertyStats.reduce((sum, stat) => sum + stat.totalBedNights, 0);
      const totalAvgBedsOccupied = propertyStats.reduce((sum, stat) => sum + stat.averageBedsOccupied, 0);
      const totalAvgPrice = totalBedNights > 0 ? totalRevenue / totalBedNights : 0;
      const totalCapacity = propertyStats.reduce((sum, stat) => sum + stat.totalCapacity, 0);
      const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd }).length;
      const totalAvailableBedNights = totalCapacity * daysInMonth;
      const totalOccupancyRate = totalAvailableBedNights > 0 ? (totalBedNights / totalAvailableBedNights) * 100 : 0;

      return (
        <div>
          <h3 className="text-lg font-semibold mb-4">
            Objekte in {selectedLocation?.name} ({format(currentMonth, 'MMMM yyyy', { locale: de })})
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-700 font-semibold border-b border-gray-200">
                <tr>
                  <th className="p-3 rounded-tl-lg">Objekt</th>
                  <th className="p-3 text-right">Auslastung</th>
                  <th className="p-3 text-right">Vermietete Betten</th>
                  <th className="p-3 text-right">Ø Preis/Bett</th>
                  <th className="p-3 text-right rounded-tr-lg">Umsatz</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {propertyStats.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-gray-500">
                      Keine Objekte für diesen Standort gefunden.
                    </td>
                  </tr>
                ) : (
                  propertyStats.map((stat) => (
                    <tr
                      key={stat.property.id}
                      onClick={() => handlePropertyClick(stat.property.id)}
                      className="hover:bg-green-50 transition-colors cursor-pointer group"
                    >
                      <td className="p-3 font-medium text-gray-900 flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-gray-400 group-hover:text-green-500" />
                        {stat.property.name}
                        <ChevronDown className="w-4 h-4 text-gray-300 group-hover:text-green-500 rotate-[-90deg] ml-auto" />
                      </td>
                      <td className="p-3 text-right font-medium text-gray-600">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${stat.occupancyRate >= 80 ? 'bg-green-100 text-green-700' :
                          stat.occupancyRate >= 50 ? 'bg-yellow-100 text-yellow-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                          {stat.occupancyRate.toFixed(1)}%
                        </span>
                      </td>
                      <td className="p-3 text-right font-medium text-gray-600">
                        {stat.totalBedNights}
                      </td>
                      <td className="p-3 text-right font-medium text-gray-600">
                        {formatCurrency(stat.averagePricePerBed)}
                      </td>
                      <td className="p-3 text-right font-bold text-green-700">
                        {formatCurrency(stat.totalRevenue)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot className="bg-gray-100 font-bold border-t-2 border-gray-200">
                <tr>
                  <td className="p-3">Gesamt</td>
                  <td className="p-3 text-right">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${totalOccupancyRate >= 80 ? 'bg-green-100 text-green-700' :
                      totalOccupancyRate >= 50 ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                      {totalOccupancyRate.toFixed(1)}%
                    </span>
                  </td>
                  <td className="p-3 text-right">{totalBedNights}</td>
                  <td className="p-3 text-right">{formatCurrency(totalAvgPrice)}</td>
                  <td className="p-3 text-right text-green-800">{formatCurrency(totalRevenue)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      );
    }

    if (drillLevel === 'rooms') {
      const totalRevenue = roomStats.reduce((sum, stat) => sum + stat.totalRevenue, 0);
      const totalBedNightsInContext = roomStats.reduce((sum, stat) => sum + stat.occupiedNights, 0);
      const totalCapacity = roomStats.reduce((sum, stat) => sum + stat.capacity, 0);
      const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd }).length;
      // Durchschnittlicher Preis pro Bett über alle Zimmer
      const avgPrice = totalBedNightsInContext > 0 ? totalRevenue / totalBedNightsInContext : 0;
      // Gesamtauslastung = Summe belegte Bett-Nächte / (Gesamtkapazität * Tage)
      const totalAvailableBedNights = totalCapacity * daysInMonth;
      const totalOccupancyRate = totalAvailableBedNights > 0 ? (totalBedNightsInContext / totalAvailableBedNights) * 100 : 0;

      return (
        <div>
          <h3 className="text-lg font-semibold mb-4">
            Zimmer in {selectedProperty?.name} ({format(currentMonth, 'MMMM yyyy', { locale: de })})
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-700 font-semibold border-b border-gray-200">
                <tr>
                  <th className="p-3 rounded-tl-lg">Zimmer</th>
                  <th className="p-3 text-right">Auslastung</th>
                  <th className="p-3 text-right">Vermietete Betten</th>
                  <th className="p-3 text-right">Ø Preis/Bett</th>
                  <th className="p-3 text-right rounded-tr-lg">Umsatz</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {roomStats.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-gray-500">
                      Keine Zimmer für dieses Objekt gefunden.
                    </td>
                  </tr>
                ) : (
                  roomStats.map((stat) => (
                    <tr
                      key={stat.room.id}
                      className="hover:bg-orange-50 transition-colors"
                    >
                      <td className="p-3 font-medium text-gray-900 flex items-center gap-2">
                        <Home className="w-4 h-4 text-gray-400" />
                        {stat.room.name}
                      </td>
                      <td className="p-3 text-right font-medium text-gray-600">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${stat.occupancyRate >= 80 ? 'bg-green-100 text-green-700' :
                          stat.occupancyRate >= 50 ? 'bg-yellow-100 text-yellow-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                          {stat.occupancyRate.toFixed(1)}%
                        </span>
                      </td>
                      <td className="p-3 text-right font-medium text-gray-600">
                        {stat.occupiedNights}
                      </td>
                      <td className="p-3 text-right font-medium text-gray-600">
                        {formatCurrency(stat.averagePricePerBed)}
                      </td>
                      <td className="p-3 text-right font-bold text-orange-700">
                        {formatCurrency(stat.totalRevenue)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot className="bg-gray-100 font-bold border-t-2 border-gray-200">
                <tr>
                  <td className="p-3">Gesamt</td>
                  <td className="p-3 text-right">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${totalOccupancyRate >= 80 ? 'bg-green-100 text-green-700' :
                      totalOccupancyRate >= 50 ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                      {totalOccupancyRate.toFixed(1)}%
                    </span>
                  </td>
                  <td className="p-3 text-right">{totalBedNightsInContext}</td>
                  <td className="p-3 text-right">{formatCurrency(avgPrice)}</td>
                  <td className="p-3 text-right text-orange-800">{formatCurrency(totalRevenue)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Cashflow-Analyse</CardTitle>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              className="rounded-md p-1 hover:bg-gray-100"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <span className="min-w-[200px] text-center font-semibold">
              {format(currentMonth, 'MMMM yyyy', { locale: de })}
            </span>
            <button
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              className="rounded-md p-1 hover:bg-gray-100"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <button
            onClick={() => setViewMode('daily')}
            className={`px-3 py-1 rounded text-sm font-medium ${viewMode === 'daily'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
          >
            Täglich
          </button>
          <button
            onClick={() => setViewMode('monthly')}
            className={`px-3 py-1 rounded text-sm font-medium ${viewMode === 'monthly'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
          >
            Standorte (Monat)
          </button>
        </div>
      </CardHeader>
      <CardContent>
        {/* KPI-Karten */}
        <div className="grid gap-4 md:grid-cols-4 mb-2">
          <Card className={`${globalActiveStats.occupancyRate >= 80 ? 'bg-green-50 border-green-100' :
              globalActiveStats.occupancyRate >= 50 ? 'bg-yellow-50 border-yellow-100' :
                'bg-red-50 border-red-100'
            }`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 font-medium">Gesamtauslastung</p>
                  <p className={`text-2xl font-bold ${globalActiveStats.occupancyRate >= 80 ? 'text-green-700' :
                    globalActiveStats.occupancyRate >= 50 ? 'text-yellow-700' :
                      'text-red-700'
                    }`}>
                    {globalActiveStats.occupancyRate.toFixed(1)}%
                  </p>
                </div>
                <Percent className={`h-8 w-8 ${globalActiveStats.occupancyRate >= 80 ? 'text-green-600' :
                  globalActiveStats.occupancyRate >= 50 ? 'text-yellow-600' :
                    'text-red-600'
                  }`} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Gesamteinnahmen</p>
                  <p className="text-2xl font-bold">{formatCurrency(summary.total)}</p>
                </div>
                <DollarSign className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Vermietete Betten</p>
                  <p className="text-2xl font-bold">{globalActiveStats.totalBedNights}</p>
                </div>
                <BedDouble className="h-8 w-8 text-orange-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Ø Preis/Bett</p>
                  <p className="text-2xl font-bold">{formatCurrency(globalActiveStats.avgPrice)}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        <p className="text-[10px] text-gray-400 mb-6 italic">
          * NRW-Mülheim ist derzeit nicht in der Gesamtauslastung berücksichtigt.
        </p>

        {/* Visualisierung */}
        {viewMode === 'daily' && (
          <div>
            <h3 className="text-lg font-semibold mb-4">Tägliche Einnahmen</h3>
            <div className="overflow-x-auto">
              <div className="flex items-end gap-1 h-64 min-w-full">
                {currentMonthCashflows.map((cf, index) => (
                  <div
                    key={index}
                    className="flex-1 flex flex-col items-center group relative"
                    title={`${format(cf.date, 'dd.MM.yyyy')}: ${formatCurrency(cf.revenue)}`}
                  >
                    <div
                      className={`w-full rounded-t transition-all hover:opacity-80 ${getBarColor(
                        cf.revenue
                      )}`}
                      style={{
                        height: `${Math.max(5, (cf.revenue / maxRevenue) * 100)}%`,
                        minHeight: cf.revenue > 0 ? '4px' : '0',
                      }}
                    />
                    <span className="text-[9px] text-gray-600 mt-1 transform -rotate-45 origin-top-left whitespace-nowrap">
                      {format(cf.date, 'dd')}
                    </span>
                    {cf.revenue > 0 && (
                      <div className="absolute bottom-full mb-2 hidden group-hover:block bg-gray-900 text-white text-xs rounded px-2 py-1 z-10 whitespace-nowrap">
                        {formatCurrency(cf.revenue)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {viewMode === 'monthly' && (
          <div>
            <Breadcrumb />
            {renderMonthlyTable()}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
