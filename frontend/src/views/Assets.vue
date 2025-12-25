<template>
  <div class="store-container">
    <StoreHeader :show-search="false" />
    <div class="store-header-nav-bg">
      <div class="category-nav">
        <div class="nav-title">资源管理</div>
      </div>
    </div>
    <div class="store-main">
      <el-page-header content="返回首页" @back="goBack" style="margin-bottom: 24px;" />
      
      <el-card shadow="hover" style="margin-bottom: 24px;">
        <template #header>
          <div class="card-header">
            <span>上传资源</span>
            <el-button size="small" type="primary" plain @click="showBatchDialog=true">批量上传</el-button>
          </div>
        </template>
        <el-form :model="form" inline @submit.prevent="onUpload">
          <el-form-item label="文件">
            <el-upload drag :auto-upload="false" :limit="1" :on-change="onFileChange" class="mini-upload">
               <div style="padding: 20px 0">Drop file here or <em>click to upload</em></div>
            </el-upload>
          </el-form-item>
          <el-form-item label="显示名称">
            <el-input v-model="form.displayName" style="width: 220px" />
          </el-form-item>
          <el-form-item label="分类">
            <el-select v-model="form.categoryPath" placeholder="选择分类" filterable style="width: 200px">
              <el-option v-for="c in baseCategories" :key="c.path" :label="c.name + ' / ' + c.path" :value="c.path" />
            </el-select>
          </el-form-item>
          <el-form-item label="标签">
            <el-select v-model="form.tags" multiple filterable allow-create default-first-option style="width: 240px">
              <el-option v-for="t in tagOptions" :key="t" :label="t" :value="t" />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" :loading="uploading" @click="onUpload">上传</el-button>
          </el-form-item>
        </el-form>
      </el-card>

      <el-card shadow="hover" style="margin-bottom: 24px;">
        <template #header>检索</template>
        <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
          <el-select v-model="filterPrimary" placeholder="一级分类" style="width: 140px" clearable @change="filterSecondary = ''">
            <el-option v-for="p in primaryOptions" :key="p.value" :label="p.label" :value="p.value" />
          </el-select>
          <el-select v-model="filterSecondary" placeholder="二级分类" style="width: 160px" clearable :disabled="!filterPrimary">
            <el-option v-for="c in secondaryOptions" :key="c.path" :label="c.name" :value="c.path" />
          </el-select>
          <el-select v-model="filterTag" placeholder="标签" filterable style="width: 140px" clearable>
            <el-option label="全部" value="" />
            <el-option v-for="t in allTags" :key="t" :label="t" :value="t" />
          </el-select>
          <el-input v-model="keyword" placeholder="文件名/标签" style="width: 200px" />
          <el-select v-model="status" placeholder="状态" style="width: 120px" clearable>
            <el-option label="待审核" value="under_review" />
            <el-option label="草稿" value="draft" />
            <el-option label="已批准" value="approved" />
            <el-option label="已驳回" value="rejected" />
          </el-select>
          <el-button type="primary" @click="loadList">查询</el-button>
        </div>
      </el-card>

      <el-card shadow="hover">
        <template #header>资源列表</template>
        <el-table :data="items" style="width: 100%" stripe>
          <el-table-column label="预览" width="160">
            <template #default="scope">
              <div class="preview-box">
                <img v-if="isImage(scope.row)" :src="fileUrl(scope.row)" />
                <audio v-else-if="isAudio(scope.row)" :src="fileUrl(scope.row)" controls style="width:100%; height: 30px;"></audio>
                <model-viewer v-else-if="is3D(scope.row)" :src="fileUrl(scope.row)" auto-rotate camera-controls style="width:100%; height:100%; background-color: #f0f0f0;"></model-viewer>
                <div v-else-if="isUnity(scope.row)" class="file-icon unity"><el-icon size="24"><Box /></el-icon><span class="ext">UNITY</span></div>
                <div v-else class="file-icon"><el-icon size="24"><Document /></el-icon><span class="ext">{{ extOf(scope.row.standard_filename) }}</span></div>
              </div>
            </template>
          </el-table-column>
          <el-table-column prop="display_name" label="名称" min-width="150" show-overflow-tooltip />
          <el-table-column prop="standard_filename" label="标准名" min-width="150" show-overflow-tooltip />
          <el-table-column prop="status" label="状态" width="100">
            <template #default="scope">
              <el-tag :type="statusTag(scope.row.status)">{{ scope.row.status }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="tag_names" label="标签" min-width="120" show-overflow-tooltip />
          <el-table-column label="操作" width="320" fixed="right">
            <template #default="scope">
              <el-button link type="primary" size="small" @click="copyPath(scope.row.storage_path)">复制路径</el-button>
              <el-button link type="primary" size="small" @click="doDownload(scope.row)">下载</el-button>
              <el-button link type="primary" size="small" @click="openEditDialog(scope.row)">编辑</el-button>
              <el-button link type="danger" size="small" @click="doDelete(scope.row)">删除</el-button>
              <el-button link type="primary" size="small" @click="openVersionDialog(scope.row)">更新</el-button>
              <el-divider direction="vertical" />
              <template v-if="scope.row.status!=='under_review'">
                 <el-button link type="warning" size="small" @click="submitForReview(scope.row)">提交审核</el-button>
              </template>
              <template v-else>
                 <el-button link type="success" size="small" @click="doApprove(scope.row)">批准</el-button>
                 <el-button link type="danger" size="small" @click="doReject(scope.row)">驳回</el-button>
              </template>
            </template>
          </el-table-column>
        </el-table>
        <div style="display:flex; justify-content:flex-end; margin-top:20px;">
          <el-pagination
            background
            layout="prev, pager, next, sizes, total"
            :total="total"
            v-model:current-page="page"
            v-model:page-size="pageSize"
            @current-change="loadList"
            @size-change="loadList"
          />
        </div>
      </el-card>

      <el-alert v-if="error" type="error" :title="error" show-icon closable style="margin-top:20px;" />
      <el-alert v-if="success" type="success" :title="success" show-icon closable style="margin-top:20px;" />
    </div>

    <!-- Dialogs -->
    <el-dialog v-model="showVersionDialog" title="上传新版本" width="520">
      <el-upload :auto-upload="false" :limit="1" :on-change="(f:any)=>versionFile=f?.raw||null" drag>
         <div class="el-upload__text">Drop file here or <em>click to upload</em></div>
      </el-upload>
      <el-input v-model="changeLog" placeholder="变更说明" style="margin-top:12px" type="textarea" />
      <template #footer>
        <el-button @click="showVersionDialog=false">取消</el-button>
        <el-button type="primary" @click="submitVersion">上传</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showEditDialog" title="编辑资源" width="500">
      <el-form :model="editForm" label-width="80px">
        <el-form-item label="名称">
          <el-input v-model="editForm.displayName" />
        </el-form-item>
        <el-form-item label="分类">
          <el-select v-model="editForm.categoryPath" filterable style="width: 100%">
            <el-option v-for="c in baseCategories" :key="c.path" :label="c.name + ' / ' + c.path" :value="c.path" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="editForm.status" style="width: 100%">
            <el-option label="待审核" value="under_review" />
            <el-option label="草稿" value="draft" />
            <el-option label="已批准" value="approved" />
            <el-option label="已驳回" value="rejected" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showEditDialog=false">取消</el-button>
        <el-button type="primary" @click="submitEdit">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showBatchDialog" title="批量上传" width="800">
      <div style="display:flex; gap:20px;">
        <div style="flex:1;">
          <el-upload multiple :auto-upload="false" :on-change="onBatchAdd" :on-remove="onBatchRemove" :file-list="batchFiles" drag>
            <div class="el-upload__text">Drop files here or <em>click to upload</em></div>
          </el-upload>
          <div style="margin-top:16px;">
            <el-select v-model="batchCategoryPath" placeholder="统一分类（可选）" filterable style="width:100%;">
              <el-option v-for="c in baseCategories" :key="c.path" :label="c.name + ' / ' + c.path" :value="c.path" />
            </el-select>
            <el-select v-model="batchTags" multiple filterable allow-create style="width:100%; margin-top:12px;">
              <el-option v-for="t in tagOptions" :key="t" :label="t" :value="t" />
            </el-select>
            <div style="margin-top:12px;">
              <el-checkbox v-model="batchAutoApprove">自动通过审核</el-checkbox>
            </div>
          </div>
        </div>
        <div style="flex:1; max-height: 400px; overflow-y: auto;">
          <el-table :data="batchProgress" size="small" border>
            <el-table-column prop="name" label="文件" show-overflow-tooltip />
            <el-table-column label="进度" width="100">
              <template #default="scope">
                <el-progress :percentage="scope.row.progress" :status="scope.row.status" />
              </template>
            </el-table-column>
          </el-table>
        </div>
      </div>
      <template #footer>
        <el-button @click="showBatchDialog=false">关闭</el-button>
        <el-button type="primary" :loading="batchUploading" @click="startBatchUpload">开始上传</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useProjectStore } from "../stores/project.store";
