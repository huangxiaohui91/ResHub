import { apiClient } from "./client";

export async function listAssets(params: { projectCode: string; keyword?: string; categoryPath?: string; status?: string; tag?: string; page?: number; pageSize?: number }) {
  const { data } = await apiClient.get("/assets", { params });
  if (data.code !== 200) throw new Error(data.message || "加载失败");
  return data.data;
}

export async function uploadAsset(payload: { file: File; projectCode: string; categoryPath: string; displayName: string; tags: string[]; relatedProjectCodes?: string[]; thumb?: Blob; status?: string }, opts?: { onUploadProgress?: (p: any) => void }) {
  const fd = new FormData();
  fd.append("file", payload.file);
  if (payload.thumb) fd.append("thumb", payload.thumb, "thumb.png");
  fd.append(
    "meta",
    JSON.stringify({
      projectCode: payload.projectCode,
      categoryPath: payload.categoryPath,
      displayName: payload.displayName,
      tags: payload.tags,
      relatedProjectCodes: payload.relatedProjectCodes || [],
      status: payload.status
    })
  );
  const { data } = await apiClient.post("/assets", fd, { onUploadProgress: opts?.onUploadProgress });
  if (data.code !== 200) throw new Error(data.message || "上传失败");
  return data.data;
}

export async function approveAsset(id: number) {
  const { data } = await apiClient.post(`/assets/${id}/approve`);
  if (data.code !== 200) throw new Error(data.message || "操作失败");
  return true;
}

export async function rejectAsset(id: number) {
  const { data } = await apiClient.post(`/assets/${id}/reject`);
  if (data.code !== 200) throw new Error(data.message || "操作失败");
  return true;
}

export async function getAssetDetail(id: number) {
  const { data } = await apiClient.get(`/assets/${id}`);
  if (data.code !== 200) throw new Error(data.message || "获取失败");
  return data.data;
}

export async function uploadVersion(id: number, file: File, changeLog: string) {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("changeLog", changeLog);
  const { data } = await apiClient.post(`/assets/${id}/version`, fd);
  if (data.code !== 200) throw new Error(data.message || "上传失败");
  return data.data;
}

export async function listReviews(id: number) {
  const { data } = await apiClient.get(`/assets/${id}/reviews`);
  if (data.code !== 200) throw new Error(data.message || "加载失败");
  return data.data;
}

export async function addReviewComment(id: number, comment: string) {
  const { data } = await apiClient.post(`/assets/${id}/reviews`, { comment });
  if (data.code !== 200) throw new Error(data.message || "提交失败");
  return true;
}

export async function updateAsset(id: number, payload: { displayName?: string; categoryPath?: string; status?: string }) {
  const { data } = await apiClient.patch(`/assets/${id}`, payload);
  if (data.code !== 200) throw new Error(data.message || "更新失败");
  return true;
}

export async function deleteAsset(id: number) {
  const { data } = await apiClient.delete(`/assets/${id}`);
  if (data.code !== 200) throw new Error(data.message || "删除失败");
  return true;
}

export async function listTags(projectCode: string) {
  const { data } = await apiClient.get("/tags", { params: { projectCode } });
  if (data.code !== 200) throw new Error(data.message || "加载失败");
  return data.data;
}
