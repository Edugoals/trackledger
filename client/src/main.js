import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { loadAuthUser } from './auth'

await loadAuthUser()
createApp(App).use(router).mount('#app')
