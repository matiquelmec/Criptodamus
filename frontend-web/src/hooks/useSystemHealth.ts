import { useQuery } from '@tanstack/react-query'
import { checkApiHealth } from '@/services/api'
import { QUERY_KEYS } from '@/lib/queryClient'

export const useSystemHealth = () => {
  return useQuery({
    queryKey: QUERY_KEYS.HEALTH,
    queryFn: checkApiHealth,
    // Check health every 30 seconds
    refetchInterval: 30000,
    // Keep previous data while refetching
    placeholderData: (previousData) => previousData,
    // Retry failed health checks more aggressively
    retry: 3,
    retryDelay: 1000,
  })
}