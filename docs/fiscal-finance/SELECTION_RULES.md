# 财政金融精选规则

## 行业类型

结构化 `itemType` 固定为：

`policy_release`、`regulatory_rule`、`fiscal_data`、`financial_data`、`debt_event`、`regulatory_action`、`local_practice`、`research_analysis`。

缺失分类标签时的映射为：

| 内容类型 | 分类标签 |
|---|---|
| `policy_release` | 政策发布 |
| `regulatory_rule` | 制度规则 |
| `fiscal_data` | 财政数据 |
| `financial_data` | 金融数据 |
| `debt_event` | 政府债务 |
| `regulatory_action` | 监管处罚 |
| `local_practice` | 地方实践 |
| `research_analysis` | 研究报告 |

一篇资料的第一个标签必须是分类标签；主题标签和机构标签只能从 `industry/taxonomy.ts` 白名单中选择。没有实质对应主题时不补标签。标题、摘要和事实不得添加原文未出现、且发布方无法明确证明的机构。

## 门槛

保留上游初始值：T1 60、T1.5 65、T2 76；`understandFloor` 保留当前行业包原值。两次独立评分的平均达到信源档位门槛后入选。任务书说明该数值来自上游 AI 行业校准，只作为财政金融版的初始测试参数，尚未用本行业 Gold Dataset 正式校准。不得凭主观判断调门槛。

预筛宽召回财政政策、预算、政府债务与专项债、财政金融协同、金融运行、金融监管与风险、财会监督，以及福建厦门地方实践。明确无关的市场行情、产品营销、党建招聘培训和无新增事实的宣传内容可过滤；官方身份本身不构成入选理由。

## 校准

从本行业实际资料建立 `.data/gold.jsonl`，至少包含重要政策、一般政务稿、地方实践、债务、监管处罚、财政金融数据和宣传噪声。分别检查查准率、查全率及各类错例，再决定是否调整评分文字或门槛。Gold 数据不得提交 Git。

当前阶段没有执行真实模型精选；`MODEL_CALLS_ENABLED=false`。Gate 1 前不得开启模型调用。
