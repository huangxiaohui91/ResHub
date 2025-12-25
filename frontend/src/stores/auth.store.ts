import { defineStore } from "pinia";
import { login, getMe } from "../api/auth";
import { setAuthToken } from "../api/client";

export const useAuthStore = defineStore("auth", {
  state: () => ({
    token: localStorage.getItem("token") || "",
    userInfo: null as null | { id: number; username: string; realName: string; systemRole: string }
  }),
  actions: {
    async login(credentials: { username: string; password: string }) {
      const resp = await login(credentials);
      this.token = resp.token;
      this.userInfo = resp.userInfo;
      localStorage.setItem("token", resp.token);
      setAuthToken(resp.token);
    },
    async fetchUserInfo() {
      if (!this.token) return;
      try {
        setAuthToken(this.token);
        const info = await getMe();
        this.userInfo = info;
      } catch (e) {
        this.logout();
      }
    },
    logout() {
      this.token = "";
      this.userInfo = null;
      localStorage.removeItem("token");
    }
  }
});
