# 内容预览扩展与厦门债务 PDF 护栏交接（2026-10-10；进行中）

STATUS=IN_PROGRESS
STAGE=P3来源主线；本地开发样本预览维护
GATE=Gate 2 `PASSED_FOR_BOUNDED_P4_PILOT`（仅引用正式review；本轮无Gate变化）
BRANCH=feat/fiscal-finance-hot
HANDOFF_HEAD=3385ef05ebf448a0bd9d68daf748d03b24b34440
STAGE_CODE_SHA=3385ef05ebf448a0bd9d68daf748d03b24b34440
BASE_SHA=3879e4fca78bd29d0c108d27b255e8c26a068d96
WORKTREE=代码HEAD 3385ef0时工作树干净；交接文档另作docs-only提交，不改动该代码SHA

## 阶段退出条件与结论

本轮只准备三篇浙江监管工作预览样本，并为厦门地方债已有详情页提供严格的必需PDF文本解析路径。没有运行 collector、worker、真实模型或OCR；source 均保持 disabled，站内/转发全文保持关闭。项目仍处P3来源主线；Gate 2只允许正式review限定的三个source中逐篇核验合格文章进行bounded P4，本轮不扩大该授权。

代码层六篇历史样本ID保持不变，预览标注allow-list新增本轮三篇，合计九个可识别预览ID。`scripts/seed-local-preview.ts`现包含九条样本定义，但本机没有运行seed：只读监听检查显示API `127.0.0.1:3001`、Web `127.0.0.1:3000`、PostgreSQL `127.0.0.1:5432`均无listener。先前handoff记录的六篇隔离seed结果是历史证据；本轮没有重新读取该库，不能推断当前库实际仍有几篇，也不能把九条代码清单写成九条已入库。

CI没有形成本轮终态：用户已表示将手动运行；其后只读`gh run list --workflow check.yml --branch feat/fiscal-finance-hot --limit 5`仍为`[]`。此前dispatch返回HTTP 403 `Must have admin rights to Repository`，未尝试绕过。当前HEAD已推送，但不能称精确SHA的CI通过；等待用户实际运行后只读确认run的head SHA。

## 完成内容与可复核证据

### 三篇浙江摘要

对三份保存详情HTML离线重算raw SHA，并用仓库当前`extractSelectedBody`、`.my_doccontent`、`+08:00`发布日期规则与列表身份核对；没有新HTTP请求。owner随后按此helper校正seed metadata的正文字符数和SHA，并拆开第三篇中“40家”与资产评估检查的对象。标题、列表日期、详情日期及可见日期均按各自manifest相符。

| 固定本地preview ID | 列表/详情日期 | 保存raw字节与SHA-256 | helper正文字符数/SHA-256 | 摘要事实复核 |
|---|---|---|---|---|
| `local-preview-mof-zhejiang-real-funds` | 2026-07-21 | 17,928 / `f193ebdf351bd587b624a29c3920edcbb8c7e8db5e949f00e75dd8ce1ce890d3` | 1,264 / `b8c48e8ace7746a03a98d7e7250b4d0db962ba0d7611c523a0164046d48793f1` | 扩围、银行账户年检核对、机器筛查与人工研判，以及账户/内控/预算审核协同均见原文。 |
| `local-preview-mof-zhejiang-transfer-performance` | 2026-07-29 | 18,328 / `56f6847c2579ca240ed180c8f981e6bdb02df05395d319f0b553dd42d2b06917` | 1,390 / `82689ef56b910111bd749e05101f592d1b3dcdfb6713ee22b01099d4a91b2464` | 全省书面复核与项目现场复核、资金分配/实施内容/绩效产出核查及整改反馈均见原文。 |
| `local-preview-mof-zhejiang-fiscal-supervision-202608` | 2026-08-11 | 24,425 / `f09c49b26bc8fdff80da29cb65926fcb949cae10462c69bc6c980e049ca3942e` | 3,378 / `cf5d5554935c9d78f51bb1e45e8876e8ce3e7c25f1204c200ce8c7084d583ac7` | 百余个超长期特别国债项目、72个转移支付监管问题、4项资金/9地/139个问题与原文相符。正文将40家在浙央属金融企业呆账核销备案全覆盖监管和资产评估机构检查分别描述。 |

