#!/bin/sh
# Re-encode the story's clips from frames already rendered (same settings as story.py).
#   sh tools/blender/encode_story.sh [scene ...]
cd "$(dirname "$0")/../.."
for k in ${@:-0 1 2 3 4 5}; do
  ffmpeg -y -loglevel error -framerate 24 -i "tools/blender/out/scene-$k/f%04d.png" \
    -c:v libx264 -preset slow -crf 23 -maxrate 3500k -bufsize 7000k -tune animation \
    -pix_fmt yuv420p -movflags +faststart "public/sites/konark/story/scene-$k.mp4" && echo "scene $k encoded"
done
