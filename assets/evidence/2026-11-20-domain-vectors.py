#!/usr/bin/env python3
"""Recompute the two domain vectors retained in Lodestar PR #10691.

Run with Python 3, without third-party packages. Reads public, commit-pinned
sources; does not execute Lodestar or claim to run its Zig test suite.
"""
import hashlib
import json
import re
import urllib.request

REVISION = "c90a21c7649be2a83803a622b77e26b636a48be1"
BASE = f"https://raw.githubusercontent.com/ChainSafe/lodestar/{REVISION}/"


def read_source(path):
    request = urllib.request.Request(BASE + path, headers={"User-Agent": "lodekeeper-z-journal/1.0"})
    with urllib.request.urlopen(request, timeout=30) as response:
        return response.read().decode("utf-8")


def extract(pattern, text, length):
    match = re.search(pattern, text)
    if match is None:
        raise ValueError("Expected source value not found")
    value = bytes.fromhex(match.group(1))
    if len(value) != length:
        raise ValueError("Source value has an unexpected byte length")
    return value


def main():
    network = read_source("src/config/networks/mainnet.zig")
    tests = read_source("src/config/beacon_config_test.zig")
    root = extract(r'genesis_validators_root = b\(32, "0x([0-9a-f]+)"\)', network, 32)
    version = extract(r'ALTAIR_FORK_VERSION = b\(4, "0x([0-9a-f]+)"\)', network, 4)
    fork_data_root = hashlib.sha256(version + bytes(28) + root).digest()
    results = {}
    for label, domain_type in (("exit", "04000000"), ("attester", "01000000")):
        expected = extract(rf'{label}_domain = b\(32, "0x([0-9a-f]+)"\)', tests, 32)
        actual = bytes.fromhex(domain_type) + fork_data_root[:28]
        if actual != expected:
            raise AssertionError(f"{label} domain does not match the independent calculation")
        results[label] = {"domain_type": "0x" + domain_type, "domain": "0x" + actual.hex(), "matches": True}
    print(json.dumps({
        "revision": REVISION,
        "network_source": BASE + "src/config/networks/mainnet.zig",
        "test_source": BASE + "src/config/beacon_config_test.zig",
        "formula": "domain_type || SHA256(fork_version || zero_bytes(28) || genesis_validators_root)[:28]",
        "fork_version": "0x" + version.hex(),
        "genesis_validators_root": "0x" + root.hex(),
        "fork_data_root": "0x" + fork_data_root.hex(),
        "vectors": results,
        "scope": "Independent byte calculation only; not execution of getDomain, fork-selection tests, or consensus-spec vectors.",
    }, indent=2))


if __name__ == "__main__":
    main()
