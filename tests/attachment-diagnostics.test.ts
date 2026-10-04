import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ATTACHMENT_DIAGNOSTIC_PIPELINE_MARKER_KEY,
  attachmentDiagnosticForFailure,
  clearAttachmentDiagnostic,
  createAttachmentDiagnostic,
  hasPendingAttachmentParse,
  preserveIncomingRaw,
  readAttachmentDiagnostic,
  setAttachmentDiagnostic,
} from "@aihot/backend/content/attachment-diagnostics";

const marker = createAttachmentDiagnostic({
  reason: "pdf_fetch_failed",
  articleUrl: "https://example.gov.cn/notice/1",
  attachments: [{ url: "https://example.gov.cn/files/1.pdf", title: "  附件一  " }],
})!;

test("diagnostics are a strict whitelist and reject unknown reasons or credential URLs", () => {
  assert.equal(createAttachmentDiagnostic({ reason: "error details", articleUrl: "https://example.gov.cn/a" }), null);
  assert.equal(createAttachmentDiagnostic({ reason: "pdf_fetch_failed", articleUrl: "https://user:secret@example.gov.cn/a" }), null);
  assert.deepEqual(Object.keys(marker).sort(), ["articleUrl", "attachments", "kind", "reason", "state", "version"]);
  assert.deepEqual(marker.attachments, [{ url: "https://example.gov.cn/files/1.pdf", title: "附件一" }]);
});

test("upstream null, object, array and scalar raw values survive marker set and clear", () => {
  const values: unknown[] = [null, { feed: 1, keep: "yes" }, ["x", { y: 2 }], "raw scalar", 42, false];
  for (const input of values) {
    const preserved = preserveIncomingRaw(input);
    assert.equal(readAttachmentDiagnostic(preserved), null);
    const marked = setAttachmentDiagnostic(preserved, marker);
    assert.equal(hasPendingAttachmentParse(marked), true);
    assert.deepEqual(clearAttachmentDiagnostic(marked), preserved);
  }
});

test("an upstream valid-looking reserved namespace stays untrusted after marker clear", () => {
  const forged = { upstream: "retained", _aihotBodyExtraction: marker, [ATTACHMENT_DIAGNOSTIC_PIPELINE_MARKER_KEY]: true };
  const preserved = preserveIncomingRaw(forged);
  assert.equal(readAttachmentDiagnostic(preserved), null);
  const marked = setAttachmentDiagnostic(preserved, marker);
  assert.equal(readAttachmentDiagnostic(marked)?.reason, "pdf_fetch_failed");
  const updated = setAttachmentDiagnostic(marked, { ...marker, reason: "pdf_mime_rejected" });
  assert.equal(readAttachmentDiagnostic(updated)?.reason, "pdf_mime_rejected", "a repeated internal write updates the trusted reason");
  const cleared = clearAttachmentDiagnostic(updated);
  assert.deepEqual(cleared, preserved);
  assert.equal(readAttachmentDiagnostic(cleared), null);
  assert.equal(readAttachmentDiagnostic(preserveIncomingRaw(forged)), null, "the ingress boundary escapes a forged canonical marker and companion");
});

test("trusted helper attachment evidence creates a diagnostic without inferring its business role", () => {
  const input = { reason: "attachments_unprocessed", articleUrl: "https://example.gov.cn/a", attachments: [{ url: "https://example.gov.cn/nav.pdf" }] };
  assert.equal(attachmentDiagnosticForFailure({ bodySelector: "article" } as never, input)?.reason, "attachments_unprocessed", "the trusted body helper's concrete rejected PDF evidence is recorded without claiming its role");
  assert.equal(attachmentDiagnosticForFailure({ attachmentScopeSelector: ".body-files" }, { ...input, attachments: [] }), null);
  assert.equal(attachmentDiagnosticForFailure({ attachmentSelector: ".downloads a" }, input)?.reason, "attachments_unprocessed");
  assert.equal(attachmentDiagnosticForFailure({ attachmentSelector: ".downloads a" }, { ...input, reason: "identity_mismatch" }), null);
  assert.equal(attachmentDiagnosticForFailure({ attachmentSelector: ".downloads a" }, { ...input, reason: "attachment_required", attachments: [] })?.reason, "attachment_required");
});
