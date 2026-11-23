#!/usr/bin/env python3
"""Recompute the one-slot arithmetic in Lodestar PR #10722.

This is an arithmetic illustration, NOT execution of Lodestar or a full
consensus-spec parity test. It deliberately retains the implementation's
committee-weight estimate; current consensus-specs uses exact committee weights.

Merged implementation and regression fixture:
https://github.com/ChainSafe/lodestar/commit/7dd7051260beb8cc5943ef20366da16c297a263b
https://github.com/ChainSafe/lodestar/blob/7dd7051260beb8cc5943ef20366da16c297a263b/packages/fork-choice/test/unit/forkChoice/fastConfirmation.test.ts
Fixture configuration (25% adversarial budget, 40% proposer boost):
https://github.com/ChainSafe/lodestar/blob/7dd7051260beb8cc5943ef20366da16c297a263b/packages/fork-choice/test/unit/forkChoice/fastConfirmationTestUtils.ts
"""
from decimal import Decimal
import json

GWEI_PER_ETH = 1_000_000_000
TOTAL_ETH = 4330
SLOTS_PER_EPOCH = 32
PROPOSER_BOOST = 40
BYZANTINE_THRESHOLD = 25

# Adjacent parent/block slots 4/5, evaluated at slot 6. No empty-slot
# support discount and no equivocating validators in this synthetic fixture.
old_committee = TOTAL_ETH // SLOTS_PER_EPOCH
old_proposer = old_committee * PROPOSER_BOOST // 100
old_adversarial = old_committee * BYZANTINE_THRESHOLD // 100
old_threshold = (old_committee + old_proposer + 2 * old_adversarial) // 2

committee = TOTAL_ETH * GWEI_PER_ETH // SLOTS_PER_EPOCH
proposer = committee * PROPOSER_BOOST // 100
adversarial = (committee // 100) * BYZANTINE_THRESHOLD
threshold = (committee + proposer + 2 * adversarial) // 2

assert old_threshold == 127
assert threshold == 128_546_875_000
assert 128 > old_threshold
assert not (128 * GWEI_PER_ETH > threshold)
assert 129 * GWEI_PER_ETH > threshold

print(json.dumps({
    "scope": "one-slot estimated-weight arithmetic only",
    "old_threshold_eth": old_threshold,
    "merged_threshold_gwei": threshold,
    "merged_threshold_eth": str(Decimal(threshold) / GWEI_PER_ETH),
    "support_128_eth": {
        "old_comparison": 128 > old_threshold,
        "merged_comparison": 128 * GWEI_PER_ETH > threshold,
    },
    "support_129_eth_merged_comparison": 129 * GWEI_PER_ETH > threshold,
    "assertions": "passed",
}, indent=2))
