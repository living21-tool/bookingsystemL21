import React from 'react';
import { TrendingUp, Bed, Users, Calendar } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Location, Booking } from '../types';
import { calculateLocationOccupancy } from '../utils/occupancy';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

interface DashboardProps {
  locations: Location[];
  bookings: Booking[];
  selectedDate?: Date;
}

export const Dashboard: React.FC<DashboardProps> = ({
  locations,
  bookings,
  selectedDate = new Date(),
}) => {
  // Berechne Gesamtstatistiken
  const allRooms = locations.flatMap(loc =>
    loc.properties.flatMap(prop => prop.rooms)
  );

  const totalCapacity = allRooms.reduce((sum, room) => sum + room.capacity, 0);
  const occupancy = calculateLocationOccupancy(allRooms, selectedDate, bookings);

  // Heatmap-Daten für die letzten 30 Tage
  const heatmapData = Array.from({ length: 30 }, (_, i) => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() - (29 - i));
    const dayOccupancy = calculateLocationOccupancy(allRooms, date, bookings);
    return {
      date,
      percentage: dayOccupancy.percentage,
    };
  });

  const getHeatmapColor = (percentage: number) => {
    if (percentage === 0) return 'bg-green-100';
    if (percentage < 50) return 'bg-yellow-100';
    if (percentage < 80) return 'bg-orange-200';
    return 'bg-red-300';
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Gesamtkapazität</CardTitle>
            <Bed className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCapacity}</div>
            <p className="text-xs text-gray-500">Betten insgesamt</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Belegt</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{occupancy.occupied}</div>
            <p className="text-xs text-gray-500">
              {format(selectedDate, 'dd.MM.yyyy', { locale: de })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Verfügbar</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{occupancy.total - occupancy.occupied}</div>
            <p className="text-xs text-gray-500">Freie Betten</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Auslastung</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{occupancy.percentage.toFixed(1)}%</div>
            <p className="text-xs text-gray-500">Durchschnitt</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Auslastung der letzten 30 Tage</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-1 h-32">
            {heatmapData.map((item, index) => (
              <div
                key={index}
                className={`flex-1 rounded-t ${getHeatmapColor(item.percentage)}`}
                style={{ height: `${Math.max(10, item.percentage)}%` }}
                title={`${format(item.date, 'dd.MM.yyyy')}: ${item.percentage.toFixed(1)}%`}
              />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

