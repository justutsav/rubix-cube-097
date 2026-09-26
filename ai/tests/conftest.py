import os
import uuid

os.environ["ENGINE_DB"] = ":memory:"          # before engine.server creates its store
os.environ.setdefault("ASR_PROVIDER", "none")

import pytest
from fastapi.testclient import TestClient

from engine import prompts
from engine.server import app

CATALOGUE = prompts.catalogue("hi")


class Caller:
    """One phone (identity) making one call (channel_ref) against the engine."""

    def __init__(self, client, phone=None):
        self.c = client
        self.phone = phone or uuid.uuid4().hex
        self.call()

    def call(self):
        self.ref = uuid.uuid4().hex
        return self

    def turn(self, kind, **kw):
        r = self.c.post("/v1/turn", json={"channel": "ivr", "channel_ref": self.ref,
                                          "identity": {"kind": "msisdn_hash", "value": self.phone},
                                          "utterance": {"kind": kind, **kw}})
        assert r.status_code == 200, r.text
        j = r.json()
        for item in j["say"]:
            if item["kind"] == "prerendered":
                assert item["id"] in CATALOGUE, f"prompt id {item['id']} missing from catalogue"
        return j

    def say(self, text):
        return self.turn("text", value=text)

    def key(self, digits):
        out = None
        for d in digits:
            out = self.turn("dtmf", digits=d)
        return out

    def ids(self, j):
        return [x.get("id") for x in j["say"]]


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def caller(client):
    return Caller(client)
