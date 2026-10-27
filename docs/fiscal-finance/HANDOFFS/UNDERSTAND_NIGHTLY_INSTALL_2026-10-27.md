# NAS夜间理解任务安装与独立QA（2026-10-27）

**TASK**：按用户授权安装NAS原生user crontab，每日上海时间02:00尝试一次有界理解诊断。当前只完成安装与夜窗外护栏验证；首个计划触发为2026-10-28 02:00（Asia/Shanghai），尚未产生模型结果。

**MODEL**：`qwen3.5:9b`；digest `6488c96fa5faab64bb65cbd30d4289e20e6130ef535a93ef9a49f42eda893ea7`。4个既有development request-only输入，每例structure→understand串行，共8次计划POST、HTTP硬上限12；不是fresh holdout。实际本轮模型请求0。

**FILES_CHANGED**：9个代码/测试文件加入nightly wrapper、launcher、installer及stdin密钥/截止时间护栏。未改行业规则、Gold、prompt、source admission、运行API flags或worker。`scripts/migrate.ts`仅列入冻结清单，文件未修改。代码基础HEAD为`080fe52`，提交后的准确SHA以Git日志为准。

**TESTS_RUN**：继承前owner在冻结核心上完成的focused 25/25、typecheck、strict runner tsc/node checks、Web build与22/22 Web tests。独立读取完整npm日志确认517 tests：512 pass、0 fail、5个既有DB配置skip。没有重复全套。此次新增窄QA为installer同版SHA核对、`git diff --check`、NAS独立228个源码文件逐一hash、cron/备份/pins只读后验，以及从`cwd=/`经真实flock调用入口，得到`NOOP_OUTSIDE_WINDOW`。

**RESULT**：workspace为`/vol2/1000/docker/fiscalhot-understand-nightly`。user cron恰一个owned block、5行，包含`CRON_TZ=Asia/Shanghai`、`TZ=Asia/Shanghai`和401字节的02:00 job；job先核对独立入口SHA，再持有flock运行。原nonowned内容为0字节，最终仍0字节。早期installer误将`SHELL=/bin/sh`和`PATH`置于marker外；在原0B备份与当前exact prefix证明后，仅清除该次多写两行，保留清理前完整备份，并以不产生global两行的同版installer重装。最终preinstall与清理备份均0600，原empty备份保留。NAS ACL曾使新清理备份呈700，ops显式chmod600后，独立QA确认最终0600。

| 冻结项目 | SHA-256 |
|---|---|
| installer | `B5375C5C86BD8E05066C8296BB6E087D775A9D047B783B66B122B57D67BCF60F` |
| wrapper | `84D75431C159749D540B8C734FEA658A445186EE3E170020BDFBF37DF7FFD968` |
| launcher | `C293BAC086B3BC42DCB8BD5182A881A0264FE66C530794383958222EFF9DAD71` |
| generated entrypoint | `A49245EEE12316CB90030653738EE1067C617D351B2B0059E4EF762C01850733` |
| code manifest | `62376D64F110760CBD13B32BEDD98B30C771A730ACBCE495876C16B55F17A4CA` |
| source tree（228 files） | `852AB2B5B0A44EBACE29486EDD4F3C5B7112836D41B1FC121B692A81A20BE0EB` |
| private Node 24.22.1 | `E32E2D16081CF644F88392934288086E7662529D0D43277C34F7AAD2207CFAFB` |

API镜像仍`sha256:54d1a34f104b665ccdecc60e82f4cb67acf114fb3171b742990464ee6d4c7bc6`，PG镜像pin为`sha256:79bd7c99e923138f136f8009d6bffa66e21e9d4fda5c0c561b00fc9c90cfe537`。installer dry-run证明API/source package-lock一致、image敏感环境与Node override缺席、flock传递与并发拒绝通过。独立QA确认入口、wrapper、launcher、Node、228文件和API image/PG pin相符。独立夜窗外实跑前后16个Docker IDs完全相同，0新client/PG容器；state JSON不存在、results为空，仅已有0B lock，未进入模型调用路径。密钥仅从NAS既有gateway配置在内存中经stdin传给runner，没有输出或写入.env。

