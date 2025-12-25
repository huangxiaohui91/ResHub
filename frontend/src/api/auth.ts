import { apiClient } from "./client";

export async function login(credentials: { username: string; password: string }) {
  const body = new URLSearchParams();
  body.set("username", credentials.username);
  body.set("password", credentials.password);
  const { data } = await apiClient.post("/auth/login", body.toString(), {
    headers: { "Content-Type": "application/x-www-form-urlencoded" }
  });
  if (data.code !== 200) throw new Error(data.message || "登录失败");
  return data.data;
}

export async function getMe() {
  const { data } = await apiClient.get("/auth/me");
  if (data.code !== 200) throw new Error(data.message || "获取用户信息失败");
  return data.data;
}
