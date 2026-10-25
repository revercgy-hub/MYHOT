# Gold v2与b13摘要预检交接（2026-10-25）

## 用户确认的标签版本

2026-10-25，用户确认河北纯党建学习与福建理论成果名单公示两条均为reject。此更正仅记录在独立版本化overlay v2及合并manifest v2中；原Gold200文件与Staging数据库标签未被覆盖。既有validator返回`READY_FOR_EVALUATION`：200条全confirmed、0 pending、15个固定seed通过校验。原版本仍是29 select/171 reject；v2为27 select/173 reject，其中development为24/126，holdout仍为3/47。后续只可将v2用于固定预测的development-only post-hoc对照；已消费fresh50不能重新称作新holdout，也不据v2即时修改prompt、门槛或历史canonical成绩。

overlay `.data/fiscal-qa/gold-policy-label-revision-20261025/gold200-policy-label-overlay-v2.json` SHA-256 `f61717d7eef6afc8f83fbde692ca7552a2233474724652fe3c34d268a5b88846`；revision manifest `gold200-reviewed-manifest-v2.json` SHA-256 `c730313fbbd0a82dfe16e90f4c5998ee6e089740245b538b391ab99514e45a98`；独立validation `independent-validation-v2.json` SHA-256 `ca12e0225d8ddbe8cdc3b9c05cf871cf42d5823adcd48ad952b7ac07d4b9708a`。基础Gold200 count/hash保持200及`fbd469d962cbdf123953ec4236cdd1a53b8c6beeb62a7be24214e47bb7da4076`。

## b13正文与摘要状态

b13 exact13正文CAS已经独立后验通过。Staging最新独立快照为418 articles/626 revisions/418 discoveries，body状态208 `ok`、204 `pending`、6 `unconfirmed`；48个source flags为0/0/0，publications/overrides各105，Gold200基础hash不变。b13 native summary manifest仍是13个目标，prepared time为`2026-10-24T12:04:23.730Z`；v3 draft与canonical QA对13条结果为9 PASS/4 BLOCK。仅Root批准的9个PASS进入摘要导入候选，4个BLOCK不写。

冻结f60工具的只读`--preflight-only`于2026-10-25退出码1，抛出`native summary exact preflight failed: current article/source/body/revision/prompt rows differ from manifest`。调用未生成预检输出文件；没有调用apply、没有摘要导入或数据库业务写入。此前A独立direct RR/RO查询证实9个批准目标仍无native summary provenance、override或publication。进一步全行差异检查中，9/9的articleRowText、sourceRowText及bodyText与冻结manifest逐字相同；revision均为2、body_status为`ok`，无override/publication，analysis count为0。随后逐条prompt诊断确认13/13的prefilterUser/Input哈希匹配；13/13的summaryUser长度相同、哈希不同，首个差异偏移均为2538，内容仅为`buildArticlePrompt()`动态字段`today: anchorDate(new Date())`由manifest内的`2026-10-24`变为当前预检日期`2026-10-25`。这是冻结的summary prompt输入发生日期变化；没有证据表明数据库文章、来源或正文行漂移。

全行差异报告为`.data/fiscal-qa/pending-detail-first-get-20261024-r1/undici-decoded-derivative-v3/independent-exact9-full-row-diff.json`，SHA-256 `b9715d342731379c93b8b3fd35d231e38c50b2639e29d5aaa0c92d97384af3bf`；原始RR/RO结果`fresh-exact13-full-row-readonly-raw.json` SHA-256 `6e8a4bc7a3d169925c42a03f8c3262f7e63f58000b67f30aeda9ad6c55c1302c`。完整prompt诊断raw为`remote-current-prompt-row-diagnostic-raw-v2.json`，SHA-256 `d14b043b9ff396fed1b2e1cc0a6bc431f3c7fae09f984578067892783861dc82`；A compact逐条root-cause报告`independent-exact9-preflight-root-cause-v2.json` SHA-256 `d328792b01dcdc3a075b82072ec10c333e1ad45efc329e165632ef05c9b6a277`。当前预检使用`AIHOT_APP_ROOT=/data/operators/pending-body-batch-b7-20261024/runtime-root`；写作/提示模块经symlink解析至`/app/packages`，writing/prompts字节SHA分别为`21622303804da3fcd8722668aa6b281c30df846d1a30c413eda65691153d2af5`和`03244f20de69d4285842065786e05a199577e4d39583c1e7fa26ee242605e014`，manifest与预检的promptVersions相同。B确认没有执行b13 prepare且没有保存prepare命令或执行上下文日志；manifest的prepare模块路径、`AIHOT_APP_ROOT`、环境和时间zone无法独立审计。A全行查询使用容器`/app`默认上下文且`AIHOT_APP_ROOT`未设置；其结果仅用于证明当前DB行与manifest一致，不能替代f60 prompt对照。

只读预检失败原始记录为`native-summary-preflight-attempt-13-v3-20261025-attempt2.json`，SHA-256 `70356ea9fae2a32a2bfb871f0169403b1f868e33daa53b3f2454057d134a3e3a`；预期输出文件未创建。frozen input manifest SHA-256 `12426dd452ad631c796f902672e1ad8ee18fecbc0d5dbe6445d381c5c0056428`；v3 draft SHA-256 `1909c8ff9508da3ec5e60958b0477cc036e9ae44d4c056bf4eee9d218bf5c8c9`；A canonical QA SHA-256 `cd004a9f2602c86740f92c116c0753290c9532fccdd888805e3e222e2eb47512`；A exact9 fresh-preapply state SHA-256 `96e357c3501db5d81d7e2c8c8eebc5d40ee77ce18b407a434267624dcc22eb2f`。当前记录为`NOT_APPLIED`。由于manifest绑定的summary prompt日期已变化，必须关闭当前冻结批次；不得重试导入、放宽guard或改写manifest/draft。若未来再次处理这些目标，须重新prepare生成新manifest/hash，并按实际新prompt呈现与用户确认的范围另行审批。

## 评测与Gate边界

e559原canonical development150评估仍保留原人审版本：TP14/FP28/FN12/TN96，precision 33.33%、recall 53.85%、F1 41.18%；候选未获自动精选接受。Gold v2后的固定预测对照尚未完成，不覆盖原canonical成绩。`selection-score.md`的修订仍是未复测的development候选；60/65/76保持，fresh50已消费。Gate 3继续`CHANGES_REQUIRED`；Gate 4/5整体未通过。Gate 5的64/64 restore row hash、64/64 inventory及16/16 sequence状态只是恢复子项，不能代表Gate通过。

## 当前运行边界

代码checkpoint为`cd0c94e139010cd9ebd9dacc7d87e8d03e214e84`；Staging运行镜像为d45 app-only镜像，单独记录，不等同于当前Git HEAD。此阶段未启用source、provider、worker或Production，也未进行app部署。摘要失败发生在只读预检，不能把无输出结果写成导入成功或导入器事务失败。
