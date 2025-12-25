<template>
  <el-container style="height: calc(100vh - 56px);">
    <el-aside width="280px" style="border-right:1px solid #eee; padding:12px;">
      <div style="display:flex; flex-direction:column; gap:8px;">
        <el-input v-model="projectCode" placeholder="项目代码" />
        <el-input v-model="keyword" placeholder="关键字" />
        <el-select v-model="type" placeholder="类型">
          <el-option label="全部" value="" />
          <el-option label="UI" value="ui" />
          <el-option label="角色" value="character" />
          <el-option label="模型" value="model" />
          <el-option label="动作" value="animation" />
          <el-option label="特效" value="vfx" />
          <el-option label="BGM" value="bgm" />
          <el-option label="音效" value="sfx" />
        </el-select>
        <el-date-picker v-model="dateRange" type="daterange" range-separator="至" start-placeholder="开始日期" end-placeholder="结束日期" />
        <el-select v-model="orderBy" placeholder="排序">
          <el-option label="最新" value="created_desc" />
          <el-option label="热度" value="download_desc" />
        </el-select>
        <el-button type="primary" @click="load">查询</el-button>
      </div>
      <el-divider />
      <div>
        <div style="font-weight:600; margin-bottom:8px;">分类</div>
        <el-tree :data="treeData" :props="{ children: 'children', label: 'name' }" node-key="path" highlight-current>
          <template #default="{ data }">
            <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
              <span>{{ data.name }}</span>
              <el-button size="small" @click="selectCategory(data.path)">查看</el-button>
            </div>
          </template>
        </el-tree>
      </div>
      <el-divider />
      <div>
        <div style="font-weight:600; margin-bottom:8px;">常用标签</div>
        <div style="display:flex; flex-wrap:wrap; gap:8px;">
          <el-tag v-for="t in hotTags" :key="t.name" @click="selectTag(t.name)" style="cursor:pointer;">
            {{ t.name }} <span style="margin-left:4px; color:#888;">{{ t.count }}</span>
          </el-tag>
        </div>
      </div>
    </el-aside>
    <el-main style="padding:16px;">
      <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:12px;">
        <el-card v-for="it in items" :key="it.id" shadow="hover">
          <div style="position:relative;">
          <el-image v-if="isImage(it)" :src="fileUrl(it)" :preview-src-list="[fileUrl(it)]" fit="cover" style="width:100%;height:160px;" />
          <div v-else-if="isAudio(it)" style="display:flex; flex-direction:column; gap:6px;">
            <audio :src="fileUrl(it)" controls style="width:100%"></audio>
            <canvas :id="'wave-'+it.id" height="60" style="width:100%;"></canvas>
          </div>
          <div v-else style="height:160px;display:flex;align-items:center;justify-content:center;color:#888;">无法预览</div>
          </div>
          <div style="margin-top:8px; display:flex; justify-content:space-between; align-items:center;">
            <div style="font-weight:600; white-space:nowrap; text-overflow:ellipsis; overflow:hidden; max-width:70%;">{{ it.display_name }}</div>
            <el-button size="small" type="primary" @click="download(it)">下载</el-button>
          </div>
          <div style="font-size:12px;color:#888; margin-top:4px;">{{ it.tag_names }}</div>
        </el-card>
      </div>
      <div style="display:flex; justify-content:flex-end; margin-top:12px;">
        <el-pagination background layout="prev, pager, next, total" :total="total" v-model:current-page="page" :page-size="pageSize" @current-change="load" />
      </div>
    <el-alert v-if="error" type="error" :title="error" show-icon closable style="margin-top:12px;" />
    </el-main>
  </el-container>
</template>

<script setup lang="ts">
import { ref, watch, computed } from "vue";
import { useRoute } from "vue-router";
import { apiClient } from "../api/client";
import { listCategories, listHotTags } from "../api/admin";
import { useAuthStore } from "../stores/auth.store";

const route = useRoute();
const authStore = useAuthStore();
const projectCode = ref(String(route.params.projectCode || "ax"));
const type = ref("");
const keyword = ref("");
const items = ref<any[]>([]);
const error = ref("");
const total = ref(0);
const page = ref(1);
const categoryPath = ref(String(route.query.categoryPath || ""));
const pageSize = 20;
const dateRange = ref<[Date,Date]|null>(null);
const orderBy = ref("created_desc");
const categories = ref<any[]>([]);
const hotTags = ref<Array<{name:string;count:number}>>([]);

