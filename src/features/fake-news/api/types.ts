export type ApiResponse = {
  success: boolean
  message?: string
  error?: string
}

export type HealthResponse = ApiResponse & {
  status: string
  timestamp: string
  model_loaded: boolean
  device?: string
}

export type ModelInfo = {
  id: string
  name: string
  path: string
  bert_type?: string
  resnet_type?: string
  use_sloss?: boolean
}

export type ModelsResponse = ApiResponse & {
  models: ModelInfo[]
}

export type LoadModelResponse = ApiResponse & {
  model: ModelInfo
}

export type DetectionResult = {
  predicted_class: number
  confidence: number
  probabilities: {
    real: number
    fake: number
  }
  label: string
}

export type LlmAnalysis = {
  should_analyze?: boolean
  fake_probability?: number
  timestamp?: number
  basic_analysis?: {
    suspicious_points?: string[]
    suggestions?: string[]
    content_structure_score?: number
    language_quality_score?: number
    source_reliability_score?: number
    reasoning?: unknown
    [key: string]: unknown
  }
  sentiment_analysis?: {
    overall_sentiment?: string
    sentiment_intensity?: number
    primary_emotions?: string[]
    sentiment_analysis?: string
    [key: string]: unknown
  }
  suspicious_words_analysis?: {
    risk_level?: string
    total_suspicious_count?: number
    average_suspicious_level?: number
    most_suspicious_category?: string
    analysis_summary?: string
    [key: string]: unknown
  }
  topic_analysis?: Record<string, unknown>
  viewpoint_analysis?: Record<string, unknown>
  credibility_assessment?: Record<string, unknown>
  overall_assessment?: {
    overall_risk_level?: string
    summary?: string
    recommendation?: string
    risk_factors?: string[]
    [key: string]: unknown
  }
  [key: string]: unknown
}

export type DetectSingleRequest = {
  text?: string
  image?: string
}

export type DetectSingleResponse = ApiResponse & {
  result: DetectionResult
  llm_analysis?: LlmAnalysis
}

export type DetectBatchItem = {
  text?: string
  image_path?: string
}

export type DetectBatchRequest = {
  items: DetectBatchItem[]
}

export type DetectBatchResult = {
  index: number
  success: boolean
  predicted_class?: number
  confidence?: number
  probabilities?: {
    real: number
    fake: number
  }
  label?: string
  error?: string
}

export type DetectBatchResponse = ApiResponse & {
  results: DetectBatchResult[]
  summary?: {
    total: number
    success: number
    error: number
  }
}

export type DetectTestsetRequest = {
  max_samples?: number
}

export type DetectTestsetResponse = ApiResponse & {
  results: unknown[]
  evaluation?: {
    accuracy?: number
    confusion_matrix?: number[][]
    classification_report?: Record<string, unknown>
  }
  summary?: {
    total: number
    success: number
    error: number
  }
}

export type DemoSample = {
  text?: string
  label?: number
  label_text?: string
  image_path?: string
  image_exists?: boolean
}

export type DemoSamplesResponse = ApiResponse & {
  samples: DemoSample[]
  total: number
}

export type AnalyzeAiResponse = ApiResponse & {
  llm_analysis: LlmAnalysis
}

export type UploadImageResponse = ApiResponse & {
  filename: string
  filepath: string
}
