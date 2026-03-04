import React from 'react';
import { LayoutDashboard, Calendar, Users, FileText, Menu, Settings, Building, Receipt, Upload } from 'lucide-react';

type Tab = 'dashboard' | 'bookings' | 'calendar' | 'customers' | 'invoices' | 'import' | 'portfolio' | 'admin';

interface LayoutProps {
    activeTab: Tab;
    onTabChange: (tab: Tab) => void;
    children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ activeTab, onTabChange, children }) => {
    const navItems = [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'bookings', label: 'Smart Booking', icon: FileText },
        { id: 'calendar', label: 'Belegungsplan', icon: Calendar },
        { id: 'customers', label: 'Kunden', icon: Users },
        { id: 'invoices', label: 'Rechnungen', icon: Receipt },
        { id: 'import', label: 'Import', icon: Upload },
        { id: 'portfolio', label: 'Portfolio', icon: Building },
        { id: 'admin', label: 'Admin', icon: Settings },
    ];

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            {/* Top Header */}
            <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
                <div className="container mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="bg-blue-600 text-white p-1.5 rounded-lg">
                            <Menu className="w-5 h-5" />
                        </div>
                        <span className="text-xl font-bold text-gray-900">Living21 Manager</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-sm font-medium text-gray-600">
                            AD
                        </div>
                    </div>
                </div>

                {/* Navigation Tabs */}
                <div className="container mx-auto px-4">
                    <nav className="flex space-x-8">
                        {navItems.map((item) => {
                            const Icon = item.icon;
                            const isActive = activeTab === item.id;
                            return (
                                <button
                                    key={item.id}
                                    onClick={() => onTabChange(item.id as Tab)}
                                    className={`
                    flex items-center gap-2 py-4 px-1 border-b-2 text-sm font-medium transition-colors
                    ${isActive
                                            ? 'border-blue-600 text-blue-600'
                                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
                  `}
                                >
                                    <Icon className="w-4 h-4" />
                                    {item.label}
                                </button>
                            );
                        })}
                    </nav>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 container mx-auto px-4 py-8">
                {children}
            </main>
        </div>
    );
};
