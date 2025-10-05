import React, { useState } from 'react'
import { Header } from '@/components/layout/Header'
import { Sidebar } from '@/components/layout/Sidebar'
import { cn } from '@/lib/utils'

interface MainLayoutProps {
  children: React.ReactNode
  className?: string
}

export const MainLayout: React.FC<MainLayoutProps> = ({
  children,
  className
}) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <Sidebar
        collapsed={sidebarCollapsed}
        className="fixed inset-y-0 left-0 z-40 lg:static lg:inset-auto"
      />

      {/* Main Content Area */}
      <div className={cn(
        "flex-1 flex flex-col",
        sidebarCollapsed ? "lg:ml-16" : "lg:ml-64",
        "transition-all duration-300 ease-in-out"
      )}>
        {/* Header */}
        <Header />

        {/* Page Content */}
        <main className={cn(
          "flex-1 overflow-auto",
          "p-4 lg:p-6",
          className
        )}>
          {children}
        </main>
      </div>

      {/* Mobile Sidebar Overlay */}
      {!sidebarCollapsed && (
        <div
          className="fixed inset-0 z-30 bg-black/20 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarCollapsed(true)}
        />
      )}
    </div>
  )
}