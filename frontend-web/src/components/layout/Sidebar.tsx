import React from 'react'
import {
  BarChart3,
  Target,
  Shield,
  Settings,
  Activity,
  Wallet,
  LineChart,
  AlertTriangle,
  BookOpen
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'
import { NavLink } from 'react-router-dom'

interface SidebarProps {
  className?: string
  collapsed?: boolean
}

const menuItems = [
  {
    title: 'Dashboard',
    icon: BarChart3,
    href: '/',
    badge: null,
  },
  {
    title: 'Live Prices',
    icon: Activity,
    href: '/prices',
    badge: 'LIVE',
  },
  {
    title: 'Trading Signals',
    icon: Target,
    href: '/signals',
    badge: '3',
  },
  {
    title: 'Technical Analysis',
    icon: LineChart,
    href: '/analysis',
    badge: null,
  },
  {
    title: 'Risk Management',
    icon: Shield,
    href: '/risk',
    badge: null,
  },
  {
    title: 'Portfolio',
    icon: Wallet,
    href: '/portfolio',
    badge: null,
  },
  {
    title: 'Alerts',
    icon: AlertTriangle,
    href: '/alerts',
    badge: '2',
  },
  {
    title: 'Documentation',
    icon: BookOpen,
    href: '/docs',
    badge: null,
  },
  {
    title: 'Settings',
    icon: Settings,
    href: '/settings',
    badge: null,
  },
]

export const Sidebar: React.FC<SidebarProps> = ({
  className,
  collapsed = false
}) => {
  return (
    <aside className={cn(
      "flex flex-col border-r border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60",
      collapsed ? "w-16" : "w-64",
      "transition-all duration-300 ease-in-out",
      className
    )}>
      <div className="flex-1 overflow-auto py-4">
        <nav className="space-y-1 px-3">
          {menuItems.map((item) => (
            <NavLink
              key={item.href}
              to={item.href}
              className={({ isActive }) => cn(
                buttonVariants({ variant: 'ghost', size: collapsed ? 'icon' : 'sm' }),
                "w-full justify-start text-left font-normal",
                collapsed ? "px-2" : "px-3",
                "hover:bg-accent hover:text-accent-foreground",
                isActive && "bg-accent text-accent-foreground"
              )}
            >
              <item.icon className={cn(
                "h-4 w-4",
                collapsed ? "" : "mr-3"
              )} />
              {!collapsed && (
                <>
                  <span className="flex-1">{item.title}</span>
                  {item.badge && (
                    <span className={cn(
                      "ml-auto text-xs px-1.5 py-0.5 rounded-md",
                      item.badge === 'LIVE'
                        ? "bg-green-500/10 text-green-500"
                        : "bg-primary/10 text-primary"
                    )}>
                      {item.badge}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Footer */}
      {!collapsed && (
        <div className="border-t border-border p-4">
          <div className="flex items-center space-x-3">
            <div className="flex-1">
              <p className="text-sm font-medium">System Status</p>
              <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
                <span>All systems operational</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}