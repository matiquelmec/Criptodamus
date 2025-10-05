import React from 'react'
import { Moon, Sun, Activity, TrendingUp, Settings, Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SystemStatus } from '@/components/SystemStatus'
import { useTheme } from '@/contexts/ThemeContext'
import { cn } from '@/lib/utils'

interface HeaderProps {
  className?: string
}

export const Header: React.FC<HeaderProps> = ({ className }) => {
  const { theme, toggleTheme } = useTheme()

  return (
    <header className={cn(
      "sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60",
      className
    )}>
      <div className="container flex h-16 max-w-screen-2xl items-center justify-between px-4">
        {/* Logo and Title */}
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className="rounded-lg bg-primary p-2">
              <TrendingUp className="h-5 w-5 text-primary-foreground" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-lg font-bold">CryptoTrading AI</h1>
              <p className="text-xs text-muted-foreground">Advanced Trading Advisor</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="hidden md:flex items-center space-x-1">
          <Button variant="ghost" size="sm" className="text-sm">
            <Activity className="mr-2 h-4 w-4" />
            Dashboard
          </Button>
          <Button variant="ghost" size="sm" className="text-sm">
            <TrendingUp className="mr-2 h-4 w-4" />
            Signals
          </Button>
          <Button variant="ghost" size="sm" className="text-sm">
            Markets
          </Button>
          <Button variant="ghost" size="sm" className="text-sm">
            Portfolio
          </Button>
        </nav>

        {/* Right side controls */}
        <div className="flex items-center space-x-2">
          {/* Connection Status */}
          <div className="hidden sm:flex items-center space-x-2 text-sm">
            <SystemStatus />
          </div>

          {/* Notifications */}
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-4 w-4" />
            <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-red-500 text-[10px] font-medium text-white flex items-center justify-center">
              3
            </span>
          </Button>

          {/* Settings */}
          <Button variant="ghost" size="icon">
            <Settings className="h-4 w-4" />
          </Button>

          {/* Theme Toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="h-9 w-9"
          >
            {theme === 'light' ? (
              <Moon className="h-4 w-4" />
            ) : (
              <Sun className="h-4 w-4" />
            )}
            <span className="sr-only">Toggle theme</span>
          </Button>
        </div>
      </div>
    </header>
  )
}