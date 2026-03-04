import React from 'react';
import { Location, Booking, Customer } from '../../types';
import { OccupancyCalendar } from '../OccupancyCalendar';

interface CalendarViewProps {
    locations: Location[];
    bookings: Booking[];
    customers?: Customer[];
    onBookingCreated?: (booking: Booking) => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
    locations,
    bookings,
    customers = [],
    onBookingCreated
}) => {
    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900">Belegungsplan</h2>
            <div className="h-[calc(100vh-200px)]">
                <OccupancyCalendar
                    locations={locations}
                    bookings={bookings}
                    customers={customers}
                    onBookingCreated={onBookingCreated}
                />
            </div>
        </div>
    );
};
