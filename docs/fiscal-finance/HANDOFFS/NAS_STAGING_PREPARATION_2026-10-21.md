# NAS Staging 本地准备与验收检查点（2026-10-21）

STATUS=IN_PROGRESS（本地受限Staging配置完成；远端访问/部署/验收未完成）
STAGE=P8 NAS Staging 准备（用户明确要求先做隔离Staging）
GATE=Gate 2 `PASSED_FOR_BOUNDED_P4_PILOT`；Gate 3/4/5未通过。Root批准的是本地配置准备，不是Gate通过或NAS部署通过。
BRANCH=feat/fiscal-finance-hot
PREPARATION_CODE_SHA=ac14beaf1b67ef709578624b388b14767998a80c
PREPARATION_COMMITS=93e4e43 (isolated staging config/Web noindex/authorized-key helper); ac14bea (trim test EOF whitespace)
BASE_SHA=57f0b40c2270e71ede40a15a88c63449f88f6fb2
DOCS_BASE_HEAD=ac14beaf1b67ef709578624b388b14767998a80c

## 用户请求与授权边界

用户明确要求在 NAS 先行部署 Staging，宿主与Web容器端口均为3221。Root批准受限隔离Staging配置准备。该指令改变了阶段顺序，但没有把Gate 3/4/5标为通过，也没有完成NAS实际部署或上线验收。本轮仅本地代码/config/test/docs和本机数据库测试；没有在NAS写入、构建、启动服务或新增volume，没有启动本机API/Web/worker，没有真实provider/官方采集/付费调用。

## 完成内容及源码范围

代码改动将默认compose project与Staging项目、数据库、镜像标签隔离；NAS overlay 将worker放入`manual-worker` profile，默认启动命令只列`db setup api web`；只Web映射`3221:3221`，API/DB无宿主端口。Web不再接收后端`.env`、数据库地址或`/data`卷，后台服务才挂`/data`。`DEPLOY_SHA`和数据库密码空值时Compose插值fail closed；示例固定noindex、`TRUST_PROXY=false`和所有外部副作用flag为false。Web production-mode noindex通过SSR robots meta及响应头覆盖代理API结果；Dockerfile没有HEALTHCHECK，`EXPOSE 3000`仅为image元数据，Web实际按`WEB_PORT`监听。

独立提交 `93e4e430ed099d90d14d177027c9e31c500f0934` 包含：`.gitignore`、`.env.nas-staging.example`、`docker-compose.yml`、`docker-compose.nas-staging.yml`、`tests/docker-compose-staging.test.ts`、`apps/web/app/lib/local-preview.server.ts`、`apps/web/app/root.tsx`、`apps/web/server.ts`、`apps/web/tests/local-preview.test.ts`、`apps/web/tests/cache.test.ts`、`scripts/nas/authorize-key.ps1`。`ac14beaf1b67ef709578624b388b14767998a80c`仅修整该新增compose测试末尾空行。Dockerignore包含`.env`、`.env.*`、`.data`忽略规则，且只将`.env.example`作为例外；NAS真实`.env`和数据目录不会进入Docker build context。仓库中只保留空值示例，不包含NAS实际secret。

NAS运行前辅助脚本`scripts/nas/authorize-key.ps1`的SHA256为`da630e770f62c098bf21a052042bd80df76757826e02ad312fb3ba8ccb4c6176`。用户可用的无网络本机预检命令：

```powershell
powershell -NoProfile -File scripts/nas/authorize-key.ps1 -WhatIf
```

本轮只运行了`-WhatIf`，输出`LOCAL_PREFLIGHT_OK_NO_NETWORK`；未执行会通过SSH向NAS的`authorized_keys`追加公钥的实际模式。脚本限定host/user/port、known_hosts及单一identity，关闭agent/proxy，拒绝远端SSH路径symlink/nonregular文件，对现存授权key按算法和blob去重，不截断既存文件、不改既存权限；新目录/文件使用umask077和noclobber。

## 软件与配置验证

- PostgreSQL loopback只用于隔离软件测试；新库`fiscalhot_nas_staging_qa3_20261021_test`独立应用35个migration。
- `npm test`：422 tests，421 pass、0 fail、1 skip。测试进程将`MODEL_CALLS_ENABLED=true`只供项目测试在本机创建的stub provider执行；在启动测试前确认并清除了所有真实provider API key/base URL、proxy、secret/token及P3访问变量；采集、Feishu、IndexNow、Jina、OCR、Embedding、私网和可信代理开关均false，凭据目录指向不存在路径，没有真实provider请求。
- 另一次早期fresh测试错误地把`MODEL_CALLS_ENABLED=false`用于stub测试，得到396 pass/25 fail/1 skip；失败路径报告`Model calls are disabled`。该结果保留为错误测试配置记录，未作为软件失败或通过结论；最终重新创建干净35-migration库并使用上列隔离设置，全套通过。
- Web production build通过；完整`apps/web/tests/*.test.ts`为19/19通过；`npm run typecheck`通过。
- `tests/docker-compose-staging.test.ts` 3/3、`apps/web/tests/local-preview.test.ts` 6/6、`apps/web/tests/cache.test.ts` 11/11通过；PyYAML解析base与overlay成功，独立合并模型核对project、3221端口、DB/API internal、worker profile、backend-only data mount及Web环境白名单成功；`git diff --check`通过。
- 本机没有Docker CLI，因此未执行真实`docker compose config`、build或容器运行验收。NAS也没有部署；本节的静态配置检查不可替代现场runtime确认。

