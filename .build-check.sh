#!/bin/bash
set -euo pipefail
cd /Users/shanechateauneuf/Projects/oscar-work
npm run build > /Users/shanechateauneuf/Projects/oscar-work/build-output.log 2>&1
echo "EXIT:0" >> /Users/shanechateauneuf/Projects/oscar-work/build-output.log
