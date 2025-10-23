import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { MainLayout } from '@/layouts/MainLayout'
import { queryClient } from '@/lib/queryClient'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Dashboard } from '@/pages/Dashboard'
import { Prices } from '@/pages/Prices'
import { Signals } from '@/pages/Signals'
import { Analysis } from '@/pages/Analysis'
import { Risk } from '@/pages/Risk'
import { Portfolio } from '@/pages/Portfolio'
import { Alerts } from '@/pages/Alerts'
import { Docs } from '@/pages/Docs'
import { Settings } from '@/pages/Settings'

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="dark">
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<MainLayout><Dashboard /></MainLayout>} />
            <Route path="/prices" element={<MainLayout><Prices /></MainLayout>} />
            <Route path="/signals" element={<MainLayout><Signals /></MainLayout>} />
            <Route path="/analysis" element={<MainLayout><Analysis /></MainLayout>} />
            <Route path="/risk" element={<MainLayout><Risk /></MainLayout>} />
            <Route path="/portfolio" element={<MainLayout><Portfolio /></MainLayout>} />
            <Route path="/alerts" element={<MainLayout><Alerts /></MainLayout>} />
            <Route path="/docs" element={<MainLayout><Docs /></MainLayout>} />
            <Route path="/settings" element={<MainLayout><Settings /></MainLayout>} />
          </Routes>
        </BrowserRouter>
      </ThemeProvider>
      {/* React Query DevTools - only shows in development */}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}

export default App