## NAS访问与未完成项

用户提供的设备信息为铭凡N5、64GB、飞牛NAS（用户称支持Docker）、`192.168.3.100`。本地alias`fnnas`指向`codex@192.168.3.100:22`。当前本机ssh-agent stopped/disabled且0 identities；本地通过Node spawnSync以精确空passphrase校验专用私钥时，`ssh-keygen`返回`incorrect passphrase supplied to decrypt private key`，因此该key需要非空passphrase。此事实没有证明NAS拒绝该key。

授权的一次严格BatchMode/hostkey/专用identity只读SSH连接曾有TCP ESTABLISHED；进程超过3分钟没有返回可捕获输出，随后只终止了本地进程。没有可用的SSH输出，因此服务器认证结果、远端命令是否运行及其结果均未知；没有第二次连接，没有远端OS/Docker/Compose/容器/端口/卷目录信息，没有远端读写。为避免重试，不再发SSH。用户/管理员若允许可启动或配置本机agent后运行`ssh-add "$env:USERPROFILE\.ssh\id_ed25519_nas"`，在交互提示中输入passphrase；本轮没有启用/修改Windows服务。取得有效访问后只读核对NAS版本和独立Staging目录，检查项目名与既存volume归属；若项目名下已经有容器或卷，先停下核实，禁止覆盖、复用或`down -v`。

本轮没有运行Docker compose config、没有验证实际NAS内存/目录/权限/卷/备份，不声称已建立可回滚能力。root final审查状态仅`APPROVED_FOR_PREPARATION`。Production禁止部署。Gate 3/4/5原正式门槛不变；本地配置测试不代替Gate或NAS运行验收。

## 下一步

1. 用户/管理员在本机按权限解锁专用identity（若使用agent，启用后`ssh-add`），然后取得有效、受known_hosts校验的SSH连接。
2. 只读查看NAS OS/Docker Compose版本、专用目录、现存Compose项目/volume及3221占用；在远端检查前不运行`up`。
3. 将本地提交SHA `ac14beaf1b67ef709578624b388b14767998a80c`作为`DEPLOY_SHA`；在NAS专用目录复制空值示例为本地`.env`，生成Staging唯一凭据；POSTGRES_PASSWORD仅用字母数字，provider key留空，所有side-effect flags false。
4. 远程只读检查和Root最终操作审查完成后，才运行`docker compose ... config`（结果含secret，不外传原文）及显式服务`db setup api web`，再做实际端口、worker、DB/API隔离、health/noindex验收。不得把此handoff里的预期命令描述为已运行。

## TASK / MODEL / FILES_CHANGED / TESTS_RUN / RESULT / RISKS / BLOCKERS / NEXT

**TASK**：准备并独立QA受限NAS Staging配置；更新部署文档/状态，不做远端部署。

**MODEL**：GPT-6 Luna / high。项目provider调用0；后端测试中的模型路径仅连接测试文件创建的localhost stub。

**FILES_CHANGED**：11个Staging配置/代码/测试文件，见提交`93e4e430ed099d90d14d177027c9e31c500f0934`；空行修复提交`ac14beaf1b67ef709578624b388b14767998a80c`；本文档、`STATUS.md`、`PROJECT_PLAN.md`、`NAS_DEPLOYMENT.md`为本次handoff docs提交。

**TESTS_RUN**：fresh PostgreSQL 35/35 migrations；backend 422/421 pass/0 fail/1 skip；full `npm run typecheck`；Web build；完整Web tests19/19；staging config3/3、noindex6/6、cache11/11；PyYAML静态解析/合并模型；`git diff --check`；helper AST/`-WhatIf`。未运行Docker、没有NAS容器验收。

**RESULT**：受限隔离Staging配置准备完成，Root批准本地准备。代码测试SHA `ac14beaf1b67ef709578624b388b14767998a80c`。此状态不是Gate 3/4/5通过，也不是NAS实际部署通过。

**RISKS**：无Docker CLI；Docker配置未在真实Compose实现中渲染，需NAS现场`config`核对。密钥仅有空值样例。Windows本地SSH agent不可用；专用私钥需passphrase。一次只读SSH无法取回输出，服务器和远端状态未知。

**BLOCKERS**：尚无可验证的有效NAS SSH会话；NAS版本、Staging目录与volume现状、3221占用、备份路径/恢复都未现场核验。

**NEXT**：有效认证后先只读核对NAS和volume隔离，再由Root核准实际操作；只对Staging部署，不启动worker/collection/model/provider，保持noindex和全部side-effect关闭。部署后补真实runtime验收记录；Production与所有Gate仍按正式条件管理。
