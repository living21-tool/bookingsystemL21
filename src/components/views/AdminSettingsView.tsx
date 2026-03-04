import React, { useState, useEffect } from 'react';
import { CompanySettings } from '../../types';
import { Card } from '../ui/Card';
import { Label } from '../ui/Label';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Save } from 'lucide-react';

interface AdminSettingsViewProps {
    settings: CompanySettings;
    onSave: (settings: CompanySettings) => void;
}

export const AdminSettingsView: React.FC<AdminSettingsViewProps> = ({ settings, onSave }) => {
    // Local state for form handling
    const [formData, setFormData] = useState<CompanySettings>(settings);
    const [isDirty, setIsDirty] = useState(false);
    const [isSaved, setIsSaved] = useState(false);

    // Update local state when settings prop changes (e.g. initial load)
    useEffect(() => {
        setFormData(settings);
    }, [settings]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        setIsDirty(true);
        setIsSaved(false);
    };

    const handleSave = () => {
        onSave(formData);
        setIsDirty(false);
        setIsSaved(true);
        setTimeout(() => setIsSaved(false), 3000);
    };

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Admin-Einstellungen</h2>
                    <p className="text-gray-500">Unternehmensdaten und Rechnungsdetails verwalten.</p>
                </div>
                <div className="flex items-center gap-4">
                    {isSaved && <span className="text-green-600 font-medium animate-fade-in-out">✓ Gespeichert</span>}
                    <Button
                        onClick={handleSave}
                        disabled={!isDirty}
                        className={isDirty ? "bg-blue-600 hover:bg-blue-700 text-white" : "bg-gray-200 text-gray-400 cursor-not-allowed"}
                    >
                        <Save className="w-4 h-4 mr-2" />
                        Änderungen speichern
                    </Button>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                {/* General Company Info */}
                <Card className="p-6 space-y-4 bg-white shadow-sm border border-gray-200">
                    <h3 className="text-lg font-semibold border-b pb-2 mb-4">Allgemeine Infos</h3>

                    <div className="space-y-2">
                        <Label>Firmenname (Rechnungssteller)</Label>
                        <Input name="name" value={formData.name} onChange={handleChange} placeholder="Muster GmbH" />
                    </div>

                    <div className="space-y-2">
                        <Label>Straße & Hausnummer</Label>
                        <Input name="address" value={formData.address} onChange={handleChange} placeholder="Musterstraße 1" />
                    </div>

                    <div className="space-y-2">
                        <Label>PLZ & Ort</Label>
                        <Input name="zipCity" value={formData.zipCity} onChange={handleChange} placeholder="12345 Musterstadt" />
                    </div>
                </Card>

                {/* Contact Info */}
                <Card className="p-6 space-y-4 bg-white shadow-sm border border-gray-200">
                    <h3 className="text-lg font-semibold border-b pb-2 mb-4">Kontakt</h3>

                    <div className="space-y-2">
                        <Label>Telefon</Label>
                        <Input name="phone" value={formData.phone} onChange={handleChange} placeholder="+49 30 12345678" />
                    </div>

                    <div className="space-y-2">
                        <Label>E-Mail (Rechnungsausgang)</Label>
                        <Input name="email" value={formData.email} onChange={handleChange} placeholder="buchhaltung@firma.de" />
                    </div>

                    <div className="space-y-2">
                        <Label>Webseite</Label>
                        <Input name="website" value={formData.website} onChange={handleChange} placeholder="www.firma.de" />
                    </div>
                </Card>

                {/* Legal Info */}
                <Card className="p-6 space-y-4 bg-white shadow-sm border border-gray-200">
                    <h3 className="text-lg font-semibold border-b pb-2 mb-4">Rechtliches</h3>

                    <div className="space-y-2">
                        <Label>Geschäftsführer</Label>
                        <Input name="ceo" value={formData.ceo} onChange={handleChange} placeholder="Max Mustermann" />
                    </div>

                    <div className="gap-4 flex">
                        <div className="space-y-2 flex-1">
                            <Label>HRB / Handelsregister</Label>
                            <Input name="hrb" value={formData.hrb} onChange={handleChange} placeholder="HRB 12345" />
                        </div>
                        <div className="space-y-2 flex-1">
                            <Label>Amtsgericht</Label>
                            <Input name="court" value={formData.court} onChange={handleChange} placeholder="Amtsgericht Berlin" />
                        </div>
                    </div>

                    <div className="gap-4 flex">
                        <div className="space-y-2 flex-1">
                            <Label>USt-IdNr.</Label>
                            <Input name="vatId" value={formData.vatId} onChange={handleChange} placeholder="DE123456789" />
                        </div>
                        <div className="space-y-2 flex-1">
                            <Label>Steuernummer</Label>
                            <Input name="taxId" value={formData.taxId} onChange={handleChange} placeholder="12/345/67890" />
                        </div>
                    </div>
                </Card>

                {/* Bank Connection */}
                <Card className="p-6 space-y-4 bg-white shadow-sm border border-gray-200">
                    <h3 className="text-lg font-semibold border-b pb-2 mb-4">Bankverbindung</h3>

                    <div className="space-y-2">
                        <Label>Bankname</Label>
                        <Input name="bankName" value={formData.bankName} onChange={handleChange} placeholder="Musterbank" />
                    </div>

                    <div className="space-y-2">
                        <Label>IBAN</Label>
                        <Input name="iban" value={formData.iban} onChange={handleChange} placeholder="DE00 0000 0000 0000 0000 00" />
                    </div>

                    <div className="space-y-2">
                        <Label>BIC</Label>
                        <Input name="bic" value={formData.bic} onChange={handleChange} placeholder="MUSTERDEF1XXX" />
                    </div>
                </Card>
            </div>
        </div>
    );
};
