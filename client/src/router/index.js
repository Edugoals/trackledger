import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  { path: '/', redirect: '/projects' },
  { path: '/projects', name: 'projects', component: () => import('../views/ProjectsOverview.vue'), meta: { title: 'Projects' } },
  { path: '/projects/:projectId', name: 'project', component: () => import('../views/ProjectDetail.vue'), meta: { title: 'Project' } },
  { path: '/projects/:projectId/tracks/:trackId', name: 'track', component: () => import('../views/TrackScreen.vue'), meta: { title: 'Track' } },
  { path: '/customers', name: 'customers', component: () => import('../views/CustomersView.vue'), meta: { title: 'Customers' } },
  { path: '/tasks', name: 'tasks', component: () => import('../views/TasksView.vue'), meta: { title: 'Task Library' } },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.afterEach((to) => {
  document.title = to.meta?.title ? `${to.meta.title} · TrackLedger` : 'TrackLedger'
})

export default router
