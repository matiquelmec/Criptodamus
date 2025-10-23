import axios, { type AxiosInstance, type AxiosResponse } from 'axios'
import { config } from '@/lib/config'

// Create axios instance
export const api: AxiosInstance = axios.create({
  baseURL: config.apiUrl,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor
api.interceptors.request.use(
  (config) => {
    // Add auth token if available
    const token = localStorage.getItem('auth_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor
api.interceptors.response.use(
  (response: AxiosResponse) => {
    return response
  },
  (error) => {
    if (error.response?.status === 401) {
      // Handle unauthorized access
      localStorage.removeItem('auth_token')
      // Could trigger a redirect to login here
    }

    console.error('API Error:', error.response?.data || error.message)
    return Promise.reject(error)
  }
)

// Generic API functions
export const apiGet = <T = any>(url: string): Promise<T> => {
  return api.get<T>(url).then(response => response.data)
}

export const apiPost = <T = any>(url: string, data?: any): Promise<T> => {
  return api.post<T>(url, data).then(response => response.data)
}

export const apiPut = <T = any>(url: string, data?: any): Promise<T> => {
  return api.put<T>(url, data).then(response => response.data)
}

export const apiDelete = <T = any>(url: string): Promise<T> => {
  return api.delete<T>(url).then(response => response.data)
}

// Health check function
export const checkApiHealth = async (): Promise<boolean> => {
  try {
    const response = await apiGet<any>('/api/health')
    // Backend returns: { success: true, status: 'healthy', ... }
    return Boolean(response?.success) || response?.status === 'healthy'
  } catch (error) {
    console.error('API health check failed:', error)
    return false
  }
}