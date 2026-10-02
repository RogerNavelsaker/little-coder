# little-coder nu/config.nu — Default configuration and module imports

# Import standard module library
use std
use lib/tools.nu *

# Precision mutation & anchored inspection via linehash
alias edit = linehash edit
alias read = linehash read

# Structural code search via ast-grep
alias ast-search = ast-grep
