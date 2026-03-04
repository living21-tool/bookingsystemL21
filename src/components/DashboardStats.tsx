import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Booking, Location } from '../types';
import { calculateAverageOccupancyForPeriod } from '../utils/occupancy';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { de } from 'date-fns/locale';
import { Bed, Users, Percent, Calendar } from 'lucide-react';

interface DashboardStatsProps {
    locations: Location[];
    bookings: Booking[];
}

export const DashboardStats: React.FC<DashboardStatsProps> = ({ locations, bookings }) => {
    const today = new Date();

    // Helper to get all rooms
    const allRooms = useMemo(() =>
        locations.flatMap(loc =>
            loc.properties.flatMap(prop => prop.rooms)
        ),
        [locations]);

    // Calculate statistics for Today
    const todayStats = useMemo(() => {
        return calculateAverageOccupancyForPeriod(allRooms, today, today, bookings);
    }, [allRooms, bookings, today]);

    // Calculate statistics for Current Week
    const weekStats = useMemo(() => {
        const start = startOfWeek(today, { locale: de });
        const end = endOfWeek(today, { locale: de });
        return calculateAverageOccupancyForPeriod(allRooms, start, end, bookings);
    }, [allRooms, bookings, today]);

    // Calculate statistics for Current Month
    const monthStats = useMemo(() => {
        const start = startOfMonth(today);
        const end = endOfMonth(today);
        return calculateAverageOccupancyForPeriod(allRooms, start, end, bookings);
    }, [allRooms, bookings, today]);

    const StatCard = ({ title, value, subtext, icon: Icon, colorClass }: any) => (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
                <Icon className={`h-4 w-4 ${colorClass}`} />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{value}</div>
                <p className="text-xs text-gray-500">{subtext}</p>
            </CardContent>
        </Card>
    );

    return (
        <div className="grid gap-4 md:grid-cols-3">
            {/* Today Column */}
            <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-blue-500" />
                    Heute
                </h3>
                <StatCard
                    title="Belegt"
                    value={todayStats.averageOccupied.toFixed(0)}
                    subtext="Betten belegt"
                    icon={Bed}
                    colorClass="text-blue-500"
                />
                <StatCard
                    title="Verfügbar"
                    value={todayStats.averageAvailable.toFixed(0)}
                    subtext="Betten frei"
                    icon={Users}
                    colorClass="text-green-500"
                />
                <StatCard
                    title="Auslastung"
                    value={`${todayStats.averagePercentage.toFixed(1)}%`}
                    subtext="Tagesaktuell"
                    icon={Percent}
                    colorClass="text-orange-500"
                />
            </div>

            {/* This Week Column */}
            <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-purple-500" />
                    Diese Woche (Ø)
                </h3>
                <StatCard
                    title="Belegt"
                    value={weekStats.averageOccupied.toFixed(1)}
                    subtext="Durchschnitt"
                    icon={Bed}
                    colorClass="text-purple-500"
                />
                <StatCard
                    title="Verfügbar"
                    value={weekStats.averageAvailable.toFixed(1)}
                    subtext="Durchschnitt"
                    icon={Users}
                    colorClass="text-green-500"
                />
                <StatCard
                    title="Auslastung"
                    value={`${weekStats.averagePercentage.toFixed(1)}%`}
                    subtext="Wochenschnitt"
                    icon={Percent}
                    colorClass="text-orange-500"
                />
            </div>

            {/* This Month Column */}
            <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-indigo-500" />
                    Diesen Monat (Ø)
                </h3>
                <StatCard
                    title="Belegt"
                    value={monthStats.averageOccupied.toFixed(1)}
                    subtext="Durchschnitt"
                    icon={Bed}
                    colorClass="text-indigo-500"
                />
                <StatCard
                    title="Verfügbar"
                    value={monthStats.averageAvailable.toFixed(1)}
                    subtext="Durchschnitt"
                    icon={Users}
                    colorClass="text-green-500"
                />
                <StatCard
                    title="Auslastung"
                    value={`${monthStats.averagePercentage.toFixed(1)}%`}
                    subtext="Monatsschnitt"
                    icon={Percent}
                    colorClass="text-orange-500"
                />
            </div>
        </div>
    );
};
