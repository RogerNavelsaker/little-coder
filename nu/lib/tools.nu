# nu/lib/tools.nu — Standard Nushell tool wrappers for little-coder
# Provides structured pipeline wrappers: grep, find, ls, read, diff, query, bat, sd, outline

# 1. grep wrapper via ripgrep with json/table parsing
export def lc-grep [
  pattern: string
  path: string = "."
  --case-sensitive (-s)
  --context (-C): int = 0
] {
  mut args = ["--no-heading", "--line-number", "--color=never"]
  if not $case_sensitive {
    $args = ($args | append ["-i"])
  }
  if $context > 0 {
    $args = ($args | append ["-C", ($context | into string)])
  }
  $args = ($args | append [$pattern, $path])
  ^rg ...$args
}

# 2. find wrapper via fd
export def lc-find [
  pattern: string = ""
  path: string = "."
  --type (-t): string = ""
] {
  mut args = []
  if not ($type | is-empty) {
    $args = ($args | append ["-t", $type])
  }
  if not ($pattern | is-empty) {
    $args = ($args | append [$pattern])
  }
  $args = ($args | append [$path])
  ^fd ...$args
}

# 3. ls wrapper via eza with icons/tree support
export def lc-ls [
  path: string = "."
  --all (-a)
  --tree (-T)
  --level (-L): int = 2
] {
  mut args = ["--group-directories-first"]
  if $all {
    $args = ($args | append ["-a"])
  }
  if $tree {
    $args = ($args | append ["--tree", "--level", ($level | into string)])
  }
  $args = ($args | append [$path])
  ^eza ...$args
}

# 4. read wrapper via linehash
export def lc-read [
  file: string
  --start (-s): int = 1
  --limit (-l): int = 100
] {
  ^linehash read $file --start $start --limit $limit
}

# 5. diff wrapper via delta
export def lc-diff [
  old_file: string
  new_file: string
] {
  ^delta $old_file $new_file
}

# 6. outline generator (line ranges)
export def lc-outline [
  file: string
  --step: int = 50
] {
  if not ($file | path exists) {
    error make { msg: $"File not found: ($file)" }
  }
  let lines = (open $file | lines | length)
  0..($lines // $step) | each { |i|
    let s = ($i * $step) + 1
    let e = [($s + $step - 1), $lines] | math min
    $"lines:($s)-($e)"
  }
}