import { useAuthStore } from "../stores/auth.store";
import { listCategories } from "../api/admin";
import { listAssets, uploadAsset, approveAsset, rejectAsset, uploadVersion, updateAsset, deleteAsset, listTags } from "../api/assets";
import StoreHeader from "../components/StoreHeader.vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { Document, Box, Headset, Picture, VideoPlay } from '@element-plus/icons-vue';
import '@google/model-viewer';

function extOf(name:string) { return String(name||"").split(".").pop()?.toLowerCase()||"" }

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
function isUnity(it:any) {
  const ext = String(it.file_ext || "").toLowerCase();
  return ["unitypackage"].includes(ext);
}

const route = useRoute();
const router = useRouter();
const project = useProjectStore();
const authStore = useAuthStore();

function goBack() {
  router.push("/");
}

function fileUrl(it:any) {
  return `${import.meta.env.VITE_API_BASE_URL}/assets/${it.id}/file?token=${authStore.token}`;
}

const projectCode = ref<string>("library");
const keyword = ref("");
const filterPrimary = ref("");
const filterSecondary = ref("");
const status = ref<string | undefined>("");
const items = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const error = ref("");
const success = ref("");
const tagOptions = ref<string[]>([]);
const filterTag = ref("");
const allTags = ref<string[]>([]);
const showEditDialog = ref(false);
const editForm = reactive({ id: 0, displayName: "", categoryPath: "", status: "" });

