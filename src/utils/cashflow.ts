import { Booking } from '../types';
import { eachDayOfInterval, isWithinInterval, startOfWeek, format } from 'date-fns';

export interface DailyCashflow {
  date: Date;
  revenue: number;
  bookings: Booking[];
}

export interface CashflowSummary {
  total: number;
  average: number;
  min: number;
  max: number;
  period: string;
}

/**
 * Berechnet die täglichen Cashflows für einen Zeitraum
 */
export function calculateDailyCashflows(
  bookings: Booking[],
  startDate: Date,
  endDate: Date
): DailyCashflow[] {
  // Validierung: Wenn Startdatum nach Enddatum liegt, gib leeres Array zurück
  if (!startDate || !endDate || startDate > endDate) {
    return [];
  }

  const dates = eachDayOfInterval({ start: startDate, end: endDate });

  return dates.map(date => {
    const activeBookings = bookings.filter(booking =>
      isWithinInterval(date, {
        start: booking.startDate,
        end: booking.endDate
      })
    );

    let dailyRevenue = 0;
    activeBookings.forEach(booking => {
      dailyRevenue += booking.bedCount * booking.pricePerBedPerNight;
    });

    return {
      date,
      revenue: dailyRevenue,
      bookings: activeBookings
    };
  });
}

/**
 * Berechnet Cashflows gruppiert nach Monaten
 */
export function calculateMonthlyCashflows(
  bookings: Booking[],
  startDate: Date,
  endDate: Date
): Map<string, CashflowSummary> {
  const monthlyData = new Map<string, { revenues: number[]; bookings: Booking[] }>();

  // Filtere nur Buchungen, die sich mit dem Zeitraum überschneiden
  const relevantBookings = bookings.filter(booking => {
    return booking.startDate <= endDate && booking.endDate >= startDate;
  });

  relevantBookings.forEach(booking => {
    // Bestimme den tatsächlichen Überlappungszeitraum
    const overlapStart = booking.startDate > startDate ? booking.startDate : startDate;
    const overlapEnd = booking.endDate < endDate ? booking.endDate : endDate;

    // Validierung: Überspringe wenn ungültiger Bereich
    if (overlapStart > overlapEnd) return;

    const bookingDates = eachDayOfInterval({
      start: overlapStart,
      end: overlapEnd
    });

    bookingDates.forEach(date => {
      const monthKey = format(date, 'yyyy-MM');
      if (!monthlyData.has(monthKey)) {
        monthlyData.set(monthKey, { revenues: [], bookings: [] });
      }

      const data = monthlyData.get(monthKey)!;
      const dailyRevenue = booking.bedCount * booking.pricePerBedPerNight;
      data.revenues.push(dailyRevenue);
      if (!data.bookings.find(b => b.id === booking.id)) {
        data.bookings.push(booking);
      }
    });
  });

  const result = new Map<string, CashflowSummary>();
  monthlyData.forEach((data, monthKey) => {
    const total = data.revenues.reduce((sum, rev) => sum + rev, 0);
    const average = data.revenues.length > 0 ? total / data.revenues.length : 0;
    const min = data.revenues.length > 0 ? Math.min(...data.revenues) : 0;
    const max = data.revenues.length > 0 ? Math.max(...data.revenues) : 0;

    result.set(monthKey, {
      total,
      average,
      min,
      max,
      period: monthKey
    });
  });

  return result;
}

/**
 * Berechnet Cashflows gruppiert nach Wochen
 */
export function calculateWeeklyCashflows(
  bookings: Booking[],
  startDate: Date,
  endDate: Date
): Map<string, CashflowSummary> {
  const weeklyData = new Map<string, { revenues: number[]; bookings: Booking[] }>();

  // Filtere nur Buchungen, die sich mit dem Zeitraum überschneiden
  const relevantBookings = bookings.filter(booking => {
    return booking.startDate <= endDate && booking.endDate >= startDate;
  });

  relevantBookings.forEach(booking => {
    // Bestimme den tatsächlichen Überlappungszeitraum
    const overlapStart = booking.startDate > startDate ? booking.startDate : startDate;
    const overlapEnd = booking.endDate < endDate ? booking.endDate : endDate;

    // Validierung: Überspringe wenn ungültiger Bereich
    if (overlapStart > overlapEnd) return;

    const bookingDates = eachDayOfInterval({
      start: overlapStart,
      end: overlapEnd
    });

    bookingDates.forEach(date => {
      const weekStart = startOfWeek(date, { weekStartsOn: 1 });
      const weekKey = format(weekStart, 'yyyy-MM-dd');

      if (!weeklyData.has(weekKey)) {
        weeklyData.set(weekKey, { revenues: [], bookings: [] });
      }

      const data = weeklyData.get(weekKey)!;
      const dailyRevenue = booking.bedCount * booking.pricePerBedPerNight;
      data.revenues.push(dailyRevenue);
      if (!data.bookings.find(b => b.id === booking.id)) {
        data.bookings.push(booking);
      }
    });
  });

  const result = new Map<string, CashflowSummary>();
  weeklyData.forEach((data, weekKey) => {
    const total = data.revenues.reduce((sum, rev) => sum + rev, 0);
    const average = data.revenues.length > 0 ? total / data.revenues.length : 0;
    const min = data.revenues.length > 0 ? Math.min(...data.revenues) : 0;
    const max = data.revenues.length > 0 ? Math.max(...data.revenues) : 0;

    result.set(weekKey, {
      total,
      average,
      min,
      max,
      period: weekKey
    });
  });

  return result;
}

/**
 * Berechnet Gesamtstatistiken für einen Zeitraum
 */
export function calculateCashflowSummary(
  bookings: Booking[],
  startDate: Date,
  endDate: Date
): CashflowSummary {
  const dailyCashflows = calculateDailyCashflows(bookings, startDate, endDate);

  const revenues = dailyCashflows.map(cf => cf.revenue);
  const total = revenues.reduce((sum, rev) => sum + rev, 0);
  const average = revenues.length > 0 ? total / revenues.length : 0;
  const min = revenues.length > 0 ? Math.min(...revenues) : 0;
  const max = revenues.length > 0 ? Math.max(...revenues) : 0;

  return {
    total,
    average,
    min,
    max,
    period: `${format(startDate, 'dd.MM.yyyy')} - ${format(endDate, 'dd.MM.yyyy')}`
  };
}

