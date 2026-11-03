# 假新闻检测系统 API 文档

## 基本信息
- Base URL: `http://<host>:5000`
- 所有接口默认 `Content-Type: application/json; charset=utf-8`（文件上传接口除外）
- 图片最大上传限制：16MB
- 需先加载模型：`/api/detect/*`、`/api/detect/testset` 依赖已加载的模型

## 通用响应
- `success`: 是否成功
- `message`: 可读提示
- `error`: 错误原因（失败时）

失败响应示例：
```json
{
  "success": false,
  "error": "模型未加载",
  "message": "请先加载模型"
}
```

## 1) 获取健康状态
`GET /api/health`

响应示例：
```json
{
  "success": true,
  "status": "healthy",
  "timestamp": "2024-01-01T12:00:00.000000",
  "model_loaded": false,
  "device": "cpu"
}
```

## 2) 获取可用模型列表
`GET /api/models`

响应示例：
```json
{
  "success": true,
  "models": [
    {
      "id": "S_bert-base-chinese_resnet18",
      "name": "BERT-base中文 + RESNET18",
      "path": "/path/to/model.ckpt",
      "bert_type": "bert-base-chinese",
      "resnet_type": "resnet18",
      "use_sloss": true
    }
  ],
  "message": "找到 1 个可用模型"
}
```

## 3) 加载模型
`POST /api/models/{model_id}/load`

响应示例：
```json
{
  "success": true,
  "model": {
    "id": "S_bert-base-chinese_resnet18",
    "name": "BERT-base中文 + RESNET18",
    "path": "/path/to/model.ckpt",
    "bert_type": "bert-base-chinese",
    "resnet_type": "resnet18",
    "use_sloss": true
  },
  "message": "模型 BERT-base中文 + RESNET18 加载成功"
}
```

## 4) 单样本检测
`POST /api/detect/single`

请求体：
```json
{
  "text": "新闻文本，可为空",
  "image": "data:image/jpeg;base64,/9j/4AAQ..." 
}
```

说明：
- `text` 和 `image` 至少提供一个
- `image` 支持 `data URL` 或纯 base64 字符串
- 当 `fake` 概率 > 0.5 时，会附带 `llm_analysis`

响应示例：
```json
{
  "success": true,
  "result": {
    "predicted_class": 1,
    "confidence": 0.93,
    "probabilities": {
      "real": 0.07,
      "fake": 0.93
    },
    "label": "虚假新闻"
  },
  "llm_analysis": {
    "should_analyze": true,
    "fake_probability": 0.93,
    "timestamp": 1700000000.0,
    "basic_analysis": {
      "suspicious_points": ["..."],
      "reasoning": {"...": "..."},
      "suggestions": ["..."]
    },
    "sentiment_analysis": {"...": "..."},
    "suspicious_words_analysis": {"...": "..."},
    "topic_analysis": {"...": "..."},
    "viewpoint_analysis": {"...": "..."},
    "credibility_assessment": {"...": "..."},
    "overall_assessment": {"...": "..."}
  },
  "message": "检测完成"
}
```

## 5) 批量检测
`POST /api/detect/batch`

请求体：
```json
{
  "items": [
    {
      "text": "新闻文本",
      "image_path": "uploads/1700000000_xxx.jpg"
    }
  ]
}
```

说明：
- `image_path` 为后端可访问的本地路径（相对或绝对路径）
- 单条失败不会影响整体结果

响应示例：
```json
{
  "success": true,
  "results": [
    {
      "predicted_class": 0,
      "confidence": 0.88,
      "probabilities": {"real": 0.88, "fake": 0.12},
      "label": "真实新闻",
      "index": 0,
      "success": true
    }
  ],
  "summary": {
    "total": 1,
    "success": 1,
    "error": 0
  },
  "message": "批量检测完成，成功 1 个，失败 0 个"
}
```

失败项示例：
```json
{
  "index": 0,
  "success": false,
  "error": "模型未加载",
  "text": "...",
  "image_path": "..."
}
```

## 6) 测试集检测
`POST /api/detect/testset`

请求体：
```json
{
  "max_samples": 100
}
```

说明：
- 使用后端 `data/test.csv`
- `max_samples` 为空或不大于 0 时默认取全部

响应示例（节选）：
```json
{
  "success": true,
  "results": ["..."],
  "evaluation": {
    "accuracy": 0.85,
    "confusion_matrix": [[40, 5], [10, 45]],
    "classification_report": {"...": "..."}
  },
  "summary": {"total": 100, "success": 100, "error": 0},
  "message": "测试集检测完成"
}
```

## 7) 获取演示样本
`GET /api/demo/samples`

响应示例：
```json
{
  "success": true,
  "samples": [
    {
      "text": "...",
      "label": 0,
      "label_text": "真实新闻",
      "image_path": "data/images/xxx.jpg",
      "image_exists": true
    }
  ],
  "total": 20,
  "message": "成功加载 20 个演示样本"
}
```

## 8) 获取图片文件
`GET /api/image/{image_path}`

说明：
- `image_path` 需进行 URL 编码
- 仅允许访问项目根目录内的图片文件
- 支持 `jpg/jpeg/png/gif/bmp/webp`

成功响应：直接返回图片文件流

失败响应示例：
```json
{
  "success": false,
  "error": "文件不存在",
  "message": "图片文件不存在: data/images/xxx.jpg"
}
```

## 9) AI 深度分析
`POST /api/analyze/ai`

请求体：
```json
{
  "text": "新闻文本，可为空",
  "image": "data:image/jpeg;base64,/9j/4AAQ..."
}
```

说明：
- `text` 和 `image` 至少提供一个
- 使用固定阈值 `0.6` 触发分析

响应示例：
```json
{
  "success": true,
  "llm_analysis": {"...": "..."},
  "message": "AI分析完成"
}
```

## 10) 上传图片
`POST /api/upload`

请求类型：`multipart/form-data`

表单字段：
- `file`: 图片文件（`png/jpg/jpeg/gif/bmp`）

响应示例：
```json
{
  "success": true,
  "filename": "1700000000_example.jpg",
  "filepath": "uploads/1700000000_example.jpg",
  "message": "文件上传成功"
}
```

## 统一错误码
- `404`: 接口不存在
- `500`: 服务器内部错误

错误响应示例：
```json
{
  "success": false,
  "error": "接口不存在",
  "message": "请求的API接口不存在"
}
```