const form = reactive<{ file: File | null; displayName: string; categoryPath: string; tags: string[]; relatedProjects: string[] }>({
  file: null,
  displayName: "",
  categoryPath: "",
  tags: [],
  relatedProjects: []
});
const uploading = ref(false);
const showBatchDialog = ref(false);
const batchFiles = ref<any[]>([]);
const batchCategoryPath = ref("");
const batchTags = ref<string[]>([]);
const batchAutoApprove = ref(false);
const batchProgress = ref<Array<{ name: string; progress: number; status?: string }>>([]);
const batchUploading = ref(false);
const categories = ref<any[]>([]);
const defaultSecondary = [
  { name: "UI界面", path: "art/ui" },
  { name: "角色", path: "art/character" },
  { name: "场景", path: "art/scene" },
  { name: "模型", path: "art/model" },
  { name: "动作", path: "art/animation" },
  { name: "特效", path: "art/vfx" },
  { name: "BGM", path: "audio/bgm" },
  { name: "音效", path: "audio/sfx" },
  { name: "语音", path: "audio/voice" },
  { name: "插件", path: "plugins" }
];
const baseCategories = computed(() => (categories.value && categories.value.length ? categories.value : defaultSecondary));

const primaryOptions = computed(() => {
  const s = new Set<string>();
  baseCategories.value.forEach((c: any) => {
    const p = c.path.split('/')[0];
    if (p) s.add(p);
  });
  return Array.from(s).map(p => {
    const labelMap: Record<string, string> = {
      'art': '美术资源',
      'audio': '音频资源',
      'plugins': '插件工具',
      'docs': '文档'
    };
    return { label: labelMap[p] || p.toUpperCase(), value: p };
  });
});

const secondaryOptions = computed(() => {
  if (!filterPrimary.value) return [];
  return baseCategories.value.filter((c: any) => c.path.startsWith(filterPrimary.value + '/'));
});

function isAllowedExt(ext:string) { return ["png","jpg","jpeg","gif","webp","svg","mp3","wav","ogg","gltf","glb","unitypackage"].includes(ext) }
function onFileChange(file: any) {
  const raw = file?.raw || null;
  if (!raw) { form.file = null; return }
  const ext = extOf(file?.name||raw?.name||"");
  if (!isAllowedExt(ext)) { error.value = "不支持的文件类型"; form.file=null; return }
  form.file = raw;
  if (!form.displayName && file?.name) form.displayName = file.name;
}

