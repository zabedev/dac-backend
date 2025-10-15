import User from '#models/user'
import { generateNewCode } from '#services/index'
import { createAuthValidator, createTokenValidator, updateAuthValidator } from '#validators/auth'
import type { HttpContext } from '@adonisjs/core/http'

export default class AuthController {
  /**
   * Get current authenticated user
   */
  async index({ auth, response }: HttpContext) {
    try {
      const userAuth = auth.user!
      const user = await User.findOrFail(userAuth.id)

      if (!user.isActive){
        return response.unauthorized()
      }

      return response.ok({
        message: 'User retrieved successfully',
        user:user,
        isAuthenticated:auth.isAuthenticated,
      })
    } catch (error) {
      return response.unauthorized({
        message: 'Unable to fetch user',
        error: error.message,
      })
    }
  }

  /**
   * Register a new user
   */
  async register({ response, request }: HttpContext) {
    try {
      const payload = await request.validateUsing(createAuthValidator)

      const newUser = await User.create({
        ...payload,
        isActive: true,
        code: generateNewCode()
      })

      const token = await User.accessTokens.create(newUser)

      return response.created({
        message: 'User registered successfully',
        user: newUser,
        token,
      })
    } catch (error) {
      return response.badRequest({
        message: 'Registration failed',
        error: error.messages ?? error.message,
      })
    }
  }

  /**
   * Login and generate access token
   */
  async store({ request, response }: HttpContext) {
    try {
      const { email, password } = await request.validateUsing(createTokenValidator)
      const user = await User.verifyCredentials(email, password)

      if (!user.isActive) {
        return response.unauthorized({
          message: 'A conta do usuário está inativa',
        })
      }
      const tokes = await User.accessTokens.all(user)

      for (const token of tokes) {
        await User.accessTokens.delete(user, token.identifier)
      }

      const token = await User.accessTokens.create(user)

      return response.ok({
        message: 'Login successful',
        user,
        session:token,
      })
    } catch (error) {
      return response.unauthorized({
        message: 'Credenciais inválidas',
        error: error.message,
      })
    }
  }

  /**
   * Update user profile
   */
  async update({ auth, response, request }: HttpContext) {
    try {
      const userAuth = auth.user!
      const user = await User.findOrFail(userAuth.id)
      const valid = await request.validateUsing(updateAuthValidator)

      user.merge(valid)
      await user.save()

      return response.ok({
        message: 'User updated successfully',
        user,
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to update user',
        error: error.message,
      })
    }
  }

  /**
   * Logout user (delete token)
   */
  async destroy({ auth, response }: HttpContext) {
    try {
      const userAuth = auth.user!
      const currentToken = userAuth.currentAccessToken

      if (currentToken) {
        await User.accessTokens.delete(userAuth, currentToken.identifier)
      }

      return response.noContent()
    } catch (error) {
      return response.badRequest({
        message: 'Logout failed',
        error: error.message,
      })
    }
  }
}
