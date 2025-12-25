<template>
  <div class="asset-detail-page">
    <div v-if="loading" class="loading-container">
      <el-icon class="is-loading" :size="40"><Loading /></el-icon>
    </div>

    <div v-else-if="asset" class="content-container">
      <!-- Breadcrumb -->
      <div class="breadcrumb-bar" style="display: flex; align-items: center; gap: 10px;">
        <el-button link :icon="ArrowLeft" @click="goBack" style="font-size: 16px;">返回</el-button>
        <el-divider direction="vertical" />
        <el-breadcrumb separator="/">
          <el-breadcrumb-item :to="{ path: '/' }">商店</el-breadcrumb-item>
          <el-breadcrumb-item>{{ asset.category_path }}</el-breadcrumb-item>
          <el-breadcrumb-item>{{ asset.display_name }}</el-breadcrumb-item>
        </el-breadcrumb>
      </div>

      <!-- Main Content -->
      <div class="main-layout">
        <!-- Left Column: Preview & Description -->
        <div class="left-col">
          <div class="preview-box">
             <div v-if="isImage" class="image-preview">
                <el-image :src="fileUrl" fit="contain" :preview-src-list="[fileUrl]" />
             </div>
             <div v-else-if="is3D" class="model-preview" style="width:100%; height:100%;">
                <model-viewer :src="fileUrl" auto-rotate camera-controls style="width:100%; height:100%; background-color: #f5f7fa;"></model-viewer>
             </div>
             <div v-else-if="isAudio" class="audio-preview">
                <div class="audio-icon"><el-icon :size="64"><Headset /></el-icon></div>
                <audio :src="fileUrl" controls class="audio-player"></audio>
             </div>
             <div v-else-if="isVideo" class="video-preview" style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; background:#000;">
                <video :src="fileUrl" controls style="max-width:100%; max-height:100%;"></video>
             </div>
             <div v-else class="generic-preview">
                <el-icon :size="80"><Document /></el-icon>
                <p>该文件类型暂无预览。</p>
             </div>
          </div>

          <div class="asset-tabs">
            <el-tabs v-model="activeTab">
              <el-tab-pane label="概览" name="overview">
                <div class="tab-content">
                  <h3>描述</h3>
                  <p v-if="asset.meta_info">{{ getMetaDesc(asset.meta_info) || '暂无描述。' }}</p>
                  <p v-else>暂无描述。</p>
                  
                  <div class="tags-section">
                    <span class="tag-label">标签:</span>
                    <el-tag v-for="t in tags" :key="t" class="tag-item" effect="plain">{{ t }}</el-tag>
                  </div>
                </div>
              </el-tab-pane>
              <el-tab-pane label="版本历史" name="releases">
                <div class="tab-content">
                   <el-timeline>
                     <el-timeline-item
                       v-for="v in versions"
                       :key="v.version_number"
                       :timestamp="formatDate(v.created_at)"
                       placement="top"
                     >
                       <el-card>
                         <h4>版本 {{ v.version_number }}</h4>
                         <p>{{ v.change_log || '无更新日志' }}</p>
                       </el-card>
                     </el-timeline-item>
                   </el-timeline>
                </div>
              </el-tab-pane>
              <el-tab-pane label="评论" name="reviews">
                <div class="tab-content">
                  <div v-if="reviews.length === 0" class="no-reviews">暂无评论。</div>
                  <div v-else class="review-list">
                    <div v-for="r in reviews" :key="r.id" class="review-item">
                       <div class="review-header">
                         <span class="reviewer">{{ r.reviewer_name || '用户' }}</span>
                         <span class="review-date">{{ formatDate(r.created_at) }}</span>
                       </div>
                       <div class="review-body">{{ r.comment || '无内容。' }}</div>
                    </div>
                  </div>
                </div>
              </el-tab-pane>
            </el-tabs>
          </div>
        </div>

        <!-- Right Column: Info & Action -->
        <div class="right-col">
          <div class="info-card">
             <h1 class="asset-title">{{ asset.display_name }}</h1>
             <div class="publisher-info">
               <span class="by">贡献者: </span> <span class="publisher">{{ uploaderName }}</span>
             </div>
             
             <div class="price-tag">免费</div>
             
             <div class="action-buttons">
                <el-button type="primary" size="large" class="main-btn" @click="downloadAsset">
                  下载
                </el-button>
             </div>

             <div class="meta-list">
               <div class="meta-item">
                 <span class="label">文件大小</span>
                 <span class="value">{{ formatSize(asset.file_size) }}</span>
               </div>
               <div class="meta-item">
                 <span class="label">文件格式</span>
                 <span class="value">{{ asset.file_ext }}</span>
               </div>
               <div class="meta-item">
                 <span class="label">最新版本</span>
                 <span class="value">{{ asset.current_version }}</span>
               </div>
               <div class="meta-item">
                 <span class="label">原始文件名</span>
                 <span class="value" :title="asset.original_filename">{{ asset.original_filename }}</span>
               </div>
               <div class="meta-item">
                 <span class="label">上传日期</span>
                 <span class="value">{{ formatDate(asset.created_at) }}</span>
               </div>
             </div>
          </div>
        </div>
      </div>
    </div>
    
    <div v-else class="error-container">
      <el-empty description="资源未找到" />
      <el-button @click="$router.push('/')">返回商店</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { apiClient } from "../api/client";
