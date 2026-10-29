#!/bin/sh
# Render the story's scenes (each sized to its longest narration) and encode them for the web.
#   sh tools/blender/render_all.sh          # all six
#   sh tools/blender/render_all.sh 2 3      # some
cd "$(dirname "$0")/../.."
for k in ${@:-0 1 2 3 4 5}; do
  [ -f "public/sites/konark/story/scene-$k.mp4" ] && [ -z "$FORCE" ] && { echo "scene $k: done"; continue; }
  F=$(python3 -c "import json;print(int(json.load(open('tools/blender/durations.json'))['$k']*24))")
  echo "scene $k: $F frames"
  # resumes where it stopped (existing frames are kept); delete tools/blender/out/scene-N to redo one
  blender -b -P tools/blender/story.py -- --shot "$k" --frames "$F" --render --eevee > "tools/blender/out/scene-$k.log" 2>&1 || { echo "scene $k failed"; tail -5 "tools/blender/out/scene-$k.log"; }
done
