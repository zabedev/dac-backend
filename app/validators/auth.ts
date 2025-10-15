import vine from '@vinejs/vine'

export const createTokenValidator = vine.compile(
  vine.object({
    email: vine.string().trim().email().normalizeEmail(),
    password: vine.string().minLength(6),
  })
)

export const createAuthValidator = vine.compile(
  vine.object({
    email: vine
      .string()
      .trim()
      .email()
      .normalizeEmail()
      .unique({ table: 'users', column: 'email' }),
    password: vine.string().minLength(6).confirmed(),
    name: vine.string().trim().minLength(8).maxLength(150),
  })
)

export const updateAuthValidator = vine.compile(
  vine.object({
    password: vine.string().maxLength(6).confirmed().optional(),
    name: vine.string().trim().minLength(10).maxLength(150).optional(),
  })
)
