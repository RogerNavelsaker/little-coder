#!/usr/bin/env nu

def slugify [url: string] {
  $url
  | str replace --all --regex '^https?://' ''
  | str replace --all --regex '[^A-Za-z0-9._-]+' '-'
  | str trim --char '-'
}

def render-rows [rows: list, format: string, extract: string] {
  let selected = match $extract {
    "all" => $rows
    "markdown" => ($rows | each {|item| {url: $item.url, title: $item.title, markdown: $item.markdown}})
    "html" => ($rows | each {|item| {url: $item.url, title: $item.title, html: $item.html}})
    "metadata" => ($rows | each {|item|
      {
        url: $item.url
        title: $item.title
        description: $item.description
        author: $item.author
        site: $item.site
        published: $item.published
        wordCount: $item.wordCount
        extraction: $item.extraction
        cleanup: $item.cleanup
      }
    })
    "links" => ($rows | each {|item| {url: $item.url, title: $item.title, links: ($item.links? | default [])}})
    _ => (error make {msg: $"unsupported extract: ($extract). Use markdown, html, metadata, links, or all."})
  }

  match $format {
    "markdown" => {
      if $extract == "markdown" {
        $rows | each {|item| $item.markdown? | default ($item | to json)} | str join "\n\n---\n\n"
      } else {
        $selected | to json
      }
    }
    "json" => ($selected | to json)
    "toon" => ($selected | to json | ^tru --encode)
    _ => (error make {msg: $"unsupported format: ($format). Use markdown, json, or toon."})
  }
}

def main [
  ...urls: string
  --output (-o): path
  --format (-f): string = "markdown"
  --engine (-e): string = "defuddle"
  --extract (-x): string = "markdown"
  --browser
  --depth: int = 0
  --follow: string = ""
  --allowed-domain: string = ""
  --timeout: int = 60
  --retries: int = 1
  --crawler-url: string = ""
  --crawler-token: string = ""
] {
  let effective_crawler_url = if ($crawler_url | is-not-empty) {
    $crawler_url
  } else {
    ($env.CRAWL4AI_URL? | default "")
  }
  let effective_crawler_token = if ($crawler_token | is-not-empty) {
    $crawler_token
  } else {
    ($env.CRAWL4AI_TOKEN? | default "")
  }

  if ($urls | is-empty) {
    error make {msg: "provide at least one URL"}
  }

  if not ($engine in ["defuddle", "readability"]) {
    error make {msg: $"unsupported engine: ($engine). Use defuddle or readability."}
  }

  mut rows = []

  for url in $urls {
    mut args = [
      "run"
      "./skills/web/web-fetch/scripts/page-to-html.js"
      "--url"
      $url
      "--output.format"
      "ndjson"
    ]

    if $browser {
      $args = ($args | append ["--browser" "true"])
    }

    if $depth > 0 {
      $args = ($args | append ["--depth" ($depth | into string)])
    }

    if ($follow | is-not-empty) {
      $args = ($args | append ["--follow" $follow])
    }

    if ($allowed_domain | is-not-empty) {
      $args = ($args | append ["--allowedDomains" $allowed_domain])
    }

    mut fetched = []
    if ($effective_crawler_url | is-not-empty) {
      let crawler_payload = ({urls: [$url]} | to json)
      let crawler_auth = (if ($effective_crawler_token | is-not-empty) { ["-H" $"Authorization: Bearer ($effective_crawler_token)"] } else { [] })
      let crawler = (^curl --fail --silent --show-error --location --max-time ($timeout | into string)
        -H "Content-Type: application/json" ...$crawler_auth --data $crawler_payload $"($effective_crawler_url)/crawl" | complete)
      if $crawler.exit_code == 0 and ($crawler.stdout | str trim | is-not-empty) {
        try {
          let payload = ($crawler.stdout | from json)
          let results = ($payload.results? | default [])
          if ($results | length) > 0 {
            $fetched = ($results | each {|item|
              let md = (if ($item.markdown? | default "" | describe | str starts-with "record") {
                $item.markdown.raw_markdown? | default ($item.markdown.fit_markdown? | default "")
              } else {
                $item.markdown? | default ($item.cleaned_markdown? | default "")
              })
              {
                url: ($item.url? | default $url)
                title: ($item.title? | default "")
              markdown: $md
              html: ($item.html? | default ($item.cleaned_html? | default ""))
              links: ($item.links? | default [])
              description: ""
              author: ""
              site: ""
              published: ""
              wordCount: 0
              extraction: "crawl4ai"
              cleanup: {}
            }
          })
        }
      }
    }
    mut attempt = 0
    mut succeeded = false
    while ($fetched | is-empty) and $attempt <= $retries and not $succeeded {
      let result = (^timeout ($timeout | into string) flyscrape ...$args | ^bun ./skills/web/web-fetch/scripts/extract-cli.js --engine $engine | complete)
      if $result.exit_code == 0 and ($result.stdout | str trim | is-not-empty) {
        $fetched = ($result.stdout
          | lines
          | where {|line| ($line | str trim | is-not-empty)}
          | each {|line| $line | from json})
        $succeeded = true
      } else if $attempt == $retries {
        let detail = ($result.stderr | str trim | default "no output")
        error make {msg: $"web fetch failed for ($url) after ($attempt + 1) attempt(s): ($detail)"}
      }
      $attempt += 1
    }

    $rows = ($rows | append $fetched)
  }

  let rendered = (render-rows $rows $format $extract)

  let target = if ($output | is-empty) {
    let first = ($urls | first)
    let suffix = if $format == "markdown" { "md" } else { $format }
    if ($urls | length) == 1 {
      $"/home/rona/Downloads/(slugify $first).($suffix)"
    } else {
      $"/home/rona/Downloads/web-fetch-multi.($suffix)"
    }
  } else {
    $output
  }

  $rendered | save -f $target
  print $target
}
