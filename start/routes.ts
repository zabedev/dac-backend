/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
|
*/

import router from '@adonisjs/core/services/router'
import { middleware } from './kernel.js'
import transmit from '@adonisjs/transmit/services/main'

const AuthController = () => import('#controllers/auth/auth_controller')
const SourcesController = () => import('#controllers/sources_controller')
const ServerssController = () => import('#controllers/servers_controller')

transmit.registerRoutes((route) => {
  if (route.getPattern() === '/__transmit/events') {
    route.middleware(middleware.auth())
    return
  }
})

router
  .group(() => {
    // ==============API/V1==================
    router
      .group(() => {
        // ==========AUTH====================
        router
          .group(() => {
            router.post('token', [AuthController, 'store'])
            router.post('auto-register', [AuthController, 'register'])
            router.delete('token', [AuthController, 'destroy']).middleware(middleware.auth())
            router.get('me', [AuthController, 'index']).middleware(middleware.auth())
            router.put('me', [AuthController, 'update']).middleware(middleware.auth())
          })
          .prefix('session')
        // ==============================
      })
      .prefix('auth')
    // ================================

    router.group(() => {
      router.resource('sources', SourcesController).apiOnly().as('app.sources')
      router.resource('servers', ServerssController).apiOnly().as('app.servers')
    })

  })
  .prefix('api/v1')