function isImage(it:any) {
  const ext = String(it.file_ext || "").toLowerCase();
  return ["png","jpg","jpeg","gif","webp","svg"].includes(ext);
}
function isAudio(it:any) {
  const ext = String(it.file_ext || "").toLowerCase();
  return ["mp3","wav","ogg"].includes(ext);
}
function fileUrl(it:any) {
  return `${import.meta.env.VITE_API_BASE_URL}/assets/${it.id}/file?token=${authStore.token}`;
}
async function load() {
  error.value = "";
  try {
    const params:any = { projectCode: projectCode.value, status: "approved", page: page.value, pageSize };
    if (keyword.value) params.keyword = keyword.value;
    if (categoryPath.value) params.categoryPath = categoryPath.value;
    else if (type.value) params.categoryPath = type.value;
    params.orderBy = orderBy.value;
    if (dateRange.value) {
      params.start = dateRange.value[0].toISOString().slice(0,10);
      params.end = dateRange.value[1].toISOString().slice(0,10) + " 23:59:59";
    }
    const { data } = await apiClient.get("/assets", { params });
    if (data.code !== 200) throw new Error(data.message || "接口错误");
    items.value = data.data.items;
    total.value = data.data.total;
    setTimeout(drawAllWaveforms, 0);
    categories.value = await listCategories(projectCode.value);
    hotTags.value = await listHotTags(projectCode.value);
  } catch (e:any) {
    error.value = e?.message || "加载失败";
  }
}
function download(it:any) {
  window.open(`${import.meta.env.VITE_API_BASE_URL}/assets/${it.id}/download?token=${authStore.token}`, "_blank");
}
load();
watch(() => route.fullPath, () => {
  projectCode.value = String(route.params.projectCode || projectCode.value);
  categoryPath.value = String(route.query.categoryPath || "");
  keyword.value = String(route.query.keyword || "");
  page.value = 1;
  load();
});
function drawAllWaveforms() {
  for (const it of items.value) {
    if (!isAudio(it)) continue;
    const id = 'wave-'+it.id;
    const canvas = document.getElementById(id) as HTMLCanvasElement | null;
    if (!canvas) continue;
    drawWaveform(canvas, it);
  }
}

function selectCategory(path:string) {
  categoryPath.value = path;
  page.value = 1;
  load();
}
function selectTag(name:string) {
  keyword.value = name;
  page.value = 1;
  load();
}

const treeData = computed(() => {
  const rows = categories.value;
  const byPath = new Map<string, any>();
  for (const r of rows) byPath.set(r.path, { ...r, children: [] });
  const roots:any[] = [];
  for (const r of rows) {
    const parts = String(r.path).split("/").filter(Boolean);
    if (parts.length <= 1) {
      roots.push(byPath.get(r.path));
      continue;
    }
    const parentPath = parts.slice(0, parts.length - 1).join("/");
    const parent = byPath.get(parentPath);
    if (parent) parent.children.push(byPath.get(r.path));
    else roots.push(byPath.get(r.path));
  }
  return roots;
});
async function drawWaveform(canvas: HTMLCanvasElement, it:any) {
  try {
    const resp = await fetch(fileUrl(it), { headers: { Authorization: `Bearer ${authStore.token}` } });
    const buf = await resp.arrayBuffer();
    const ctx = new (window as any).AudioContext();
    const audioBuf = await ctx.decodeAudioData(buf);
    const data = audioBuf.getChannelData(0);
    const step = Math.floor(data.length / canvas.width);
    const peaks:number[] = [];
    for (let i=0; i<canvas.width; i++) {
      let sum = 0;
      for (let j=0; j<step; j++) sum += Math.abs(data[i*step + j] || 0);
      peaks.push(sum / step);
    }
    const g = canvas.getContext("2d")!;
    g.clearRect(0,0,canvas.width,canvas.height);
    g.fillStyle = "#409EFF";
    const h = canvas.height;
    for (let i=0; i<peaks.length; i++) {
      const val = peaks[i];
      const barH = Math.max(1, Math.floor(val * h));
      g.fillRect(i, Math.floor((h - barH)/2), 1, barH);
    }
  } catch {}
}
</script>
