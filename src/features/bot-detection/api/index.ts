import { botDetectionClient } from './client'
import type {
  BotDetectionBatchRequest,
  BotDetectionBatchResponse,
  BotDetectionHealthResponse,
  BotDetectionSingleRequest,
  BotDetectionSingleResponse,
} from './types'

type BotDetectionRequestOptions = {
  includeAnalysis?: boolean
}

export async function fetchBotDetectionHealth() {
  const { data } =
    await botDetectionClient.get<BotDetectionHealthResponse>('/health')
  return data
}

export async function detectBotSingle(
  payload: BotDetectionSingleRequest,
  options?: BotDetectionRequestOptions
) {
  const { data } = await botDetectionClient.post<BotDetectionSingleResponse>(
    '/bot',
    payload,
    options?.includeAnalysis
      ? {
          params: {
            include_analysis: true,
          },
        }
      : undefined
  )
  return data
}

export async function detectBotBatch(payload: BotDetectionBatchRequest) {
  const { data } = await botDetectionClient.post<BotDetectionBatchResponse>(
    '/bot/batch',
    payload
  )
  return data
}
