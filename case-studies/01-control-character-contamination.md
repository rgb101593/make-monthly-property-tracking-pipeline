# Case study 01 - Invisible control characters, and a wrong hypothesis

Symptom: Related property scenarios began emitting `Request path contains unescaped characters` warnings at the same operation.

Actual cause: Trailing `\r\n` bytes stored inside URL configuration fields.

The first root-cause theory was incorrect. This record includes the discarded hypothesis because it explains the diagnostic steps that followed.

---

## Initial symptoms

Most of the property scenarios started warning on the same run. Same message, same module. The ones that stayed quiet used a different export layout, which looked meaningful at first and turned out to be a red herring.

The message itself:

```
Request path contains unescaped characters
```

## First hypothesis

The URLs in the failing module contain Excel range addresses, which include colons:

```
/workbook/worksheets('<sheet>')/range(address='<start>:<end>')
```

A colon in a URL path segment can require escaping, and the error mentioned unescaped characters. This made colon handling the first hypothesis.

Two things should have killed it immediately:

1. Those URLs had worked for months. Nothing about colon handling changed. A cause must explain why the failure started *when it started*.
2. The receiving API accepts colons in range addresses. It's the documented address format. Escaping them would have broken the calls.

Initial checks focused on URL syntax rather than the stored byte values, so the control characters were not found immediately.

## Finding it

The scenario editor renders configuration fields as single-line text inputs. A field containing a trailing `\r\n` renders identically to one without it. The trailing bytes are invisible in the only view anyone normally uses.

They are visible in the raw exported configuration:

```json
{
  "url": "/workbook/worksheets('<sheet>')/range(address='<start>:<end>')\r\n"
}
```

The bytes arrived the ordinary way: someone copied a URL out of a document or a chat message, and the copy carried its line ending. The editor accepted it, displayed it as clean, and stored it verbatim.

## Scope of the failure

The affected scenarios were not independently broken. They shared a cloned configuration baseline.

The field was already contaminated when the scenarios were cloned, so each copy contained the defect in the same operation. A change in the receiving API's validation caused the family to begin failing at the same time.

This produced the most useful generalization from the incident:

Because the scenarios shared a source, the identical failures were investigated as a shared configuration defect rather than as unrelated defects.

Investigating properties separately would have created parallel dead ends. Recognizing the clone lineage reduced the incident to one repeatable fix.

## Resolution

Strip the control characters and assert that affected fields are single-line. Applying the same correction across the shared family stopped the warnings.

## Changes made

Configuration is now inspected with control characters preserved. The editor view is only a rendering of the stored value, so investigations use the underlying representation.

Values are no longer normalized before comparison during an investigation. Calling `.trim()` would have removed the characters responsible for this defect.

URL fields are checked after editing to ensure they contain no `\r`, `\n`, or `\t` characters.

The investigation checklist now requires a proposed cause to explain when the failure began. The colon hypothesis did not explain the preceding months of successful runs.

## Result

The original theory matched the error text but did not account for the timing. Inspecting the raw stored values exposed the trailing control characters and led directly to the fix.
