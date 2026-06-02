---
name: nu
description: Nushell syntax reference for running commands, checking paths, capturing output, and reporting results. Load when writing or executing Nu shell code.
---

## External commands

Prefix external binaries with `^` to bypass Nu built-ins:

```nu
^bun install
^bunx tsc --noEmit
^bun test
^grep -r "pattern" "/some/dir"
^zellij --session foo action write-chars --pane-id terminal_0 "text"
```

## Variables and string interpolation

```nu
let x = "hello"
let uid = (^id -u | str trim)
let path = $"/run/user/($uid)/zellij"   # $"..." for interpolation, ($var) for values
```

## Capturing exit code and output

```nu
let result = (^bunx tsc --noEmit | complete)
print $result.exit_code   # 0 = pass
print $result.stdout
print $result.stderr
```

## Path checks

```nu
"/some/path" | path exists          # returns bool
not ("/some/path" | path exists)    # negation
```

## Conditionals

```nu
if ("/some/path" | path exists) {
  print "found"
} else {
  print "missing"
}
```

## Loops

```nu
let items = ["a", "b", "c"]
for item in $items {
  print $item
}
```

## Pipes and filtering

```nu
ls ".pi/extensions" | where type == dir | get name
```

## Saving output

```nu
"content" | save /tmp/file.txt
$result.stdout | save /tmp/out.txt
```

## No bash idioms in Nu

| Bash | Nu equivalent |
|------|--------------|
| `cmd 2>&1` | `^cmd \| complete` (stderr in `.stderr`) |
| `$(cmd)` | `(^cmd \| str trim)` |
| `cmd && cmd2` | `^cmd; ^cmd2` |
| `[ -f path ]` | `"/path" \| path exists` |
| `export VAR=x` | `$env.VAR = "x"` |

## Reporting back to planner

```nu
^bash /tmp/report-to-planner.sh "TESTER REPORT: status=done; tests=...; result=...; blockers=none"
```
