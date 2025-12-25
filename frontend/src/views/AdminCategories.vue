<template>
  <div class="store-container">
    <StoreHeader :show-search="false" />
    <div class="store-header-nav-bg">
      <div class="category-nav">
        <div class="nav-title">分类管理</div>
      </div>
    </div>
    <div class="store-main">
      <el-page-header content="返回首页" @back="goBack" style="margin-bottom: 24px;" />
      
      <el-card shadow="hover">
        <div style="margin-bottom: 20px; display:flex; gap:12px; align-items:center;">
          <el-input v-model="projectCode" placeholder="项目代码，如 ax" style="width:220px" />
          <el-button type="primary" @click="load">加载分类</el-button>
          <el-button @click="openCreate">新建分类</el-button>
        </div>
        <el-table :data="items" style="width:100%;" stripe>
          <el-table-column prop="path" label="路径" />
          <el-table-column prop="name" label="名称" />
          <el-table-column prop="type" label="类型" />
          <el-table-column prop="parent_id" label="父ID" width="120" />
          <el-table-column label="操作" width="220" fixed="right">
            <template #default="scope">
              <el-button size="small" @click="openEdit(scope.row)">编辑</el-button>
              <el-button size="small" type="danger" @click="doDelete(scope.row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-card>

      <el-dialog v-model="show" :title="editing ? '编辑分类' : '新建分类'" width="500">
        <el-form :model="form" label-width="80px">
          <el-form-item label="路径">
            <el-input v-model="form.path" :disabled="editing" placeholder="例如 tex/ui" />
          </el-form-item>
          <el-form-item label="名称">
            <el-input v-model="form.name" placeholder="例如 UI界面" />
          </el-form-item>
          <el-form-item label="类型">
            <el-select v-model="form.type" style="width:100%">
              <el-option label="UI" value="ui" />
              <el-option label="角色" value="character" />
              <el-option label="模型" value="model" />
              <el-option label="动作" value="animation" />
              <el-option label="特效" value="vfx" />
              <el-option label="BGM" value="bgm" />
              <el-option label="音效" value="sfx" />
              <el-option label="语音" value="voice" />
              <el-option label="插件" value="plugin" />
              <el-option label="其他" value="raw" />
            </el-select>
          </el-form-item>
          <el-form-item label="父ID">
            <el-input v-model="form.parentId" placeholder="可选" />
          </el-form-item>
        </el-form>
        <template #footer>
          <el-button @click="show=false">取消</el-button>
          <el-button type="primary" @click="submit">{{ editing ? '保存' : '创建' }}</el-button>
        </template>
      </el-dialog>
      
      <el-notification v-if="error" type="error" :title="'操作失败'" :message="error" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from "vue";
import { listCategories, createCategory, updateCategory, deleteCategory } from "../api/admin";
import { useRoute, useRouter } from "vue-router";
import StoreHeader from "../components/StoreHeader.vue";

const route = useRoute();
const router = useRouter();
const projectCode = ref(String(route.params.projectCode || "ax"));
const items = ref<any[]>([]);
const error = ref("");
const show = ref(false);
const editing = ref(false);
const form = reactive<{ id?: number; path: string; name: string; type: string; parentId?: number | null }>({
  path: "",
  name: "",
  type: "raw",
  parentId: null
});

function goBack() {
  router.push("/");
}

async function load() {
  error.value = "";
  try {
    items.value = await listCategories(projectCode.value);
  } catch (e: any) {
    error.value = e?.message || "加载失败";
  }
}

function openCreate() {
  editing.value = false;
  Object.assign(form, { id: undefined, path: "", name: "", type: "raw", parentId: null });
  show.value = true;
}

function openEdit(row: any) {
  editing.value = true;
  Object.assign(form, { id: row.id, path: row.path, name: row.name, type: row.type, parentId: row.parent_id });
  show.value = true;
}

async function submit() {
  error.value = "";
  try {
    if (editing.value && form.id) {
      await updateCategory(form.id, { name: form.name, path: form.path, type: form.type, parentId: form.parentId ?? undefined });
    } else {
      await createCategory({ projectCode: projectCode.value, name: form.name, path: form.path, type: form.type, parentId: form.parentId ?? undefined });
    }
    show.value = false;
    await load();
  } catch (e:any) {
    error.value = e?.message || "提交失败";
  }
}

async function doDelete(row: any) {
  error.value = "";
  try {
    await deleteCategory(row.id);
    await load();
  } catch (e:any) {
    error.value = e?.message || "删除失败";
  }
}

onMounted(load);
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
</style>
