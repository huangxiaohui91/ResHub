import { apiClient } from "./client";

export async function listUsers() {
  const { data } = await apiClient.get("/admin/users");
  if (data.code !== 200) throw new Error(data.message || "加载失败");
  return data.data;
}

export async function createUser(payload: { username: string; password: string; realName?: string; email?: string; systemRole: string; projectCode?: string; projectRole?: string }) {
  const { data } = await apiClient.post("/admin/users", payload);
  if (data.code !== 200) throw new Error(data.message || "创建失败");
  return data.data;
}

export async function updateUser(id: number, payload: { realName?: string; email?: string; systemRole?: string }) {
  const { data } = await apiClient.patch(`/admin/users/${id}`, payload);
  if (data.code !== 200) throw new Error(data.message || "更新失败");
  return true;
}

export async function deleteUser(id: number) {
  const { data } = await apiClient.delete(`/admin/users/${id}`);
  if (data.code !== 200) throw new Error(data.message || "删除失败");
  return true;
}

export async function listCategories(projectCode: string) {
  const { data } = await apiClient.get("/categories", { params: { projectCode } });
  if (data.code !== 200) throw new Error(data.message || "加载失败");
  return data.data;
}

export async function listRecent(projectCode: string) {
  const { data } = await apiClient.get("/recent", { params: { projectCode } });
  if (data.code !== 200) throw new Error(data.message || "加载失败");
  return data.data;
}

export async function listHotTags(projectCode: string) {
  const { data } = await apiClient.get("/hot-tags", { params: { projectCode } });
  if (data.code !== 200) throw new Error(data.message || "加载失败");
  return data.data;
}
export async function createCategory(payload: { projectCode: string; name: string; path: string; type: string; parentId?: number }) {
  const { data } = await apiClient.post("/categories", payload);
  if (data.code !== 200) throw new Error(data.message || "创建失败");
  return data.data;
}

export async function updateCategory(id: number, payload: { name?: string; path?: string; type?: string; parentId?: number }) {
  const { data } = await apiClient.patch(`/categories/${id}`, payload);
  if (data.code !== 200) throw new Error(data.message || "更新失败");
  return true;
}

export async function deleteCategory(id: number) {
  const { data } = await apiClient.delete(`/categories/${id}`);
  if (data.code !== 200) throw new Error(data.message || "删除失败");
  return true;
}
