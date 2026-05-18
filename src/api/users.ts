import { apiClient } from "./client"
import { API } from "./endpoints"
import { UserMe } from "./auth"

interface DeleteDataResponse {
  deleted: boolean
  user_id?: string
  reason?: string
}

export const usersApi = {
  me: () =>
    apiClient.get<UserMe>(API.users.me).then((r) => r.data),

  deleteData: (id: string) =>
    apiClient.delete<DeleteDataResponse>(API.users.deleteData(id)).then((r) => r.data),
}
