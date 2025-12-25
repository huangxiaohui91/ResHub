<template>
  <div class="store-header">
    <div class="header-content">
      <div class="logo-area" @click="goHome">
        <span class="store-title">BBSY ResHub</span>
      </div>
      <div class="search-area">
        <el-input
          v-if="showSearch"
          v-model="localKeyword"
          placeholder="搜索资源..."
          class="store-search"
          size="large"
          @keyup.enter="onSearch"
        >
          <template #append>
            <el-button @click="onSearch">
              <el-icon><Search /></el-icon>
            </el-button>
          </template>
        </el-input>
      </div>
      <div class="user-area">
         <el-dropdown v-if="authStore.userInfo" trigger="click" @command="handleCommand">
          <span class="el-dropdown-link" style="color: #fff; cursor: pointer; display: flex; align-items: center;">
            {{ authStore.userInfo.username }}
            <el-icon class="el-icon--right"><ArrowDown /></el-icon>
          </span>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="assets">资源管理</el-dropdown-item>
              <el-dropdown-item command="categories">分类管理</el-dropdown-item>
              <el-dropdown-item command="users">账号管理</el-dropdown-item>
              <el-dropdown-item divided command="logout">退出登录</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <span v-else class="login-link" @click="router.push('/login')">登录</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "../stores/auth.store";
import { Search, ArrowDown } from "@element-plus/icons-vue";

const props = defineProps({
  showSearch: { type: Boolean, default: true },
  initialKeyword: { type: String, default: "" }
});
const emit = defineEmits(["search"]);

const router = useRouter();
const authStore = useAuthStore();
const localKeyword = ref(props.initialKeyword);

watch(() => props.initialKeyword, (val) => {
  localKeyword.value = val;
});

function goHome() {
  router.push("/");
}

function onSearch() {
  // If we are on home page (parent handles search), emit event
  // Otherwise, redirect to home with query
  if (router.currentRoute.value.path === "/") {
    emit("search", localKeyword.value);
  } else {
    router.push({ path: "/", query: { keyword: localKeyword.value } });
  }
}

function handleCommand(cmd: string) {
  switch (cmd) {
    case "assets":
      router.push("/assets");
      break;
    case "categories":
      router.push("/admin/categories");
      break;
    case "users":
      router.push("/admin/users");
      break;
    case "logout":
      authStore.logout();
      router.push("/login");
      break;
  }
}
</script>

<style scoped>
.store-header {
  background: #202020;
  color: #fff;
  padding: 0 20px;
}

.header-content {
  display: flex;
  align-items: center;
  height: 60px;
  max-width: 1200px;
  margin: 0 auto;
}

.logo-area {
  cursor: pointer;
  margin-right: 40px;
}

.store-title {
  font-size: 20px;
  font-weight: bold;
  color: #fff;
}

.search-area {
  flex: 1;
  max-width: 600px;
}
.store-search :deep(.el-input__wrapper) {
  background-color: #333;
  box-shadow: none;
  border: 1px solid #444;
  color: #fff;
}
.store-search :deep(.el-input__inner) {
  color: #fff;
}

.user-area {
  margin-left: auto; /* Push to right */
}
.login-link {
  color: #aaa; 
  cursor: pointer;
}
.login-link:hover {
  color: #fff;
}
</style>
