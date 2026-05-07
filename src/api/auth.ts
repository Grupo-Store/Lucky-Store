import { apiClient } from "./client"
import { API } from "./endpoints"

export interface LoginPayload {
  username: string
  password: string
}

export interface TokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
}

export interface UserMe {
  id: string
  username: string
  email: string
  role: string
  is_active: boolean
}

export interface ChangePasswordPayload {
  current_password: string
  new_password: string
}

export const authApi = {
  login: (payload: LoginPayload) =>
    apiClient.post<TokenResponse>(API.auth.login, payload).then((r) => r.data),

  refresh: (refresh_token: string) =>
    apiClient.post<TokenResponse>(API.auth.refresh, { refresh_token }).then((r) => r.data),

  logout: () =>
    apiClient.post(API.auth.logout).then((r) => r.data),

  me: () =>
    apiClient.get<UserMe>(API.auth.me).then((r) => r.data),

  changePassword: (payload: ChangePasswordPayload) =>
    apiClient.post(API.auth.changePassword, payload).then((r) => r.data),

  setup2fa: () =>
    apiClient.post<{ qr_code: string; secret: string }>(API.auth.setup2fa).then((r) => r.data),

  confirm2fa: (code: string) =>
    apiClient.post(API.auth.confirm2fa, { code }).then((r) => r.data),
}
