<template>
  <div class="store-container">
    <!-- 顶部导航与搜索栏 -->
    <StoreHeader 
      :initial-keyword="keyword" 
      @search="handleHeaderSearch" 
    />
    <div class="store-header-nav-bg">
      <!-- 分类导航条 -->
      <div class="category-nav">
        <div 
          v-for="cat in topCategories" 
          :key="cat.key" 
          class="nav-item"
          :class="{ active: activeRoot === cat.key }"
          @click="switchTab(cat.key)"
        >
          {{ cat.name }}
        </div>
      </div>
    </div>
    
    <!-- 二级分类导航 -->
    <div v-if="activeSubCategories.length" class="sub-category-bg">
      <div class="sub-category-nav">
        <div 
          v-for="sub in activeSubCategories"
          :key="sub.key"
          class="sub-nav-item"
          :class="{ active: currentTab === sub.key }"
          @click="switchTab(sub.key)"
        >
          {{ sub.name }}
        </div>
      </div>
    </div>

    <div class="store-main">
      <!-- 首页模式：展示推荐列表 -->
      <div v-if="!isSearching && !currentTab" class="home-view">
        
        <!-- 热门资源 -->
        <div class="section-header">
          <h2>热门资源</h2>
          <el-button link @click="viewAll('hot')">查看全部</el-button>
        </div>
        <div class="asset-grid">
          <div v-for="it in hotAssetsList" :key="it.id" class="asset-card" @click="showDetail(it)">
            <div class="card-thumb">
              <img v-if="isImage(it)" :src="fileUrl(it)" style="width:100%; height:100%; object-fit:cover;" loading="lazy" />
              <model-viewer v-else-if="is3D(it)" :src="fileUrl(it)" auto-rotate interaction-prompt="none" style="width:100%; height:100%; background-color: #f0f0f0; pointer-events: none;"></model-viewer>
              <div v-else-if="isAudio(it)" class="audio-placeholder" style="width:100%; display:flex; justify-content:center; align-items:center; height:100%;" @click.stop>
                 <audio :src="fileUrl(it)" controls style="width:90%; height:30px;"></audio>
              </div>
              <div v-else class="generic-placeholder">
                <el-icon :size="40"><Document /></el-icon>
              </div>
              <div class="file-type-badge">{{ it.file_ext }}</div>
            </div>
            <div class="card-info">
              <div class="card-title" :title="it.display_name">{{ it.display_name }}</div>
              <div class="card-meta">
                <span class="category">{{ it.category_path }}</span>
                <span class="author">{{ it.uploader_name }}</span>
              </div>
              <div class="card-footer">
                <el-rate v-model="fakeRate" disabled text-color="#ff9900" size="small" />
                <span class="price">免费</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 最新上架 -->
        <div class="section-header" style="margin-top: 40px;">
          <h2>最新上架</h2>
          <el-button link @click="viewAll('new')">查看全部</el-button>
        </div>
        <div class="asset-grid">
          <div v-for="it in newAssetsList" :key="it.id" class="asset-card" @click="showDetail(it)">
            <div class="card-thumb">
              <img v-if="isImage(it)" :src="fileUrl(it)" style="width:100%; height:100%; object-fit:cover;" loading="lazy" />
              <model-viewer v-else-if="is3D(it)" :src="fileUrl(it)" auto-rotate interaction-prompt="none" style="width:100%; height:100%; background-color: #f0f0f0; pointer-events: none;"></model-viewer>
              <div v-else-if="isAudio(it)" class="audio-placeholder" style="width:100%; display:flex; justify-content:center; align-items:center; height:100%;" @click.stop>
                 <audio :src="fileUrl(it)" controls style="width:90%; height:30px;"></audio>
              </div>
              <div v-else class="generic-placeholder">
                <el-icon :size="40"><Document /></el-icon>
              </div>
              <div class="new-badge">NEW</div>
            </div>
            <div class="card-info">
              <div class="card-title" :title="it.display_name">{{ it.display_name }}</div>
              <div class="card-meta">
                <span class="category">{{ it.category_path }}</span>
                <span class="author">{{ it.uploader_name }}</span>
              </div>
              <div class="card-footer">
                 <span class="date">{{ formatDate(it.created_at) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 搜索/分类结果模式 -->
      <div v-else class="search-view">
        <div class="filter-bar">
          <el-breadcrumb separator="/">
            <el-breadcrumb-item :to="{ path: '/' }" @click.native="resetHome">首页</el-breadcrumb-item>
            <el-breadcrumb-item v-if="activeRootName && activeRootName !== '首页'">{{ activeRootName }}</el-breadcrumb-item>
            <el-breadcrumb-item v-if="currentTabName && currentTabName !== activeRootName">{{ currentTabName }}</el-breadcrumb-item>
            <el-breadcrumb-item v-if="keyword">搜索: {{ keyword }}</el-breadcrumb-item>
          </el-breadcrumb>
          <div class="sort-options">
             <el-select v-model="orderBy" placeholder="排序" size="small" @change="loadAssets">
               <el-option label="最新发布" value="created_desc" />
               <el-option label="下载最多" value="download_desc" />
             </el-select>
          </div>
        </div>

        <div v-if="loading" style="padding:40px; text-align:center;">
          <el-icon class="is-loading" :size="30"><Loading /></el-icon>
        </div>
        
        <div v-else class="asset-grid">
          <div v-for="it in assets" :key="it.id" class="asset-card" @click="showDetail(it)">
            <!-- 复用卡片样式，稍微简化 -->
            <div class="card-thumb">
              <el-image v-if="isImage(it)" :src="fileUrl(it)" fit="cover" />
              <div v-else-if="isAudio(it)" class="audio-placeholder"><el-icon :size="40"><Headset /></el-icon></div>
              <div v-else class="generic-placeholder"><el-icon :size="40"><Document /></el-icon></div>
              <div class="file-type-badge">{{ it.file_ext }}</div>
            </div>
            <div class="card-info">
              <div class="card-title">{{ it.display_name }}</div>
              <div class="card-meta">
                 <span class="category">{{ it.category_path }}</span>
              </div>
            </div>
          </div>
        </div>
         <div class="pagination-row">
            <el-pagination background layout="prev, pager, next" :total="total" v-model:current-page="page" :page-size="pageSize" @current-change="loadAssets" />
         </div>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, reactive, watch } from "vue";
import { useRouter, useRoute } from "vue-router";
import { useProjectStore } from "../stores/project.store";
import { useAuthStore } from "../stores/auth.store";
import { apiClient } from "../api/client";
import { Search, Headset, Document, Loading } from "@element-plus/icons-vue";
import StoreHeader from "../components/StoreHeader.vue";

const router = useRouter();
const route = useRoute();
const project = useProjectStore();
const authStore = useAuthStore();
const keyword = ref("");
const categories = ref<any[]>([]);
const hotAssetsList = ref<any[]>([]);
const newAssetsList = ref<any[]>([]);
const assets = ref<any[]>([]); // For search results
const total = ref(0);
const page = ref(1);
const pageSize = 20;
const orderBy = ref("created_desc");
const currentTab = ref(""); 
const isSearching = ref(false);
const loading = ref(false);
const fakeRate = ref(5);

const topCategories = [
  { key: "", name: "首页" },
  { key: "art", name: "美术" },
  { key: "audio", name: "音频" },
  { key: "plugins", name: "插件" }
];

const subCategoriesMap: Record<string, Array<{key: string, name: string}>> = {
  art: [
    { key: "art/ui", name: "UI界面" },
    { key: "art/character", name: "角色" },
    { key: "art/scene", name: "场景" },
    { key: "art/model", name: "模型" },
    { key: "art/animation", name: "动作" },
    { key: "art/vfx", name: "特效" },
  ],
  audio: [
    { key: "audio/bgm", name: "BGM" },
    { key: "audio/sfx", name: "音效" },
    { key: "audio/voice", name: "语音" },
  ]
};

const activeRoot = computed(() => {
  if (currentTab.value === "") return "";
  const found = topCategories.find(c => c.key && currentTab.value.startsWith(c.key));
  return found ? found.key : "";
});

const activeSubCategories = computed(() => {
  if (!activeRoot.value) return [];
  return subCategoriesMap[activeRoot.value] || [];
});

const activeRootName = computed(() => {
  return topCategories.find(c => c.key === activeRoot.value)?.name || "";
});

const currentTabName = computed(() => {
  // Try to find in top first
  const top = topCategories.find(c => c.key === currentTab.value);
  if (top) return top.name;
  
  // Try sub categories
  for (const key in subCategoriesMap) {
    const sub = subCategoriesMap[key].find(s => s.key === currentTab.value);
    if (sub) return sub.name;
  }
  return "分类";
});

async function loadHomeData() {
  const pCode = "library";

  // Load Hot
  try {
    const resHot = await apiClient.get("/assets", { params: { projectCode: pCode, status: "approved", page: 1, pageSize: 8, orderBy: "download_desc" } });
    hotAssetsList.value = resHot.data.data.items;
  } catch (e) { console.error(e); }

  // Load New
  try {
    const resNew = await apiClient.get("/assets", { params: { projectCode: pCode, status: "approved", page: 1, pageSize: 8, orderBy: "created_desc" } });
    newAssetsList.value = resNew.data.data.items;
  } catch (e) { console.error(e); }
}

async function loadAssets() {
  loading.value = true;
  try {
    const pCode = "library";
    const params:any = { projectCode: pCode, status: "approved", page: page.value, pageSize: pageSize, orderBy: orderBy.value };
    if (keyword.value) params.keyword = keyword.value;
    
    if (currentTab.value) {
        // Backend uses categoryPath and adds % automatically
        params.categoryPath = currentTab.value;
    }

    const { data } = await apiClient.get("/assets", { params });
    assets.value = data.data.items;
    total.value = data.data.total;
  } catch(e) {
    console.error(e);
  } finally {
    loading.value = false;
  }
}

function onSearch() {
  isSearching.value = true;
  page.value = 1;
  loadAssets();
}

function handleHeaderSearch(kw: string) {
  keyword.value = kw;
  onSearch();
}

function switchTab(key: string) {
  const query: any = { ...route.query };
  if (key) {
    query.category = key;
  } else {
    delete query.category;
    delete query.keyword; // Clear keyword when going home
  }
  router.push({ query });
}

function applyTabChange(key: string) {
  currentTab.value = key;
  if (key === "") {
    isSearching.value = false;
    keyword.value = "";
    loadHomeData();
  } else {
    isSearching.value = true;
    page.value = 1;
    loadAssets();
  }
}

function resetHome() {
  switchTab("");
}

function viewAll(type: string) {
  isSearching.value = true;
  orderBy.value = type === 'hot' ? 'download_desc' : 'created_desc';
  loadAssets();
}

function showDetail(it: any) {
  router.push(`/store/assets/${it.id}`);
}

function isImage(it:any) {
  const ext = String(it.file_ext || "").toLowerCase();
  return ["png","jpg","jpeg","gif","webp","svg"].includes(ext);
}
function isAudio(it:any) {
  const ext = String(it.file_ext || "").toLowerCase();
  return ["mp3","wav","ogg"].includes(ext);
}
function is3D(it:any) {
  const ext = String(it.file_ext || "").toLowerCase();
  return ["gltf","glb"].includes(ext);
}
function fileUrl(it:any) {
  // Append token for preview
  return `${import.meta.env.VITE_API_BASE_URL}/assets/${it.id}/file?token=${authStore.token}`;
}
function formatDate(d: string) {
  return new Date(d).toLocaleDateString();
}

watch(() => route.query.category, (newVal) => {
  applyTabChange(String(newVal || ""));
});

onMounted(() => {
  if (authStore.token && !authStore.userInfo) {
    authStore.fetchUserInfo();
  }
  applyTabChange(String(route.query.category || ""));
});
</script>

<style scoped>
.store-container {
  min-height: 100vh;
  background: #f4f4f4;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

.store-header-nav-bg {
  background: #202020;
  padding: 0 20px;
}

.category-nav {
  display: flex;
  gap: 30px;
  max-width: 1200px;
  margin: 0 auto;
  height: 40px;
  align-items: center;
  font-size: 14px;
  color: #ccc;
  border-top: 1px solid #333;
}

.nav-item {
  cursor: pointer;
  padding: 0 5px;
  height: 100%;
  display: flex;
  align-items: center;
  border-bottom: 2px solid transparent;
  transition: all 0.2s;
}
.nav-item:hover {
  color: #fff;
}
.nav-item.active {
  color: #fff;
  border-bottom-color: #2196F3;
}

/* Sub Category Nav */
.sub-category-bg {
  background: #fff;
  border-bottom: 1px solid #ddd;
  padding: 0 20px;
}
.sub-category-nav {
  display: flex;
  gap: 20px;
  max-width: 1200px;
  margin: 0 auto;
  height: 40px;
  align-items: center;
  font-size: 13px;
  color: #666;
}
.sub-nav-item {
  cursor: pointer;
  padding: 4px 10px;
  border-radius: 14px;
  transition: all 0.2s;
}
.sub-nav-item:hover {
  color: #2196F3;
  background: #f0f9ff;
}
.sub-nav-item.active {
  color: #fff;
  background: #2196F3;
}

.store-main {
  max-width: 1200px;
  margin: 20px auto;
  padding: 0 20px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 30px;
  margin-bottom: 15px;
}
.section-header h2 {
  font-size: 22px;
  color: #333;
  font-weight: 600;
}

.asset-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 20px;
}

.asset-card {
  background: #fff;
  border-radius: 6px;
  overflow: hidden;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
  border: 1px solid #eee;
}
.asset-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 16px rgba(0,0,0,0.1);
}

.card-thumb {
  height: 160px;
  background: #eef;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}
.card-thumb .el-image {
  width: 100%;
  height: 100%;
}
.audio-placeholder, .generic-placeholder {
  color: #99a;
}
.file-type-badge {
  position: absolute;
  bottom: 4px;
  right: 4px;
  background: rgba(0,0,0,0.6);
  color: #fff;
  padding: 2px 6px;
  font-size: 10px;
  border-radius: 4px;
  text-transform: uppercase;
}
.new-badge {
  position: absolute;
  top: 8px;
  left: 8px;
  background: #ff4757;
  color: #fff;
  padding: 2px 8px;
  font-size: 10px;
  border-radius: 4px;
  font-weight: bold;
}

.card-info {
  padding: 12px;
}
.card-title {
  font-weight: 600;
  font-size: 15px;
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: #333;
}
.card-meta {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #888;
  margin-bottom: 8px;
}
.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 8px;
}
.price {
  font-weight: bold;
  color: #4CAF50;
}

/* Pagination */
.pagination-row {
  margin-top: 30px;
  display: flex;
  justify-content: center;
}
</style>