async function loadList() {
  error.value = "";
  try {
    let catPath = undefined;
    if (filterSecondary.value) catPath = filterSecondary.value;
    else if (filterPrimary.value) catPath = filterPrimary.value;

    const data = await listAssets({
      projectCode: projectCode.value,
      keyword: keyword.value || undefined,
      categoryPath: catPath,
      status: status.value || undefined,
      tag: filterTag.value || undefined,
      page: page.value,
      pageSize: pageSize.value
    });
    items.value = data.items || data;
    total.value = Number(data.total || items.value.length || 0);
    const tags = new Set<string>();
    for (const it of items.value) {
      String(it.tag_names || "")
        .split(",")
        .filter(Boolean)
        .forEach((t: string) => tags.add(t));
    }
    tagOptions.value = Array.from(tags);
    success.value = "";
  } catch (e: any) {
    error.value = e?.message || "加载失败";
  }
}

async function onUpload() {
  error.value = "";
  success.value = "";
  if (!form.file || !projectCode.value) {
    error.value = "请选择项目与文件";
    return;
  }
  if (!form.categoryPath) {
    error.value = "请选择分类";
    return;
  }
  uploading.value = true;
  try {
    let thumb: Blob | undefined = undefined;
    const ext = extOf(form.file.name);
    if (["png","jpg","jpeg","gif","webp","svg"].includes(ext)) {
      thumb = await genThumb(form.file);
    }
    const created = await uploadAsset(
      {
        file: form.file,
        projectCode: projectCode.value,
        categoryPath: form.categoryPath,
        displayName: form.displayName,
        tags: form.tags,
        thumb
      },
      {
        onUploadProgress: (p: any) => {
          // progress UI available for future extension
        }
      }
    );
    success.value = `上传成功：${created.standard_filename}`;
    form.file = null;
    form.displayName = "";
    form.categoryPath = "";
    form.tags = [];
    form.relatedProjects = [];
    await loadList();
  } catch (e: any) {
    error.value = e?.message || "上传失败";
  } finally {
    uploading.value = false;
  }
}
function genThumb(file: File): Promise<Blob> {
  return new Promise((resolve) => {
    const img = new Image();
    const fr = new FileReader();
    fr.onload = () => {
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const size = 256;
        canvas.width = size; canvas.height = size;
        const ctx = canvas.getContext("2d")!;
        const ratio = Math.min(size / img.width, size / img.height);
        const w = img.width * ratio; const h = img.height * ratio;
        const x = (size - w) / 2; const y = (size - h) / 2;
        ctx.clearRect(0,0,size,size);
        ctx.drawImage(img, x, y, w, h);
        canvas.toBlob((b) => resolve(b || new Blob()), "image/png");
      };
      img.src = String(fr.result);
    };
    fr.readAsDataURL(file);
  });
}

function onBatchAdd(file:any, fileList:any[]) {
  batchFiles.value = fileList;
  batchProgress.value = fileList.map(f => ({ name: f.name, progress: 0 }));
}
function onBatchRemove(file:any, fileList:any[]) {
  batchFiles.value = fileList;
  batchProgress.value = fileList.map(f => ({ name: f.name, progress: 0 }));
}
async function startBatchUpload() {
  if (!projectCode.value || batchFiles.value.length === 0) {
    error.value = "请选择项目与文件";
    return;
  }
  batchUploading.value = true;
  for (let i = 0; i < batchFiles.value.length; i++) {
    const f = batchFiles.value[i];
    try {
      await uploadAsset(
        {
          file: f.raw,
          projectCode: projectCode.value,
          categoryPath: batchCategoryPath.value || form.categoryPath || "",
          displayName: f.name,
          tags: batchTags.value,
          status: batchAutoApprove.value ? "approved" : "under_review"
        },
        {
          onUploadProgress: (p: any) => {
            const pct = p.total ? Math.floor((p.loaded / p.total) * 100) : 0;
            batchProgress.value[i].progress = pct;
          }
        }
      );
      batchProgress.value[i].progress = 100;
      batchProgress.value[i].status = "success";
    } catch (e:any) {
      batchProgress.value[i].status = "exception";
    }
  }
  batchUploading.value = false;
  await loadList();
}

async function copyPath(path: string) {
  try {
    await navigator.clipboard.writeText(path);
    ElMessage.success("路径已复制");
  } catch (e) {
    ElMessage.error("复制失败");
  }
}

async function doApprove(row: any) {
  try {
    await approveAsset(row.id);
    success.value = "已批准";
    await loadList();
  } catch (e: any) {
    error.value = e?.message || "操作失败";
  }
}

async function doReject(row: any) {
  try {
    await rejectAsset(row.id);
    success.value = "已驳回";
    await loadList();
  } catch (e: any) {
    error.value = e?.message || "操作失败";
  }
}

