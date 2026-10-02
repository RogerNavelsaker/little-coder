# little-coder nu/env.nu — Environment configuration for Nushell
# Ensures standard paths and default options

$env.config = ($env.config? | default {})
$env.config.show_banner = false
