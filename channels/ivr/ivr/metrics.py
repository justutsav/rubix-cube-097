"""One JSON line per turn on the `ivr.metrics` logger. The latency slide comes from these.

Never contains audio, transcript text or a phone number.
"""

import json
import logging

log = logging.getLogger("ivr.metrics")


def turn(**fields):
    log.info(json.dumps(fields, separators=(",", ":")))
