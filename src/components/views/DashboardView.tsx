import React from 'react';
import { Location, Booking, Invoice } from '../../types';
import { CashflowAnalysis } from '../CashflowAnalysis';

interface DashboardViewProps {
    locations: Location[];
    bookings: Booking[];
    invoices?: Invoice[];
}

export const DashboardView: React.FC<DashboardViewProps> = ({ locations, bookings }) => {
    return (
        <div className="space-y-6">
            <CashflowAnalysis bookings={bookings} locations={locations} />
        </div>
    );
};
