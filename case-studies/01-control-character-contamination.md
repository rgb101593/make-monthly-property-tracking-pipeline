# Case study 01 - Invisible control characters, and a wrong hypothesis

Symptom: Five property scenarios began emitting `Request path contains unescaped characters` warnings. All five failed at the same module.

Actual cause: Trailing `\r\n` bytes stored inside URL configuration fields.

The first root-cause theory was incorrect. This record includes the discarded hypothesis because it explains the diagnostic steps that followed.

---

## Initial symptoms

Five of seven property scenarios started warning on the same run. Same message, same module number. The two that didn't warn were the two with a different export layout - which initially looked meaningful and turned out to be a red herring.

The message itself:

```
Request path contains unescaped characters
```

## First hypothesis

The URLs in the failing module contain Excel range addresses, which include colons:

```
/workbook/worksheets('Sheet')/range(address='C5:N5')
```

A colon in a URL path segment can require escaping, and the error mentioned unescaped characters. This made colon handling the first hypothesis.

Two things should have killed it immediately:

1. Those URLs had worked for months. Nothing about colon handling changed. A cause must explain why the failure started *when it started*.
2. The receiving API accepts colons in range addresses. It's the documented address format. Escaping them would have broken the calls.

Initial checks focused on URL syntax rather than the stored byte values, so the control characters were not found immediately.

## Finding it

The scenario editor renders configuration fields as single-line text inputs. A field containing `...C5:N5')\r\n` renders identically to one containing `...C5:N5')`. The trailing bytes are invisible in the only view anyone normally uses.

They are visible in the raw exported configuration:

```json
{
  "url": "/workbook/worksheets('PM_Standard')/range(address='C5:N5')\r\n"
}
```

The bytes arrived the ordinary way: someone copied a URL out of a document or a chat message, and the copy carried its line ending. The editor accepted it, displayed it as clean, and stored it verbatim.

## Scope of the failure

The five affected scenarios were not independently broken. Four of them were cloned from the fifth.

The field was already contaminated when the scenarios were cloned, so each copy contained the defect in the same module. A change in the receiving API's validation caused all five scenarios to begin failing at the same time.

This produced the most useful generalization from the incident:

Because the scenarios were cloned from one source, the identical failures were investigated as a shared configuration defect rather than as five independent defects.

Investigating five properties separately would have meant five parallel dead ends. Recognizing the clone lineage collapsed it to one fix applied five times.

## Resolution

Strip the control characters; assert the fields are single-line. Applied across both affected modules in all five scenarios. Warnings stopped.

## Changes made

Configuration is now inspected with control characters preserved. The editor view is only a rendering of the stored value, so investigations use the underlying representation.

Values are no longer normalized before comparison during an investigation. Calling `.trim()` would have removed the characters responsible for this defect.

URL fields are checked after editing to ensure they contain no `\r`, `\n`, or `\t` characters.

The investigation checklist now requires a proposed cause to explain when the failure began. The colon hypothesis did not explain the preceding months of successful runs.

## Result

The original theory matched the error text but did not account for the timing. Inspecting the raw stored values exposed the trailing control characters and led directly to the fix.
