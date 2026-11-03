import { z } from 'zod'

export const usernameSchema = z
  .string()
  .trim()
  .min(3, '用户名至少需要 3 个字符')
  .max(64, '用户名最多允许 64 个字符')
  .regex(
    /^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/,
    '用户名只能包含字母、数字、下划线、点和短横线'
  )

export const passwordSchema = z
  .string()
  .min(8, '密码至少需要 8 个字符')
  .max(128, '密码最多允许 128 个字符')

export const roleSchema = z.enum(['admin', 'user'])

export const publicUserSchema = z.object({
  id: z.string(),
  username: z.string(),
  role: roleSchema,
  enabled: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type PublicUser = z.infer<typeof publicUserSchema>

export const loginSchema = z
  .object({
    username: z.string().trim().min(1).max(64),
    password: z.string().min(1).max(128),
  })
  .strict()

export const createUserSchema = z
  .object({
    username: usernameSchema,
    password: passwordSchema,
    role: roleSchema.default('user'),
    enabled: z.boolean().default(true),
  })
  .strict()

export const updateUserSchema = z
  .object({
    username: usernameSchema.optional(),
    password: passwordSchema.optional(),
    role: roleSchema.optional(),
    enabled: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, '请提供需要修改的字段')
