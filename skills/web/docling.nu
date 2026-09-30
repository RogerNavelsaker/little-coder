#!/usr/bin/env nu
# docling.nu — CLI wrapper for document conversion using Docling Serve endpoint
# Converts PDF, DOCX, PPTX, XLSX, scanned documents into Markdown or JSON

def main [
  file_path: string
  --output (-o): string = ""
  --format (-f): string = "md" # md or json
  --vlm                        # Use Lemonade VLM acceleration on ester-desktop
] {
  let endpoint = ($env.DOCLING_URL? | default "https://docling.naco.casa")
  
  if not ($file_path | path exists) {
    print -e $"Error: File not found: ($file_path)"
    exit 1
  }

  let base_args = [
    "--fail" "--silent" "--show-error"
    "-X" "POST"
    $"($endpoint)/v1/convert/file"
    "-F" $"file=@($file_path)"
    "-F" $"to_formats=($format)"
  ]

  let args = if $vlm {
    let options = {
      pipeline: "vlm"
      to_formats: [$format]
      vlm_pipeline_model_api: {
        url: "http://100.108.123.126:13305/api/v1/chat/completions"
        params: {
          model: "Docling_258M"
          max_tokens: 4096
        }
        response_format: "doctags"
        prompt: "Convert this page to docling."
      }
    } | to json -r
    $base_args | append ["-F" $"options=($options)"]
  } else {
    $base_args
  }

  let result = (^curl ...$args)
  
  if ($output | is-empty) {
    $result
  } else {
    $result | save -f $output
    print $"Saved ($format | str upcase) to ($output)"
  }
}
