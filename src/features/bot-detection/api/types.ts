export type BotDetectionApiResponse<T> = {
  success: boolean
  message: string
  data: T | null
}

export type UserProfile = {
  verified: boolean
  default_profile_image: boolean
  default_profile: boolean
  protected: boolean
  geo_enabled: boolean
  contributors_enabled: boolean
  followers_count: number
  friends_count: number
  listed_count: number
  favourites_count: number
  statuses_count: number
  created_at: string
  screen_name: string
  name: string
  description: string
  location: string
  url: string
  tweets: string[]
}

export type BotDetectionHealthData = {
  status: string
  model: string
  device: string
  embedding?: {
    qwen_size: string
    embedding_dim: number
  }
  embedding_models?: Record<string, string>
}

export type BotDetectionHealthResponse =
  BotDetectionApiResponse<BotDetectionHealthData>

export type BotDetectionSingleRequest = {
  user: UserProfile
}

export type BotDetectionLlmAnalysis = {
  status: 'success' | 'skipped' | 'error' | string
  risk_level?: 'low' | 'medium' | 'high' | string
  prediction_explanation?: string
  summary?: string
  account_metrics?: Record<string, unknown>
  behavior_metrics?: Record<string, unknown>
  behavior_anomalies?: Partial<
    Record<
      | 'like_behavior'
      | 'posting_behavior'
      | 'follow_behavior'
      | 'profile_behavior'
      | 'comment_behavior',
      string[]
    >
  >
  key_factors?: string[]
  content_signals?: string[]
  recommendations?: string[]
}

export type BotDetectionSingleResult = {
  label: 'human' | 'bot' | string
  prediction: number
  confidence: number
  probabilities: {
    human: number
    bot: number
  }
  analysis?: BotDetectionLlmAnalysis
}

export type BotDetectionSingleResponse =
  BotDetectionApiResponse<BotDetectionSingleResult>

export type BotDetectionBatchRequest = {
  items: UserProfile[]
}

export type BotDetectionBatchResult = {
  index: number
  label: 'human' | 'bot' | string
  prediction: number
  confidence: number
  probabilities: {
    human: number
    bot: number
  }
  analysis?: BotDetectionLlmAnalysis
}

export type BotDetectionBatchError = {
  index: number
  error: string
}

export type BotDetectionBatchData = {
  total: number
  success_count: number
  failed_count: number
  results: BotDetectionBatchResult[]
  errors: BotDetectionBatchError[] | null
}

export type BotDetectionBatchResponse =
  BotDetectionApiResponse<BotDetectionBatchData>

export const DEFAULT_USER_PROFILE: UserProfile = {
  verified: false,
  default_profile_image: false,
  default_profile: false,
  protected: false,
  geo_enabled: false,
  contributors_enabled: false,
  followers_count: 0,
  friends_count: 0,
  listed_count: 0,
  favourites_count: 0,
  statuses_count: 0,
  created_at: '',
  screen_name: '',
  name: '',
  description: '',
  location: '',
  url: '',
  tweets: [],
}