import { useAuthStore } from "../stores/auth.store";
import { Loading, Headset, Document, ArrowLeft } from "@element-plus/icons-vue";

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const assetId = route.params.id;

const loading = ref(true);
const asset = ref<any>(null);
const versions = ref<any[]>([]);
const tags = ref<string[]>([]);
const reviews = ref<any[]>([]);
const activeTab = ref("overview");

const uploaderName = computed(() => {
    return asset.value?.uploader_name || `User #${asset.value?.uploader_id}`;
});

const isImage = computed(() => {
  if (!asset.value) return false;
  const ext = String(asset.value.file_ext || "").toLowerCase();
  return ["png","jpg","jpeg","gif","webp","svg"].includes(ext);
});

const is3D = computed(() => {
  if (!asset.value) return false;
  const ext = String(asset.value.file_ext || "").toLowerCase();
  return ["gltf","glb"].includes(ext);
});

const isAudio = computed(() => {
  if (!asset.value) return false;
  const ext = String(asset.value.file_ext || "").toLowerCase();
  return ["mp3","wav","ogg"].includes(ext);
});

const isVideo = computed(() => {
  if (!asset.value) return false;
  const ext = String(asset.value.file_ext || "").toLowerCase();
  return ["mp4","webm","ogg"].includes(ext);
});

const fileUrl = computed(() => {
   if (!asset.value) return "";
   // Append token for preview
   return `${import.meta.env.VITE_API_BASE_URL}/assets/${asset.value.id}/file?token=${authStore.token}`;
});

function goBack() {
  if (window.history.length > 1) {
    router.back();
  } else {
    router.push('/');
  }
}

async function loadData() {
  loading.value = true;
  try {
    // Fetch asset details
    const res = await apiClient.get(`/assets/${assetId}`);
    if (res.data.code === 200) {
       asset.value = res.data.data.asset;
       versions.value = res.data.data.versions;
       tags.value = res.data.data.tags;
       
       // Try to fetch reviews
       try {
         const revRes = await apiClient.get(`/assets/${assetId}/reviews`);
         if (revRes.data.code === 200) {
           reviews.value = revRes.data.data;
         }
       } catch (e) {
         // Reviews might fail or be empty, ignore
       }
    }
  } catch (e) {
    console.error(e);
  } finally {
    loading.value = false;
  }
}

function downloadAsset() {
  if (!asset.value) return;
  // Append token for download
  window.open(`${import.meta.env.VITE_API_BASE_URL}/assets/${asset.value.id}/download?token=${authStore.token}`, "_blank");
}

function formatDate(d: string) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString();
}

function formatSize(bytes: number) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function getMetaDesc(metaStr: string) {
    try {
        const m = JSON.parse(metaStr);
        return m.description || m.desc || "";
    } catch {
        return "";
    }
}

onMounted(() => {
  if (assetId) loadData();
});
</script>

<style scoped>
.asset-detail-page {
  min-height: 100vh;
  background: #f0f0f0;
  padding-bottom: 40px;
}

.loading-container {
  height: 400px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.content-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.breadcrumb-bar {
  margin-bottom: 20px;
}

.main-layout {
  display: flex;
  gap: 30px;
  align-items: flex-start;
}

.left-col {
  flex: 2;
  min-width: 0; /* fix flex overflow */
}

.right-col {
  flex: 1;
  min-width: 300px;
}

.preview-box {
  background: #000;
  border-radius: 8px;
  height: 400px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  margin-bottom: 20px;
}

.image-preview {
  width: 100%;
  height: 100%;
}
.image-preview .el-image {
  width: 100%;
  height: 100%;
}

.audio-preview {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  color: #fff;
  width: 100%;
}

.generic-preview {
  color: #888;
  text-align: center;
}

.asset-tabs {
  background: #fff;
  padding: 20px;
  border-radius: 8px;
  min-height: 300px;
}

.tab-content {
  padding: 10px 0;
  line-height: 1.6;
  color: #444;
}

.tags-section {
  margin-top: 30px;
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
}
.tag-label {
  font-weight: bold;
  color: #666;
}

.info-card {
  background: #fff;
  padding: 25px;
  border-radius: 8px;
  position: sticky;
  top: 20px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.05);
}

.asset-title {
  font-size: 24px;
  margin: 0 0 10px 0;
  color: #333;
}

.publisher-info {
  margin-bottom: 20px;
  color: #666;
}
.publisher-info .publisher {
  color: #2196F3;
  font-weight: 500;
}

.price-tag {
  font-size: 28px;
  font-weight: bold;
  color: #4CAF50;
  margin-bottom: 20px;
}

.main-btn {
  width: 100%;
  font-weight: bold;
  margin-bottom: 25px;
}

.meta-list {
  border-top: 1px solid #eee;
  padding-top: 20px;
}

.meta-item {
  display: flex;
  justify-content: space-between;
  margin-bottom: 12px;
  font-size: 14px;
}

.meta-item .label {
  color: #888;
}
.meta-item .value {
  color: #333;
  font-weight: 500;
  max-width: 60%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.error-container {
  padding: 100px;
  text-align: center;
}
</style>