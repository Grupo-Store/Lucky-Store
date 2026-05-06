import axios from "axios"
import type { ApiError } from "./types"

const MAX_NETWORK_RETRIES = 3

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:8000/api",
  headers: { "Content-Type": "application/json" },
})

// request interceptor — attach Bearer token
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token")
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// response interceptor — refresh on 401, retry on network errors
apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config

    // auto-refresh on 401
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true
      try {
        const refresh = localStorage.getItem("refresh_token")
        const { data } = await apiClient.post("/auth/refresh-token", { refresh_token: refresh })
        localStorage.setItem("access_token", data.access_token)
        original.headers.Authorization = `Bearer ${data.access_token}`
        return apiClient(original)
      } catch {
        localStorage.clear()
        window.location.href = "/login"
        return Promise.reject(error)
      }
    }

    // retry only on network errors (no response), never on 4xx/5xx
    const isNetworkError = !error.response
    original._retryCount = original._retryCount ?? 0
    if (isNetworkError && original._retryCount < MAX_NETWORK_RETRIES) {
      original._retryCount += 1
      const delay = 2 ** original._retryCount * 500
      await new Promise((resolve) => setTimeout(resolve, delay))
      return apiClient(original)
    }

    const apiError: ApiError = {
      status: error.response?.status ?? 0,
      detail: error.response?.data?.detail ?? error.message,
    }
    return Promise.reject(apiError)
  },
)
