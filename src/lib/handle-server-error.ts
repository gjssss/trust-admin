import { AxiosError } from 'axios'
import { toast } from 'sonner'

export function handleServerError(error: unknown) {
  let errMsg = '操作失败，请稍后重试'

  if (
    error &&
    typeof error === 'object' &&
    'status' in error &&
    Number(error.status) === 204
  ) {
    errMsg = 'Content not found.'
  }

  if (error instanceof AxiosError) {
    const data = error.response?.data
    const message = data?.error ?? data?.message ?? data?.title
    if (typeof message === 'string') errMsg = message
  }

  toast.error(errMsg)
}
