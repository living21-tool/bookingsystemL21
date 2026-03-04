import React, { useState } from 'react';
import { Location, Property, Room, Booking } from '../../types';
import { Button } from '../ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import {
    Plus, ChevronDown, ChevronRight, Building2, Bed,
    Trash2, ArrowLeft, MapPin, Pencil
} from 'lucide-react';
import { format } from 'date-fns';

interface PortfolioViewProps {
    locations: Location[];
    bookings: Booking[];
    onUpdateLocations: (locations: Location[]) => void;
}

type ViewMode = 'list' | 'location-detail' | 'property-detail' | 'unit-detail' | 'add-location' | 'add-property' | 'add-unit' | 'edit-location' | 'edit-property' | 'edit-unit';

export const PortfolioView: React.FC<PortfolioViewProps> = ({
    locations,
    bookings,
    onUpdateLocations
}) => {
    const [viewMode, setViewMode] = useState<ViewMode>('list');
    const [expandedLocations, setExpandedLocations] = useState<Set<string>>(new Set());
    const [expandedProperties, setExpandedProperties] = useState<Set<string>>(new Set());
    const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
    const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
    const [selectedUnit, setSelectedUnit] = useState<Room | null>(null);

    // Form states
    const [formData, setFormData] = useState({
        name: '',
        street: '',
        zip: '',
        city: '',
        capacity: 0,
        roomCount: 1
    });

    const toggleLocation = (locationId: string) => {
        const newExpanded = new Set(expandedLocations);
        if (newExpanded.has(locationId)) {
            newExpanded.delete(locationId);
        } else {
            newExpanded.add(locationId);
        }
        setExpandedLocations(newExpanded);
    };

    const toggleProperty = (propertyId: string) => {
        const newExpanded = new Set(expandedProperties);
        if (newExpanded.has(propertyId)) {
            newExpanded.delete(propertyId);
        } else {
            newExpanded.add(propertyId);
        }
        setExpandedProperties(newExpanded);
    };

    const getLocationStats = (location: Location) => {
        const totalProperties = location.properties.length;
        const totalUnits = location.properties.reduce((sum, p) => sum + p.rooms.length, 0);
        const totalBeds = location.properties.reduce(
            (sum, p) => sum + p.rooms.reduce((s, r) => s + r.capacity, 0), 0
        );
        return { totalProperties, totalUnits, totalBeds };
    };

    const getPropertyStats = (property: Property) => {
        const totalUnits = property.rooms.length;
        const totalBeds = property.rooms.reduce((sum, r) => sum + r.capacity, 0);
        const totalRooms = property.rooms.reduce((sum, r) => sum + (r.roomCount || 1), 0);
        return { totalUnits, totalBeds, totalRooms };
    };

    const getUnitBookings = (unitId: string) => {
        return bookings.filter(b =>
            b.roomId === unitId ||
            b.assignedRooms?.includes(unitId) ||
            b.roomAssignments?.some(ra => ra.roomId === unitId)
        );
    };

    // CRUD Operations
    const handleAddLocation = () => {
        const newLocation: Location = {
            id: `loc-${Date.now()}`,
            name: formData.name,
            properties: []
        };
        onUpdateLocations([...locations, newLocation]);
        setFormData({ name: '', street: '', zip: '', city: '', capacity: 0, roomCount: 1 });
        setViewMode('list');
    };

    const handleAddProperty = () => {
        if (!selectedLocation) return;
        const newProperty: Property = {
            id: `prop-${Date.now()}`,
            name: formData.name,
            locationId: selectedLocation.id,
            rooms: []
        };
        const updatedLocations = locations.map(loc =>
            loc.id === selectedLocation.id
                ? { ...loc, properties: [...loc.properties, newProperty] }
                : loc
        );
        onUpdateLocations(updatedLocations);
        setFormData({ name: '', street: '', zip: '', city: '', capacity: 0, roomCount: 1 });
        setViewMode('list');
    };

    const handleAddUnit = () => {
        if (!selectedLocation || !selectedProperty) return;
        const newUnit: Room = {
            id: `room-${Date.now()}`,
            name: formData.name,
            propertyId: selectedProperty.id,
            capacity: formData.capacity,
            roomCount: formData.roomCount
        };
        const updatedLocations = locations.map(loc =>
            loc.id === selectedLocation.id
                ? {
                    ...loc,
                    properties: loc.properties.map(prop =>
                        prop.id === selectedProperty.id
                            ? { ...prop, rooms: [...prop.rooms, newUnit] }
                            : prop
                    )
                }
                : loc
        );
        onUpdateLocations(updatedLocations);
        setFormData({ name: '', street: '', zip: '', city: '', capacity: 0, roomCount: 1 });
        setViewMode('list');
    };

    const handleUpdateProperty = () => {
        if (!selectedLocation || !selectedProperty) return;

        const updatedLocations = locations.map(loc =>
            loc.id === selectedLocation.id
                ? {
                    ...loc,
                    properties: loc.properties.map(prop =>
                        prop.id === selectedProperty.id
                            ? {
                                ...prop,
                                name: formData.name,
                                street: formData.street,
                                zip: formData.zip,
                                city: formData.city
                            }
                            : prop
                    )
                }
                : loc
        );
        onUpdateLocations(updatedLocations);
        setFormData({ name: '', street: '', zip: '', city: '', capacity: 0, roomCount: 1 });
        setViewMode('list');
    };

    const handleUpdateUnit = () => {
        if (!selectedLocation || !selectedProperty || !selectedUnit) return;

        const updatedLocations = locations.map(loc =>
            loc.id === selectedLocation.id
                ? {
                    ...loc,
                    properties: loc.properties.map(prop =>
                        prop.id === selectedProperty.id
                            ? {
                                ...prop,
                                rooms: prop.rooms.map(room =>
                                    room.id === selectedUnit.id
                                        ? {
                                            ...room,
                                            name: formData.name,
                                            capacity: formData.capacity,
                                            roomCount: formData.roomCount
                                        }
                                        : room
                                )
                            }
                            : prop
                    )
                }
                : loc
        );
        onUpdateLocations(updatedLocations);
        setFormData({ name: '', street: '', zip: '', city: '', capacity: 0, roomCount: 1 });
        // Return to unit detail instead of list
        setViewMode('unit-detail');
        // Update selectedUnit state locally so the view reflects changes immediately
        setSelectedUnit({
            ...selectedUnit,
            name: formData.name,
            capacity: formData.capacity,
            roomCount: formData.roomCount
        });
    };

    const handleDeleteLocation = (locationId: string) => {
        if (!window.confirm('Standort wirklich löschen? Alle zugehörigen Objekte und Einheiten werden ebenfalls gelöscht.')) return;
        onUpdateLocations(locations.filter(l => l.id !== locationId));
    };

    const handleDeleteProperty = (locationId: string, propertyId: string) => {
        if (!window.confirm('Objekt wirklich löschen? Alle zugehörigen Einheiten werden ebenfalls gelöscht.')) return;
        const updatedLocations = locations.map(loc =>
            loc.id === locationId
                ? { ...loc, properties: loc.properties.filter(p => p.id !== propertyId) }
                : loc
        );
        onUpdateLocations(updatedLocations);
    };

    const handleDeleteUnit = (locationId: string, propertyId: string, unitId: string) => {
        if (!window.confirm('Einheit wirklich löschen?')) return;
        const updatedLocations = locations.map(loc =>
            loc.id === locationId
                ? {
                    ...loc,
                    properties: loc.properties.map(prop =>
                        prop.id === propertyId
                            ? { ...prop, rooms: prop.rooms.filter(r => r.id !== unitId) }
                            : prop
                    )
                }
                : loc
        );
        onUpdateLocations(updatedLocations);
    };

    const renderListView = () => (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Portfolio</h2>
                    <p className="text-gray-500 text-sm mt-1">
                        {locations.length} Standorte • {locations.reduce((s, l) => s + l.properties.length, 0)} Objekte • {locations.reduce((s, l) => s + l.properties.reduce((ps, p) => ps + p.rooms.length, 0), 0)} Einheiten
                    </p>
                </div>
                <Button onClick={() => { setFormData({ name: '', street: '', zip: '', city: '', capacity: 0, roomCount: 1 }); setViewMode('add-location'); }}>
                    <Plus className="w-4 h-4 mr-2" />
                    Neuer Standort
                </Button>
            </div>

            {/* Location Cards */}
            <div className="space-y-3">
                {locations.map(location => {
                    const isExpanded = expandedLocations.has(location.id);
                    const stats = getLocationStats(location);

                    return (
                        <Card key={location.id} className="overflow-hidden">
                            <div
                                className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
                                onClick={() => toggleLocation(location.id)}
                            >
                                <div className="flex items-center gap-3">
                                    {isExpanded ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
                                    <MapPin className="w-5 h-5 text-blue-600" />
                                    <div>
                                        <h3 className="font-semibold text-gray-900">{location.name}</h3>
                                        <p className="text-sm text-gray-500">
                                            {stats.totalProperties} Objekte • {stats.totalUnits} Einheiten • {stats.totalBeds} Betten
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => { setSelectedLocation(location); setFormData({ name: '', street: '', zip: '', city: '', capacity: 0, roomCount: 1 }); setViewMode('add-property'); }}
                                    >
                                        <Plus className="w-4 h-4" />
                                    </Button>
                                    <Button variant="ghost" size="sm" onClick={() => handleDeleteLocation(location.id)}>
                                        <Trash2 className="w-4 h-4 text-red-500" />
                                    </Button>
                                </div>
                            </div>

                            {/* Properties */}
                            {isExpanded && (
                                <div className="border-t bg-gray-50">
                                    {location.properties.length === 0 ? (
                                        <p className="p-4 text-gray-500 text-sm italic">Keine Objekte vorhanden</p>
                                    ) : (
                                        location.properties.map(property => {
                                            const propExpanded = expandedProperties.has(property.id);
                                            const propStats = getPropertyStats(property);

                                            return (
                                                <div key={property.id} className="border-b last:border-b-0">
                                                    <div
                                                        className="flex items-center justify-between p-3 pl-12 cursor-pointer hover:bg-gray-100"
                                                        onClick={() => toggleProperty(property.id)}
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            {propExpanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                                                            <Building2 className="w-4 h-4 text-orange-500" />
                                                            <div>
                                                                <h4 className="font-medium text-gray-800">{property.name}</h4>
                                                                <p className="text-xs text-gray-500">
                                                                    {propStats.totalUnits} Einheiten • {propStats.totalRooms} Zimmer • {propStats.totalBeds} Betten
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => {
                                                                setSelectedLocation(location);
                                                                setSelectedProperty(property);
                                                                setFormData({
                                                                    name: property.name,
                                                                    street: property.street || '',
                                                                    zip: property.zip || '',
                                                                    city: property.city || '',
                                                                    capacity: 0,
                                                                    roomCount: 1
                                                                });
                                                                setViewMode('edit-property');
                                                            }}
                                                        >
                                                            <Pencil className="w-3 h-3 text-gray-500" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => { setSelectedLocation(location); setSelectedProperty(property); setFormData({ name: '', street: '', zip: '', city: '', capacity: 0, roomCount: 1 }); setViewMode('add-unit'); }}
                                                        >
                                                            <Plus className="w-3 h-3" />
                                                        </Button>
                                                        <Button variant="ghost" size="sm" onClick={() => handleDeleteProperty(location.id, property.id)}>
                                                            <Trash2 className="w-3 h-3 text-red-500" />
                                                        </Button>
                                                    </div>
                                                    {/* Units */}
                                                    {propExpanded && (
                                                        <div className="bg-white">
                                                            {property.rooms.length === 0 ? (
                                                                <p className="p-3 pl-20 text-gray-500 text-xs italic">Keine Einheiten vorhanden</p>
                                                            ) : (
                                                                property.rooms.map(unit => (
                                                                    <div
                                                                        key={unit.id}
                                                                        className="flex items-center justify-between p-2 pl-20 border-t hover:bg-blue-50 cursor-pointer"
                                                                        onClick={() => { setSelectedLocation(location); setSelectedProperty(property); setSelectedUnit(unit); setViewMode('unit-detail'); }}
                                                                    >
                                                                        <div className="flex items-center gap-3">
                                                                            <Bed className="w-4 h-4 text-green-600" />
                                                                            <div>
                                                                                <span className="text-sm font-medium text-gray-700">{unit.name}</span>
                                                                                <span className="text-xs text-gray-500 ml-2">
                                                                                    {unit.roomCount || 1} Zi. • {unit.capacity} Betten
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                                                                            <Button variant="ghost" size="sm" onClick={() => handleDeleteUnit(location.id, property.id, unit.id)}>
                                                                                <Trash2 className="w-3 h-3 text-red-500" />
                                                                            </Button>
                                                                        </div>
                                                                    </div>
                                                                ))
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            )
                            }
                        </Card>
                    );
                })}

                {locations.length === 0 && (
                    <Card className="p-8 text-center">
                        <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">Keine Standorte vorhanden</h3>
                        <p className="text-gray-500 mb-4">Fügen Sie Ihren ersten Standort hinzu, um Ihr Portfolio zu verwalten.</p>
                        <Button onClick={() => setViewMode('add-location')}>
                            <Plus className="w-4 h-4 mr-2" />
                            Standort hinzufügen
                        </Button>
                    </Card>
                )}
            </div>
        </div >
    );

    const renderUnitDetail = () => {
        if (!selectedUnit || !selectedProperty || !selectedLocation) return null;
        const unitBookings = getUnitBookings(selectedUnit.id);

        return (
            <div className="space-y-6">
                <Button variant="ghost" onClick={() => setViewMode('list')} className="pl-0">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Zurück zum Portfolio
                </Button>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Unit Info */}
                    <Card className="md:col-span-1">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Bed className="w-5 h-5 text-green-600" />
                                {selectedUnit.name}
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="ml-auto"
                                    onClick={() => {
                                        setFormData({
                                            name: selectedUnit.name,
                                            street: '',
                                            zip: '',
                                            city: '',
                                            capacity: selectedUnit.capacity,
                                            roomCount: selectedUnit.roomCount || 1
                                        });
                                        setViewMode('edit-unit');
                                    }}
                                >
                                    <Pencil className="w-4 h-4" />
                                </Button>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <span className="text-xs text-gray-500 block">Standort</span>
                                <span className="font-medium">{selectedLocation.name}</span>
                            </div>
                            <div>
                                <span className="text-xs text-gray-500 block">Objekt</span>
                                <span className="font-medium">{selectedProperty.name}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <span className="text-xs text-gray-500 block">Zimmer</span>
                                    <span className="text-2xl font-bold text-blue-600">{selectedUnit.roomCount || 1}</span>
                                </div>
                                <div>
                                    <span className="text-xs text-gray-500 block">Betten</span>
                                    <span className="text-2xl font-bold text-green-600">{selectedUnit.capacity}</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Booking History */}
                    <Card className="md:col-span-2">
                        <CardHeader>
                            <CardTitle>Buchungshistorie</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {unitBookings.length === 0 ? (
                                <p className="text-gray-500 italic py-4">Keine Buchungen für diese Einheit gefunden.</p>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="min-w-full text-sm">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-4 py-2 text-left font-medium text-gray-500">Kunde</th>
                                                <th className="px-4 py-2 text-left font-medium text-gray-500">Zeitraum</th>
                                                <th className="px-4 py-2 text-left font-medium text-gray-500">Betten</th>
                                                <th className="px-4 py-2 text-left font-medium text-gray-500">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {unitBookings.map(b => (
                                                <tr key={b.id} className="hover:bg-gray-50">
                                                    <td className="px-4 py-3">{b.customerName}</td>
                                                    <td className="px-4 py-3">
                                                        {format(new Date(b.startDate), 'dd.MM')} - {format(new Date(b.endDate), 'dd.MM.yyyy')}
                                                    </td>
                                                    <td className="px-4 py-3">{b.bedCount}</td>
                                                    <td className="px-4 py-3">
                                                        <span className={`px-2 py-0.5 rounded text-xs ${b.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                                                            b.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                                                                'bg-yellow-100 text-yellow-800'
                                                            }`}>
                                                            {b.status === 'confirmed' ? 'Bestätigt' : b.status === 'cancelled' ? 'Storniert' : 'Reserviert'}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    };

    const renderAddForm = () => {
        const isLocation = viewMode === 'add-location';
        const isProperty = viewMode === 'add-property' || viewMode === 'edit-property';
        const isUnit = viewMode === 'add-unit' || viewMode === 'edit-unit';
        const isEdit = viewMode.startsWith('edit-');

        const title = isEdit
            ? (viewMode === 'edit-location' ? 'Standort bearbeiten' : viewMode === 'edit-property' ? 'Objekt bearbeiten' : 'Einheit bearbeiten')
            : (isLocation ? 'Neuer Standort' : isProperty ? 'Neues Objekt' : 'Neue Einheit');

        const handleSubmit = () => {
            if (viewMode === 'edit-property') handleUpdateProperty();
            else if (viewMode === 'edit-unit') handleUpdateUnit();
            else if (isLocation) handleAddLocation();
            else if (isProperty) handleAddProperty();
            else handleAddUnit();
        };

        return (
            <div className="max-w-xl mx-auto">
                <Button variant="ghost" onClick={() => setViewMode('list')} className="pl-0 mb-4">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Abbrechen
                </Button>

                <Card className="p-6">
                    <h2 className="text-xl font-bold mb-4">{title}</h2>

                    {isProperty && selectedLocation && (
                        <p className="text-sm text-gray-500 mb-4">Standort: <strong>{selectedLocation.name}</strong></p>
                    )}
                    {isUnit && selectedProperty && (
                        <p className="text-sm text-gray-500 mb-4">
                            Standort: <strong>{selectedLocation?.name}</strong> → Objekt: <strong>{selectedProperty.name}</strong>
                        </p>
                    )}

                    <form onSubmit={e => { e.preventDefault(); handleSubmit(); }} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Name *</Label>
                            <Input
                                id="name"
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                placeholder={isLocation ? 'z.B. Berlin' : isProperty ? 'z.B. FST4' : 'z.B. WE1'}
                                required
                            />
                        </div>

                        {isProperty && (
                            <>
                                <div className="space-y-2">
                                    <Label htmlFor="street">Straße & Hausnummer</Label>
                                    <Input
                                        id="street"
                                        value={formData.street}
                                        onChange={e => setFormData({ ...formData, street: e.target.value })}
                                        placeholder="z.B. Musterstraße 123"
                                    />
                                </div>
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="zip">PLZ</Label>
                                        <Input
                                            id="zip"
                                            value={formData.zip}
                                            onChange={e => setFormData({ ...formData, zip: e.target.value })}
                                            placeholder="12345"
                                        />
                                    </div>
                                    <div className="col-span-2 space-y-2">
                                        <Label htmlFor="city">Ort</Label>
                                        <Input
                                            id="city"
                                            value={formData.city}
                                            onChange={e => setFormData({ ...formData, city: e.target.value })}
                                            placeholder="Musterstadt"
                                        />
                                    </div>
                                </div>
                            </>
                        )}

                        {isUnit && (
                            <>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="roomCount">Zimmeranzahl</Label>
                                        <Input
                                            id="roomCount"
                                            type="number"
                                            step="0.5"
                                            min="0.5"
                                            value={formData.roomCount}
                                            onChange={e => setFormData({ ...formData, roomCount: parseFloat(e.target.value) || 1 })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="capacity">Bettenanzahl *</Label>
                                        <Input
                                            id="capacity"
                                            type="number"
                                            min="1"
                                            value={formData.capacity}
                                            onChange={e => setFormData({ ...formData, capacity: parseInt(e.target.value) || 0 })}
                                            required
                                        />
                                    </div>
                                </div>
                            </>
                        )}

                        <div className="flex justify-end gap-3 pt-4 border-t">
                            <Button type="button" variant="outline" onClick={() => {
                                if (viewMode === 'edit-unit') setViewMode('unit-detail');
                                else setViewMode('list');
                            }}>Abbrechen</Button>
                            <Button type="submit">{isEdit ? 'Speichern' : 'Anlegen'}</Button>
                        </div>
                    </form>
                </Card>
            </div>
        );
    };

    return (
        <div className="space-y-6">
            {viewMode === 'list' && renderListView()}
            {viewMode === 'unit-detail' && renderUnitDetail()}
            {/* Show form for all add AND edit modes */}
            {(viewMode.startsWith('add-') || viewMode.startsWith('edit-')) && renderAddForm()}
        </div>
    );
};
