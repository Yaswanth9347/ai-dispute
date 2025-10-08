# backend/src/lib/whisper_helper.py
import sys, json
from faster_whisper import WhisperModel

# usage: python whisper_helper.py /tmp/file.mp3
p = sys.argv[1]
model = WhisperModel("small", device="cpu", compute_type="int8")  # change to gpu if available
segments, info = model.transcribe(p, beam_size=5)
text = " ".join([s.text for s in segments])
print(json.dumps({"transcript": text}))
