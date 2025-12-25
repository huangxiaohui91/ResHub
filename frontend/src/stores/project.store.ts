import { defineStore } from "pinia";
import { apiClient } from "../api/client";

export const useProjectStore = defineStore("project", {
  state: () => ({
    projects: [] as Array<{ id: number; code: string; name: string; role: string }>,
    currentCode: ""
  }),
  actions: {
    async load() {
      const { data } = await apiClient.get("/projects");
      if (data.code !== 200) throw new Error(data.message || "加载项目失败");
      this.projects = data.data;
      if (!this.currentCode && this.projects.length) this.currentCode = this.projects[0].code;
    },
    setCurrent(code: string) {
      this.currentCode = code;
    }
  }
});
