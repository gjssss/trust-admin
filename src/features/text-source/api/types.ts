export type SourceResItem = [string, number]

export type DetectPreds = [number, number]

export type TextDetectResponse = {
  res: string
  preds: DetectPreds
  jud: string
}

export type SourceDetectResponse = {
  res: SourceResItem[]
  model_list: string[]
  model_name: string
}
