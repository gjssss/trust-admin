import { fakeNewsClient } from './client'
import type {
  AnalyzeAiResponse,
  DemoSamplesResponse,
  DetectBatchRequest,
  DetectBatchResponse,
  DetectSingleRequest,
  DetectSingleResponse,
  DetectTestsetRequest,
  DetectTestsetResponse,
  HealthResponse,
  LoadModelResponse,
  ModelsResponse,
  UploadImageResponse,
} from './types'

export async function fetchHealth() {
  const { data } = await fakeNewsClient.get<HealthResponse>('/health')
  return data
}

export async function fetchModels() {
  const { data } = await fakeNewsClient.get<ModelsResponse>('/models')
  return data
}

export async function loadModel(modelId: string) {
  const { data } = await fakeNewsClient.post<LoadModelResponse>(
    `/models/${modelId}/load`
  )
  return data
}

export async function detectSingle(payload: DetectSingleRequest) {
  const { data } = await fakeNewsClient.post<DetectSingleResponse>(
    '/detect/single',
    payload
  )
  return data
}

export async function detectBatch(payload: DetectBatchRequest) {
  const { data } = await fakeNewsClient.post<DetectBatchResponse>(
    '/detect/batch',
    payload
  )
  return data
}

export async function detectTestset(payload: DetectTestsetRequest) {
  const { data } = await fakeNewsClient.post<DetectTestsetResponse>(
    '/detect/testset',
    payload
  )
  return data
}

export async function fetchDemoSamples() {
  const { data } = await fakeNewsClient.get<DemoSamplesResponse>('/demo/samples')
  return data
}

export async function analyzeAi(payload: DetectSingleRequest) {
  const { data } = await fakeNewsClient.post<AnalyzeAiResponse>(
    '/analyze/ai',
    payload
  )
  return data
}

export async function uploadImage(file: File) {
  const formData = new FormData()
  formData.append('file', file)

  const { data } = await fakeNewsClient.post<UploadImageResponse>(
    '/upload',
    formData
  )
  return data
}
