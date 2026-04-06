import { createRouter, createWebHistory } from 'vue-router'
import { authUser } from '../auth'

const routes = [
  { path: '/login', name: 'login', component: () => import('../views/LoginView.vue'), meta: { title: 'Inloggen', public: true } },
  { path: '/register', name: 'register', component: () => import('../views/RegisterView.vue'), meta: { title: 'Registreren', public: true } },
  { path: '/', redirect: (to) => ({ path: '/projects', query: to.query }) },
  { path: '/projects', name: 'projects', component: () => import('../views/ProjectsOverview.vue'), meta: { title: 'Projects' } },
  { path: '/planning', name: 'planning', component: () => import('../views/PlanningView.vue'), meta: { title: 'Planning' } },
  { path: '/projects/:projectId', name: 'project', component: () => import('../views/ProjectDetail.vue'), meta: { title: 'Project' } },
  {
    path: '/projects/:projectId/tracks/:trackId/agreement/:agreementId',
    name: 'trackAgreementSnapshot',
    component: () => import('../views/TrackAgreementView.vue'),
    meta: { title: 'Overeenkomst (versie)' },
  },
  { path: '/projects/:projectId/tracks/:trackId/agreement', name: 'trackAgreement', component: () => import('../views/TrackAgreementView.vue'), meta: { title: 'Projectovereenkomst' } },
  { path: '/projects/:projectId/tracks/:trackId', name: 'track', component: () => import('../views/TrackScreen.vue'), meta: { title: 'Track' } },
  { path: '/customers', name: 'customers', component: () => import('../views/CustomersView.vue'), meta: { title: 'Customers' } },
  { path: '/tasks', name: 'tasks', component: () => import('../views/TasksView.vue'), meta: { title: 'Task Library' } },
  { path: '/share/track/:token', name: 'trackShare', component: () => import('../views/TrackShareView.vue'), meta: { title: 'Gedeeld plan', public: true } },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach((to) => {
  if (to.meta.public) {
    if (authUser.value && (to.name === 'login' || to.name === 'register')) {
      return { path: '/projects' }
    }
    return true
  }
  if (!authUser.value) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }
  return true
})

router.afterEach((to) => {
  document.title = to.meta?.title ? `${to.meta.title} · TrackLedger` : 'TrackLedger'
})

export default router
