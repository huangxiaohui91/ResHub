<template>
  <div style="max-width: 360px; margin: 80px auto;">
    <el-card>
      <h2 style="text-align:center; margin-bottom: 16px;">ResHub 登录</h2>
      <el-form :model="form" @submit.prevent="onSubmit">
        <el-form-item>
          <el-input v-model="form.username" placeholder="用户名" />
        </el-form-item>
        <el-form-item>
          <el-input v-model="form.password" type="password" placeholder="密码" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="loading" style="width:100%" @click="onSubmit">登录</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
  <el-notification v-if="error" type="error" :title="'登录失败'" :message="error" />
</template>

<script setup lang="ts">
import { reactive, ref } from "vue";
import { useAuthStore } from "../stores/auth.store";
import { useRouter } from "vue-router";

const form = reactive({ username: "", password: "" });
const loading = ref(false);
const error = ref("");
const auth = useAuthStore();
const router = useRouter();

async function onSubmit() {
  error.value = "";
  loading.value = true;
  try {
    await auth.login(form);
    router.push("/");
  } catch (e: any) {
    error.value = e?.message || "登录失败";
  } finally {
    loading.value = false;
  }
}
</script>
