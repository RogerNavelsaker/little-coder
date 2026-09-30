#!/usr/bin/env nu

def main [
  query: string
  --num (-n): int = 8
  --site (-s): string = ""
  --time (-t): string = ""
  --region (-r): string = "us-en"
  --format (-f): string = "toon"
  --output (-o): path
  --timeout: int = 30
  --searxng-url: string = "https://searxng.naco.casa"
] {
  mut args = [
    "--json"
    "--np"
    "-n"
    ($num | into string)
    "--colorize=never"
    "--reg"
    $region
  ]

  if ($site | is-not-empty) {
    $args = ($args | append ["--site" $site])
  }

  if ($time | is-not-empty) {
    $args = ($args | append ["--time" $time])
  }

  let searxng = (^curl --fail --silent --show-error --location --max-time ($timeout | into string)
    --get --data-urlencode $"q=($query)" --data-urlencode "format=json"
    $"($searxng_url)/search" | complete)
  let result = if $searxng.exit_code == 0 and ($searxng.stdout | str trim | is-not-empty) {
    {exit_code: 0, stdout: $searxng.stdout, stderr: ""}
  } else {
    (^timeout ($timeout | into string) ddgr ...$args $query | complete)
  }
  if $result.exit_code != 0 {
    error make {msg: $"web search failed (SearXNG and ddgr): (($result.stderr | str trim))"}
  }
  if ($result.stdout | str trim | is-empty) {
    error make {msg: "web search returned no results"}
  }

  let payload = ($result.stdout | from json)
  let raw_results = (if ($payload | describe | str starts-with "record") and ($payload.results? | is-not-empty) { $payload.results } else { $payload })
  let rows = ($raw_results | each {|row|
    {
      title: ($row.title? | default "")
      url: ($row.url? | default "")
      abstract: ($row.content? | default ($row.abstract? | default ""))
    }
  })

  let has_tru = (which tru | is-not-empty)
  let rendered = match $format {
    "json" => ($rows | to json)
    "toon" => (if $has_tru { $rows | to json | ^tru --encode } else { $rows | to json })
    _ => (error make {msg: $"unsupported format: ($format). Use json or toon."})
  }

  if ($output | is-empty) {
    print $rendered
  } else {
    $rendered | save -f $output
  }
}