async function submitForReview(row: any) {
  try {
    await updateAsset(row.id, { status: "under_review" });
    success.value = "已提交审核";
    await loadList();
  } catch (e:any) {
    error.value = e?.message || "提交失败";
  }
}

async function doDownload(row: any) {
  try {
    const resp = await fetch(`${import.meta.env.VITE_API_BASE_URL}/assets/${row.id}/download`, {
      headers: { Authorization: `Bearer ${authStore.token}` }
    });
    if (!resp.ok) throw new Error("下载失败");
    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = row.standard_filename;
    a.click();
    URL.revokeObjectURL(url);
  } catch (e: any) {
    error.value = e?.message || "下载失败";
  }
}

function openEditDialog(row: any) {
  editForm.id = row.id;
  editForm.displayName = row.display_name;
  editForm.categoryPath = row.category_path;
  editForm.status = row.status;
  showEditDialog.value = true;
}

async function submitEdit() {
  try {
    await updateAsset(editForm.id, {
      displayName: editForm.displayName,
      categoryPath: editForm.categoryPath,
      status: editForm.status
    });
    ElMessage.success("修改成功");
    showEditDialog.value = false;
    await loadList();
  } catch (e: any) {
    ElMessage.error(e?.message || "修改失败");
  }
}

async function doDelete(row: any) {
  try {
    await ElMessageBox.confirm(`确定要删除 ${row.standard_filename} 吗？`, "警告", {
      confirmButtonText: "确定",
      cancelButtonText: "取消",
      type: "warning"
    });
    await deleteAsset(row.id);
    ElMessage.success("删除成功");
    await loadList();
  } catch (e: any) {
    if (e !== "cancel") {
      ElMessage.error(e?.message || "删除失败");
    }
  }
}

const showVersionDialog = ref(false);
const versionFile = ref<File|null>(null);
const changeLog = ref("");
let currentAssetId = 0;

function openVersionDialog(row: any) {
  currentAssetId = row.id;
  versionFile.value = null;
  changeLog.value = "";
  showVersionDialog.value = true;
}

async function submitVersion() {
  if (!versionFile.value) {
    error.value = "请选择文件";
    return;
  }
  try {
    await uploadVersion(currentAssetId, versionFile.value, changeLog.value);
    success.value = "新版本已上传";
    showVersionDialog.value = false;
    await loadList();
  } catch (e: any) {
    error.value = e?.message || "上传失败";
  }
}

function onProjectChange(code: string) {
  project.setCurrent(code);
  router.replace(`/assets/${code}`);
  loadList();
  loadCategories();
  loadTags();
}

function statusTag(s:string) {
  if(s==='approved') return 'success';
  if(s==='rejected') return 'danger';
  if(s==='draft') return 'info';
  return 'warning';
}

onMounted(async () => {
  if (!project.projects.length) {
    try {
      await project.load();
    } catch (e: any) {
      error.value = e?.message || "加载项目失败";
    }
  }
  if (!projectCode.value) projectCode.value = project.currentCode;
  if (!projectCode.value && project.projects.length) projectCode.value = project.projects[0].code;
  if (route.query.status) status.value = String(route.query.status);
  if (projectCode.value) {
    await loadCategories();
    await loadList();
    try {
      const tags = await listTags(projectCode.value);
      allTags.value = tags.map((t:any) => t.name);
    } catch (e) { console.error(e) }
  }
});

async function loadCategories() {
  try {
    categories.value = await listCategories(projectCode.value);
  } catch (e:any) {
    // ignore for now
  }
}

async function loadTags() {
  try {
    allTags.value = await listTags(projectCode.value);
  } catch (e:any) {
    // ignore
  }
}

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

.nav-title {
  color: #fff;
  font-weight: 600;
  font-size: 15px;
}

.store-main {
  max-width: 1200px;
  margin: 20px auto;
  padding: 0 20px 40px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.preview-box {
  width: 100px;
  height: 60px;
  background: #eee;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border-radius: 4px;
}
.preview-box img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.file-icon {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #666;
}
.file-icon .ext {
  font-size: 10px;
  margin-top: 2px;
  font-weight: bold;
  text-transform: uppercase;
}
.file-icon.unity {
  color: #000;
}
.no-preview {
  font-size: 10px;
  color: #999;
}
.mini-upload {
    width: 220px;
}
:deep(.el-upload-dragger) {
    padding: 10px;
    height: auto;
}
</style>
