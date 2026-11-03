# 假新闻检测（水军监测）接入与移植计划

## 目标
- 将现有“假新闻检测系统”前端能力迁移到本项目，统一为“水军监测”页面。
- 按 API 文档完成模型管理、检测、上传、AI 分析、演示样本等接口接入。
- 隐藏当前后台已有页面入口，仅保留“水军监测”入口。

## 范围与约定
- 前端技术栈：React + Shadcn UI + TanStack Router。
- API Base URL 通过环境变量统一配置（例如 `VITE_FAKE_NEWS_API_BASE`）。
- 历史记录采用本地存储（与原示例一致），不依赖后端。

## 实施步骤
1) 现状梳理（已完成）
- 阅读 `docs/fake-news.md` 与示例前端（`/Volumes/disk/Code/py/fakenews_detector/fake_news_detector/frontend`），确认功能列表与交互模式。

2) 路由与导航调整
- 新增“水军监测”路由页面（建议：`/_authenticated/monitoring` 或 `/_authenticated/fake-news`）。
- 更新侧边栏数据（`src/components/layout/data/sidebar-data.ts`），隐藏现有入口，只保留“水军监测”。
- 同步搜索/命令面板（使用同一 `sidebarData`）确保入口一致。

3) API 客户端与类型设计
- 新建 API 模块（例如 `src/features/fake-news/api`），封装：
  - 健康检查 `/api/health`
  - 模型列表 `/api/models`
  - 加载模型 `/api/models/{id}/load`
  - 单样本检测 `/api/detect/single`
  - 批量检测 `/api/detect/batch`
  - 测试集检测 `/api/detect/testset`
  - 演示样本 `/api/demo/samples`
  - 图片获取 `/api/image/{path}`
  - AI 分析 `/api/analyze/ai`
  - 图片上传 `/api/upload`
- 定义统一响应类型与错误处理逻辑，保证 UI 可复用。

4) 页面结构与组件封装
- 参考原示例拆分组件：
  - 状态/模型区：健康状态、设备、模型选择与加载。
  - 输入区：文本输入、图片上传与预览、清空/示例按钮。
  - 操作区：单样本检测、批量检测、测试集检测、AI 分析。
  - 结果区：置信度、概率、标签、LLM 分析面板。
  - 历史区：本地历史列表与详情。
- 使用 Shadcn 组件完成布局与样式（Card/Badge/Progress/Tabs/Accordion 等）。

5) 联调与校验
- 覆盖加载态、空态、失败态（模型未加载/请求失败/输入为空）。
- 校验图片 base64/URL 兼容逻辑与上传接口。
- 手动验证主要流程：加载模型 → 单样本检测 → AI 分析 → 历史记录。

## 已确认
- “水军监测”设为默认首页，原 Dashboard 等入口从导航中隐藏。
- 历史记录与检测功能合并为页面内 Tab。
- API Base URL 先使用 `http://localhost:5000`，通过 Vite 代理 `'/fake-news'` 统一入口，便于后续切换其他地址。
