import { createRouter, createWebHistory } from "vue-router";
import Login from "../views/Login.vue";
import Dashboard from "../views/Dashboard.vue";
import Assets from "../views/Assets.vue";
import AdminUsers from "../views/AdminUsers.vue";
import AdminCategories from "../views/AdminCategories.vue";
import CategoryHome from "../views/CategoryHome.vue";
import AssetDetail from "../views/AssetDetail.vue";
import Reviews from "../views/Reviews.vue";

const routes = [
  { path: "/login", component: Login, meta: { requiresAuth: false } },
  { path: "/", component: CategoryHome, meta: { requiresAuth: true } },
  { path: "/store/assets/:id", component: AssetDetail, meta: { requiresAuth: true } },
  { path: "/dashboard", component: Dashboard, meta: { requiresAuth: true } },
  { path: "/assets/:projectCode?", component: Assets, meta: { requiresAuth: true } },
  { path: "/admin/users", component: AdminUsers, meta: { requiresAuth: true } },
  { path: "/admin/categories/:projectCode?", component: AdminCategories, meta: { requiresAuth: true } },
  { path: "/reviews", component: Reviews, meta: { requiresAuth: true } }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

router.beforeEach((to, from, next) => {
  const requiresAuth = to.meta?.requiresAuth !== false;
  const token = localStorage.getItem("token") || "";
  if (requiresAuth && !token) {
    next({ path: "/login", query: { redirect: to.fullPath } });
    return;
  }
  next();
});

export default router;
