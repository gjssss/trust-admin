import { textSourceClient } from './client'
import type { SourceDetectResponse, TextDetectResponse } from './types'

const buildPayload = (text: string) => {
  const payload = new URLSearchParams()
  payload.set('textarea', text)
  return payload
}

const postSourceDetect = async (path: '/cn_source' | '/en_source', text: string) => {
  const { data } = await textSourceClient.post<SourceDetectResponse>(
    path,
    buildPayload(text)
  )
  return data
}

const postTextDetect = async (path: '/cn_detect' | '/en_detect', text: string) => {
  const { data } = await textSourceClient.post<TextDetectResponse>(
    path,
    buildPayload(text)
  )
  return data
}

export function detectCnSource(text: string) {
  return postSourceDetect('/cn_source', text)
}

export function detectEnSource(text: string) {
  return postSourceDetect('/en_source', text)
}

export function detectCnText(text: string) {
  return postTextDetect('/cn_detect', text)
}

export function detectEnText(text: string) {
  return postTextDetect('/en_detect', text)
}
