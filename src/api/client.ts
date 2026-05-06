import axios from "axios"
import type { ApiError } from "./types"

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:8000/api",
  headers: { "Content-Type": "application/json" },
})

apiClient.interceptors.response.use(
  (res) => res,
  (error) => {
    const apiError: ApiError = {
      status: error.response?.status ?? 0,
      detail: error.response?.data?.detail ?? error.message,
    }
    return Promise.reject(apiError)
  },
)