新文章日期均在2026-10-10往前90日内。此前考虑的7月9日、6月30日候选因超出窗口而未加入。摘要统一标“开发预览·编辑摘要；未经正式模型精选”。任务请求使用`gpt-6-luna/high`；实际模型ID未验证，故provenance使用`actualModel=unverified`。这些不是项目provider执行、人工Gold或正式P4结果；`humanGold=false`。

保存材料位置：

- 7月21日：`.data/fiscal-qa/zhejiang-date-details-20261010/detail-1.raw`及同目录`manifest.json`。
- 7月29日：`.data/fiscal-qa/zhejiang-date-detail-20261010/detail.raw`及同目录`manifest.json`。
- 8月11日：`.data/fiscal-qa/zhejiang-date-detail-20261009/detail.body`及同目录`manifest.json`。

### 厦门地方债PDF配置

`xiamen-finance-debt`从仅选正文容器改为精确`.article_component`文章包络、`.Custom_UnionStyle`正文、`.article_attachment`附件区及`attachmentMode=required`。独立QA对保存详情`.data/fiscal-source-audit/details/xiamen-finance-debt.html`（15,640字节，SHA-256 `19a2f94d976ad7a077c7c1789e0fbb40159bb8d9d35ec843c521b713b3468a08`）离线重算：身份匹配，且包络内唯一PDF href为`P020260911578215495483.pdf`。零官方HTTP、零真实附件读取、零OCR。

focused mock测试覆盖：有效文本层PDF与HTML通知合并为body；空白PDF返回`pdf_page_no_text`且body为null、附件诊断保留，严格body-readiness hold仍为true。保存详情页以本机mock的无效PDF bytes回放也返回body null及附件诊断，hold为true。这只证明通用文本PDF路径配置/软件行为；历史该PDF实际解析为`pdf_page_no_text`，不能表述为厦门真实附件成功或source已body-ready。source仍disabled、两种全文开关仍false，旧205字符假正文未改。

### 集中本机软件QA

工作目录为`D:\AI-work\MYHOT\AIHOT`，Node `v24.16.0`。在最终代码提交前的冻结工作树运行：

- `node --test tests/selected-body.test.ts`：9/9通过，含必需附件缺失/歧义及空白PDF hold场景。
- `npm run typecheck`：exit 0。
- `npm run build -w @aihot/web`：exit 0。
- `node --test "apps/web/tests/*.test.ts"`：16/16通过，含预览固定ID allow-list和robots元数据边界。
- `git diff --check`：exit 0。

软件QA之后仅将三篇seed里的正文字符数/SHA metadata校正为现行helper输出，并把第三篇摘要拆清对象；这些值已用相同保存raw重新复算，没有结构代码变化。本机没有运行完整backend suite或smoke；CI仍待有权限的dispatch。测试/预览代码不代表source准入、栏目质量、90日覆盖或Gate 3/4完成。

## Git与提交

- PDF配置与focused测试：`457942a`（`fix(sources): parse required Xiamen debt PDF`）。
- 浙江预览样本、server ID allow-list与测试：`3385ef0`（`feat(preview): add Zhejiang fiscal samples`）。
- 组合HEAD及远端分支均为`3385ef05ebf448a0bd9d68daf748d03b24b34440`；父commit `3879e4fca78bd29d0c108d27b255e8c26a068d96`。
- 推送目标：`origin/feat/fiscal-finance-hot`。写本文时Git代码工作树clean。

## 环境与安全边界

- 来源配置：本轮触及的`xiamen-finance-debt`与`mof-zhejiang-supervision-dynamics`都`enabled=false`；`site_fulltext=false`、`syndicate_fulltext=false`。
- 用户表示手动恢复服务之后，runtime QA只读观察到API `127.0.0.1:3001`、Web `127.0.0.1:3000`、PostgreSQL `127.0.0.1:5432`均无listener。没有启动、重启或停止服务，没有live页面GET、seed或SQL操作；预览库未查询，旧六条当前计数未知、新三条未seed。
- 已从现存`.data/test-pg/cluster`的`PG_VERSION=17`、`postmaster.opts`（loopback `127.0.0.1:5432`）和历史P3记录确认本机便携数据库命令。用户若自行启动，应从仓库根目录在PowerShell执行：`$aihotRepoRoot = (Get-Location).Path; $previewPgCtl = Join-Path $aihotRepoRoot ".data\test-pg\pgsql\bin\pg_ctl.exe"; $previewPgData = Join-Path $aihotRepoRoot ".data\test-pg\cluster"; $previewPgLog = Join-Path $aihotRepoRoot ".data\test-pg\preview-postgres-manual.log"; & $previewPgCtl -D $previewPgData -l $previewPgLog -o "-h 127.0.0.1 -p 5432" -w start`。未执行`initdb`、启动或停止该实例；完整步骤及随后API/Web启动命令见[P3本地预览说明](../P3_LOCAL_PREVIEW.md)。
- 没有collector、worker、模型provider、付费API、OCR、Jina、附件网络请求或推送。
- 预览flag继续要求development、loopback SITE/API/WEB地址，默认关闭；Web代码为九个固定sample IDs提供预览标记，root preview banner和noindex逻辑仍受服务端配置控制。live页面显示及HTTP headers尚未验证。
- 本轮未读取keys或环境文件。

