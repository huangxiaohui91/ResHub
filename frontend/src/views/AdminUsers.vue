<template>
  <div class="store-container">
    <StoreHeader :show-search="false" />
    <div class="store-header-nav-bg">
      <div class="category-nav">
        <div class="nav-title">账号管理</div>
      </div>
    </div>
    <div class="store-main">
      <el-page-header content="返回首页" @back="goBack" style="margin-bottom: 24px;" />
      
      <el-card shadow="hover">
        <div style="margin-bottom: 20px; display:flex; justify-content:space-between; align-items:center;">
          <span style="font-size:16px; font-weight:600;">用户列表</span>
          <el-button type="primary" @click="openCreate">新建用户</el-button>
        </div>
        
        <el-table :data="users" style="width:100%;" stripe>
          <el-table-column prop="username" label="用户名" />
          <el-table-column prop="real_name" label="姓名" />
          <el-table-column prop="system_role" label="系统角色">
             <template #default="scope">
               <el-tag :type="scope.row.system_role==='super_admin'?'danger':(scope.row.system_role==='admin'?'warning':'info')">
                 {{ scope.row.system_role }}
               </el-tag>
             </template>
          </el-table-column>
          <el-table-column prop="email" label="邮箱" />
          <el-table-column label="操作" width="220" fixed="right">
            <template #default="scope">
              <el-button size="small" @click="openEdit(scope.row)">编辑</el-button>
              <el-button size="small" type="danger" @click="doDelete(scope.row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-card>

      <el-dialog v-model="show" :title="editing ? '编辑用户' : '新建用户'" width="500">
        <el-form :model="form" label-width="80px">
          <el-form-item label="用户名">
            <el-input v-model="form.username" :disabled="editing" />
          </el-form-item>
          <el-form-item v-if="!editing" label="密码">
            <el-input v-model="form.password" type="password" />
          </el-form-item>
          <el-form-item label="姓名">
            <el-input v-model="form.realName" />
          </el-form-item>
          <el-form-item label="系统角色">
            <el-select v-model="form.systemRole" placeholder="选择角色" style="width:100%">
              <el-option label="超级管理员" value="super_admin" />
              <el-option label="管理员" value="admin" />
              <el-option label="普通用户" value="user" />
            </el-select>
          </el-form-item>
          <el-form-item label="项目分配">
            <div style="display:flex; gap:8px; width:100%">
              <el-input v-model="form.projectCode" placeholder="项目代码，如 ax" style="flex:1" />
              <el-select v-model="form.projectRole" placeholder="项目角色" style="width:120px">
                <el-option label="管理员" value="manager" />
                <el-option label="开发者" value="developer" />
                <el-option label="查看者" value="viewer" />
              </el-select>
            </div>
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
import { useRouter } from "vue-router";
import { listUsers, createUser, updateUser, deleteUser } from "../api/admin";
import StoreHeader from "../components/StoreHeader.vue";

const router = useRouter();
const users = ref<any[]>([]);
const error = ref("");
const show = ref(false);
const editing = ref(false);
const form = reactive<{ id?: number; username: string; password: string; realName?: string; systemRole: string; projectCode?: string; projectRole?: string }>({
  username: "",
  password: "",
  realName: "",
  systemRole: "user",
  projectCode: "",
  projectRole: "viewer"
});

function goBack() {
  router.push("/");
}

async function load() {
  error.value = "";
  try {
    users.value = await listUsers();
  } catch (e:any) {
    error.value = e?.message || "加载失败";
  }
}

function openCreate() {
  editing.value = false;
  Object.assign(form, { id: undefined, username: "", password: "", realName: "", systemRole: "user", projectCode: "", projectRole: "viewer" });
  show.value = true;
}

function openEdit(row: any) {
  editing.value = true;
  Object.assign(form, { id: row.id, username: row.username, password: "", realName: row.real_name, systemRole: row.system_role, projectCode: "", projectRole: "viewer" });
  show.value = true;
}

async function submit() {
  error.value = "";
  try {
    if (editing.value && form.id) {
      await updateUser(form.id, { realName: form.realName, systemRole: form.systemRole });
    } else {
      await createUser({ username: form.username, password: form.password, realName: form.realName, systemRole: form.systemRole, projectCode: form.projectCode, projectRole: form.projectRole });
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
    await deleteUser(row.id);
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
