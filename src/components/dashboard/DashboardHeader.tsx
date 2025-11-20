import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Menu, X, Sun, Moon } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';
import AccountDropdown from './AccountDropdown';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface NavigationItem {
  label: string;
  href?: string;
  onClick?: () => void;
  badge?: number;
}

interface DashboardHeaderProps {
  title: string;
  userName: string;
  userEmail: string;
  navigationItems: NavigationItem[];
  onLogout: () => void;
  notificationCount?: number;
  notificationPanel?: React.ReactNode;
  isVerified?: boolean;
}

const DashboardHeader = ({
  title,
  userName,
  userEmail,
  navigationItems,
  onLogout,
  notificationPanel,
  isVerified,
}: DashboardHeaderProps) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleNavClick = (item: NavigationItem) => {
    if (item.onClick) {
      item.onClick();
    }
    setIsMobileMenuOpen(false);
  };

  return (
    <header className="bg-card border-b border-border shadow-soft sticky top-0 z-40">
      <div className="px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between gap-6">
          {/* Logo and Title - Left */}
          <div className="flex items-center gap-3 min-w-0 flex-shrink-0">
            <img src="/bs-logo.svg" alt="ByteSoft" className="w-8 h-8 flex-shrink-0" />
            <h1 className="text-lg sm:text-xl font-bold font-heading truncate text-foreground">{title}</h1>
          </div>

          {/* Desktop Navigation - Center */}
          <nav className="hidden lg:flex items-center gap-6 flex-1 justify-center">
            {navigationItems.map((item, idx) => (
              <button
                key={idx}
                onClick={() => handleNavClick(item)}
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap flex items-center gap-2"
              >
                {item.label}
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-yellow-500 rounded-full">
                    {item.badge}
                  </span>
                )}
              </button>
            ))}
          </nav>

          {/* Right Section */}
          <div className="flex items-center gap-3 flex-shrink-0 ml-auto">
            {notificationPanel && (
              <div className="hidden sm:block">
                {notificationPanel}
              </div>
            )}

            {/* Theme toggle (light / dark) */}
            <ThemeToggle />

            <AccountDropdown
              userName={userName}
              userEmail={userEmail}
              onLogout={onLogout}
              isVerified={isVerified}
            />

            {/* Mobile Menu Button */}
            <button
              className="lg:hidden p-2 rounded-lg hover:bg-muted transition-colors"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMobileMenuOpen && (
          <nav className="lg:hidden mt-4 pt-4 border-t border-border space-y-2">
            {navigationItems.map((item, idx) => (
              <button
                key={idx}
                onClick={() => handleNavClick(item)}
                className="block w-full text-left px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
              >
                <div className="flex items-center justify-between">
                  {item.label}
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-yellow-500 rounded-full">
                      {item.badge}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </nav>
        )}
      </div>
    </header>
  );
};

// Theme toggle component
function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const toggle = () => {
    if (theme === 'dark') setTheme('light');
    else setTheme('dark');
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggle}
      className="h-10 w-10 p-0 rounded-full hover:bg-muted hidden sm:inline-flex items-center justify-center"
      aria-label="Toggle theme"
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
    >
      {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </Button>
  );
}

export default DashboardHeader;