## 未完成项、风险与阻塞

- 本机preview DB在服务恢复前没有读前/写后审计，九条定义不是九条seed事实；如需seed，先核准精确DB身份、读前快照、写后不变性与固定allow-list，再由Lead授权实际写入。
- 当前代码SHA没有CI run：手动dispatch因GitHub权限403被拒。需有仓库相应Actions dispatch权限者安排一次精确SHA workflow，并记录最终run/head SHA；不复用旧SHA CI。
- live root/item、预览标签与HTTP noindex header仍需用户手动启动服务后另行核验；用户的启动意向不表示服务已运行。
- 厦门真实PDF正文仍未就绪；既有`pdf_page_no_text`风险未解除，不重取旧PDF，不降级成短HTML正文，不启用source。
- 三篇内容仅为人工/agent辅助编辑预览，不是领域人员Gold，不证明摘要质量评分或source admission。

## 下一批Agent

先读本交接、[本地预览状态](../P3_LOCAL_PREVIEW.md)、[项目状态](../STATUS.md)、[来源矩阵](../SOURCE_MATRIX.md)与正式[Gate 2 review](../GATE_2_REVIEW.md)。QA owner负责由有权限者对当前SHA手动dispatch CI（本次因403未运行），不重复本机全backend套件。仅在用户决定恢复服务、且Lead核准后，才确认preview DB身份、做读前审计、seed固定九条并做写后审计；不要把本机曾验证的旧六篇当成当前DB状态。领域Gold人工标签仍待处理，付费provider按用户决定继续deferred；本轮没有改变Gate 2或source准入。Source owner继续保留厦门PDF失败hold，只有新的授权和真实、可复核附件证据才能改变该source的body-ready判断。

### TASK / MODEL / FILES_CHANGED / TESTS_RUN / RESULT / RISKS / BLOCKERS / NEXT

**TASK**：独立核对三条保存正文摘要；review厦门PDF包络/required路径及失败hold；集中Web与typecheck QA；记录当前安全范围和阶段交接。

**MODEL**：预览样本requested `gpt-6-luna/high`；actual model ID unverified。QA使用Codex GPT-6.1 Luna/high；没有项目provider调用。

**FILES_CHANGED**：代码为`industry/sources.json`、`tests/selected-body.test.ts`、`scripts/seed-local-preview.ts`、`apps/web/app/lib/local-preview.server.ts`、`apps/web/tests/local-preview.test.ts`。文档为本handoff、`STATUS.md`、`P3_LOCAL_PREVIEW.md`、`SOURCE_MATRIX.md`、`LOCAL_DEVELOPMENT.md`及本目录`README.md`。

**TESTS_RUN**：selected-body 9/9；typecheck；Web build；Web tests 16/16；diff-check。未运行backend full tests、smoke、DB seed、service或live HTTP。

**RESULT**：代码固定九个预览ID；离线summary事实复核通过（第三篇对象/单位已澄清）；required PDF路径失败时仍body-null/hold。精确组合HEAD已push。

**RISKS**：真实厦门PDF仍无可提取文本；无CI final run；live页面未观测；九篇中新增三篇未在本机seed。

**BLOCKERS**：用户手动运行CI仍待实际run；截至只读快照本机服务和PostgreSQL未运行，等待用户自行启动并由Lead复核。

**NEXT**：用户实际启动服务后由Lead复核监听并决定是否继续已批准的seed/页面复核；手动CI实际出现后只读确认精确head SHA。保持Gate 2及source状态不变。

## 声明

没有由记录支持的事实不作猜测；本交接未提及的行为不视为已验证。
