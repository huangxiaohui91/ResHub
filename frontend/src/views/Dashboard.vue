<template>
  <div style="padding: 16px;">
    <div style="margin-top: 16px; display:flex; gap:12px; align-items:center;">
      <el-button type="primary" @click="loadProjects">刷新项目</el-button>
      <el-select v-model="currentCode" placeholder="选择项目" style="width:240px">
        <el-option v-for="p in projects" :key="p.code" :label="p.name" :value="p.code" />
      </el-select>
      <el-button @click="goAssets">资源管理</el-button>
    </div>
    <el-table :data="projects" style="width: 100%; margin-top: 16px;">
      <el-table-column prop="code" label="代码" width="140" />
      <el-table-column prop="name" label="名称" />
      <el-table-column prop="role" label="角色" width="140" />
    </el-table>
  </div>
  <el-notification v-if="error" type="error" :title="'加载失败'" :message="error" />
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { apiClient } from "../api/client";
import { useAuthStore } from "../stores/auth.store";
import { useRouter } from "vue-router";

const router = useRouter();
const auth = useAuthStore();
const projects = ref<Array<{ id: number; code: string; name: string; role: string }>>([]);
const error = ref("");
const currentCode = ref("");

async function loadProjects() {
  error.value = "";
  try {
    const { data } = await apiClient.get("/projects");
    if (data.code !== 200) throw new Error(data.message || "接口错误");
    projects.value = data.data;
    if (!currentCode.value && projects.value.length) currentCode.value = projects.value[0].code;
  } catch (e: any) {
    error.value = e?.message || "加载失败";
  }
}

onMounted(() => {
  if (!auth.token) {
    router.push("/login");
    return;
  }
  loadProjects();
});

function goAssets() {
  if (!currentCode.value) return;
  router.push(`/assets/${currentCode.value}`);
}
</script>
