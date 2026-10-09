// Compose the isolated provider mock with an opt-in final-report write fault. This module is only
// loaded by the P4 executor's child process; unmatched network access remains disabled by the mock.
import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import path from "node:path";
import "../fiscal-p4-executor-mock-preload.ts";

if (process.env.P4_EXECUTOR_SCENARIO === "persist-report-write") {
  const requestedReportPath = process.env.P4_FAKE_REPORT_PATH;
  if (!requestedReportPath) throw new Error("P4 report-write fault requires its exact output path");
  const reportPath = path.resolve(process.cwd(), requestedReportPath);
  let reportFd: number | null = null;
  const openSync = fs.openSync;
  const writeFileSync = fs.writeFileSync;
  fs.openSync = function (file, flags, mode) {
    const fd = openSync.call(fs, file, flags, mode);
    if (typeof file === "string" && path.resolve(file) === reportPath) reportFd = fd;
    return fd;
  };
  fs.writeFileSync = function (file, data, options) {
    if (typeof file === "number" && file === reportFd) throw new Error("mock P4 report write failure");
    return writeFileSync.call(fs, file, data, options);
  };
  syncBuiltinESMExports();
}
