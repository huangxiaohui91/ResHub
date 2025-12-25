<template>
  <div style="padding:16px;">
    <el-page-header content="审核记录与批注" @back="goBack" />
    <div style="margin:12px 0; display:flex; gap:8px;">
      <el-input v-model="assetIdInput" placeholder="资产ID" style="width:220px" />
      <el-button type="primary" @click="load">加载记录</el-button>
    </div>
    <el-card>
      <el-timeline>
        <el-timeline-item v-for="r in rows" :key="r.id" :timestamp="formatTs(r.created_at)" placement="top">
          <div>
            <div>状态：{{ r.from_status }} → {{ r.to_status }}</div>
            <div>申请人：{{ r.applicant_name || r.applicant_id }} 审核人：{{ r.reviewer_name || r.reviewer_id }}</div>
            <div>批注：{{ r.comment || '—' }}</div>
          </div>
        </el-timeline-item>
      </el-timeline>
    </el-card>
    <el-card style="margin-top:12px;">
      <template #header>添加批注</template>
      <div style="display:flex; gap:8px;">
        <el-input v-model="comment" placeholder="输入批注" />
        <el-button type="primary" @click="submit">提交</el-button>
      </div>
    </el-card>
    <el-notification v-if="error" type="error" :title="'操作失败'" :message="error" />
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useRouter, useRoute } from "vue-router";
import { listReviews, addReviewComment } from "../api/assets";

const router = useRouter();
const route = useRoute();
const assetIdInput = ref(String(route.query.assetId || ""));
const rows = ref<any[]>([]);
const comment = ref("");
const error = ref("");

function formatTs(ts:any) {
  try {
    const d = new Date(ts);
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString()}`;
  } catch {
    return String(ts);
  }
}

async function load() {
  error.value = "";
  try {
    const idNum = Number(assetIdInput.value);
    if (!idNum) throw new Error("资产ID无效");
    rows.value = await listReviews(idNum);
  } catch (e:any) {
    error.value = e?.message || "加载失败";
  }
}

async function submit() {
  error.value = "";
  try {
    const idNum = Number(assetIdInput.value);
    if (!idNum) throw new Error("资产ID无效");
    await addReviewComment(idNum, comment.value);
    comment.value = "";
    await load();
  } catch (e:any) {
    error.value = e?.message || "提交失败";
  }
}

function goBack() {
  router.back();
}
</script>
