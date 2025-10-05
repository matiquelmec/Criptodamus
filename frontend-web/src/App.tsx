import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { MainLayout } from '@/layouts/MainLayout'
import { Dashboard } from '@/pages/Dashboard'
import { queryClient } from '@/lib/queryClient'

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="dark">
        <MainLayout>
          <Dashboard />
        </MainLayout>
      </ThemeProvider>
      {/* React Query DevTools - only shows in development */}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}

export default App