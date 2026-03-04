import React, { useState, useEffect } from 'react';
import { Customer } from '../types';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Label } from './ui/Label';
import { Card } from './ui/Card';

interface CustomerFormProps {
    existingCustomer?: Customer | null;
    onSave: (customer: Customer) => void;
    onCancel: () => void;
}

export const CustomerForm: React.FC<CustomerFormProps> = ({ existingCustomer, onSave, onCancel }) => {
    const [formData, setFormData] = useState<Partial<Customer>>({
        name: '',
        company: '',
        email: '',
        phone: '',
        street: '',
        zip: '',
        city: '',
        country: 'Deutschland',
        management: '',
        contactPerson: '',
        accountingContact: '',
        billingAddress: ''
    });

    useEffect(() => {
        if (existingCustomer) {
            setFormData(existingCustomer);
        } else {
            // New Customer Default State
            setFormData({
                name: '',
                company: '',
                email: '',
                phone: '',
                street: '',
                zip: '',
                city: '',
                country: 'Deutschland',
                management: '',
                contactPerson: '',
                accountingContact: '',
                billingAddress: ''
            });
        }
    }, [existingCustomer]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        // Simple Validation
        if (!formData.name || !formData.street || !formData.zip || !formData.city) {
            alert('Bitte füllen Sie mindestens Name, Straße, PLZ und Ort aus.');
            return;
        }

        // Check for duplicates if it's a new customer or name/company changed
        const checkName = formData.company || formData.name;
        if (!existingCustomer && checkName) {
            // Import db dynamically or assume it's passed? 
            // Better to just assume we can import it since this is a view component file actually
            // But wait, CustomerForm is in components/CustomerForm.tsx, not views.
            // I should import db at the top.
        }

        // Actually, let's do the check.
        // I need to import db first. I will do that in a separate edit.
        // Here is the logic:
        const runCheck = async () => {
            // Dynamic import to avoid cycles if any, though likely fine
            const db = await import('../lib/database');

            // Only check if name/company changed significantly or new
            if (!existingCustomer) {
                const potentialDuplicate = await db.findCustomerByName(checkName!);
                if (potentialDuplicate) {
                    if (!window.confirm(`Ein Kunde mit dem Namen "${potentialDuplicate.company || potentialDuplicate.name}" existiert bereits (Nr. ${potentialDuplicate.customerNumber}). Trotzdem anlegen?`)) {
                        return;
                    }
                }
            }

            const newCustomer: Customer = {
                id: existingCustomer?.id || Math.random().toString(36).substr(2, 9),
                customerNumber: existingCustomer?.customerNumber || (Math.floor(10000 + Math.random() * 90000)).toString(),
                name: formData.name!,
                company: formData.company,
                email: formData.email || '',
                phone: formData.phone,
                street: formData.street!,
                zip: formData.zip!,
                city: formData.city!,
                country: formData.country || 'Deutschland',
                management: formData.management,
                contactPerson: formData.contactPerson,
                accountingContact: formData.accountingContact,
                billingAddress: formData.billingAddress || (
                    `${formData.company ? formData.company + '\n' : ''}${formData.name}\n${formData.street}\n${formData.zip} ${formData.city}${formData.country && formData.country !== 'Deutschland' ? '\n' + formData.country : ''}`
                )
            };

            onSave(newCustomer);
        };
        runCheck();
    };

    return (
        <Card className="p-6 max-w-2xl mx-auto">
            <h2 className="text-xl font-bold mb-4">{existingCustomer ? 'Kunde bearbeiten' : 'Neuen Kunden anlegen'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
                {/* Firma & Name */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="company">Firma (Optional)</Label>
                        <Input id="company" name="company" value={formData.company || ''} onChange={handleChange} placeholder="Muster GmbH" />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="name">Ansprechpartner / Name *</Label>
                        <Input id="name" name="name" value={formData.name || ''} onChange={handleChange} placeholder="Max Mustermann" required />
                    </div>
                </div>

                {/* Geschäftsführung & Buchhaltung */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="management">Geschäftsführung</Label>
                        <Input id="management" name="management" value={formData.management || ''} onChange={handleChange} placeholder="Geschäftsführer Name" />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="contactPerson">Ansprechpartner (Projekt)</Label>
                        <Input id="contactPerson" name="contactPerson" value={formData.contactPerson || ''} onChange={handleChange} placeholder="Projektleiter Name" />
                    </div>
                </div>

                {/* Buchhaltung */}
                <div className="space-y-2">
                    <Label htmlFor="accountingContact">Buchhaltung (E-Mail/Kontakt)</Label>
                    <Input id="accountingContact" name="accountingContact" value={formData.accountingContact || ''} onChange={handleChange} placeholder="buchhaltung@firma.de" />
                </div>

                {/* Kontaktdaten */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input id="email" name="email" type="email" value={formData.email || ''} onChange={handleChange} placeholder="mail@example.com" />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="phone">Telefon</Label>
                        <Input id="phone" name="phone" value={formData.phone || ''} onChange={handleChange} placeholder="+49 ..." />
                    </div>
                </div>

                {/* Anschrift */}
                <div className="space-y-2">
                    <Label>Anschrift *</Label>
                    <div className="grid grid-cols-1 md:grid-cols-[1fr_100px_1fr] gap-2">
                        <Input name="street" value={formData.street || ''} onChange={handleChange} placeholder="Straße Nr." required className="md:col-span-1" />
                        <Input name="zip" value={formData.zip || ''} onChange={handleChange} placeholder="PLZ" required />
                        <Input name="city" value={formData.city || ''} onChange={handleChange} placeholder="Ort" required />
                    </div>
                </div>

                {/* Land */}
                <div className="space-y-2">
                    <Label htmlFor="country">Land</Label>
                    <Input id="country" name="country" value={formData.country || ''} onChange={handleChange} placeholder="Deutschland" />
                </div>

                {/* Rechnungsadresse */}
                <div className="space-y-2">
                    <Label htmlFor="billingAddress">Abweichende Rechnungsadresse (Optional)</Label>
                    <textarea
                        id="billingAddress"
                        name="billingAddress"
                        className="flex min-h-[80px] w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50"
                        value={formData.billingAddress || ''}
                        onChange={handleChange}
                        placeholder="Falls leer, wird die obige Anschrift verwendet."
                    />
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t">
                    <Button type="button" variant="outline" onClick={onCancel}>Abbrechen</Button>
                    <Button type="submit">{existingCustomer ? 'Speichern' : 'Kunde anlegen'}</Button>
                </div>
            </form>
        </Card>
    );
};