资源护栏要求至少4 GiB可用内存；模型冷加载另需14,604,325,354 B模型量加4 GiB。窗口02:00–06:00，启动需剩余30分钟；单请求structure/understand分别120/180秒，硬截止不跨06:00。并发1；成功后terminal、不自动再次运行；不确定结果转人工复核，资源不足按当天skip处理。

证据均为ignored本地artifact，未提交`.data`：

- `candidate-manifest.json`：`89D16CA2A4E396A6DFB9491B190FA971D2B4AAD466A38C39AD8E3C34E2C4299B`。已更新installer hash及真实wrapper Node pin缺陷：原wrapper与manifest把实际binary尾码`CFAFB`误抄为`CFABF`。独立QA追查源码发现该bug；夜窗外NOOP在runtime校验前返回，不能覆盖此问题。owner将wrapper常量与installer/实测binary对齐，并将测试改为独立observed literal、明确拒绝旧错pin；修后focused16/16、typecheck通过，未重复未受影响的全套。
- `install-final-20261027.json`：`7183640E087BD7051512DF27A42C470AC4786AD73EB38A211E1A6CDB246F370A`。
- `independent-readback-20261027.json`：`974AC5D93AD65ED81CCE7A6B25933471A454987CDDC52F902800EF947E46F184`。
- 三者目录：`.data/fiscal-qa/ollama-understand-nightly-candidate-20261027/`；全套日志`.data/test-pg/ollama-nightly-fulltest-20261027.log` SHA `1E2673404AC6196F5A6E359679EE52F5A7E531571BFBC1474F1E6442CC5CB858`。

**RISKS / BLOCKERS**：`PASS`仅涵盖安装/冻结/夜窗外路径。首夜仍可能因资源门槛skip；尚无8次真实POST、receipt、understand输出或grounding结果。隔离client并非在线API进程验证。Gate 2仍仅`PASSED_FOR_BOUNDED_P4_PILOT`；Gate 3 `CHANGES_REQUIRED`；Gate 4/5未通过。

**NEXT**：首夜后只读冻结state/results/receipt与容器清理证据，独立核验schema、grounding及业务表计数；不将已安装等同于理解质量通过。用户新增的时效性采集请求另开范围记录，不混作本nightly模型结果。

## Node pin修复后最终部署后验

修复后NAS wrapper、入口与401B cron重新安装并一致，独立QA用实际private Node进程读取其自身binary hash，调用真实`verifyNodeRuntimeMetadata`通过，version24.22.1与pin相符；实际`verifyFrozenFiles`也通过codeManifest `62376D64F110760CBD13B32BEDD98B30C771A730ACBCE495876C16B55F17A4CA`与228文件source tree冻结。独立再次从/持真实flock运行得到NOOP_OUTSIDE_WINDOW，state/results为空，Docker IDs在这次检查前后相同、0新容器、0模型请求。source/entrypoint/cron旧版备份及installer备份最终0600。两份candidate staging文件在private目录内为700；它们不是原件备份，未据此声称所有目录项均0600。

部署中首个CRLF脚本在nested heredoc结束处失败，一度造成cron与回滚后的旧wrapper/入口不一致；owner立即持nightly锁用LF脚本恢复并重装，最终独立后验一致。期间没有state/results/model/container产生。详细事故与恢复sidecar `nas-node-sha-fix-install-20261027.json` SHA `C2AF23D5C19723A7D7C6CF3B7C6F7F7B79F252AEE6DF73129A1FFBA6A84FB41D`；此前`install-final`及`independent-readback`仅为修Node pin前的历史安装证据。最终独立sidecar为`independent-final-readback-20261027.json`，SHA `A547DC02F6A7984B2A78A476C674A6917FD80B55122456BF0AB6063CB53B0956`，是本交接最终PASS依据。
