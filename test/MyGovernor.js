const { loadFixture, mine } = require("@nomicfoundation/hardhat-network-helpers");
const { assert } = require("chai");
const { ethers } = require("hardhat");
const { toUtf8Bytes, keccak256, parseEther } = ethers;

describe("MyGovernor", function () {
  async function deployFixture() {
    const [owner, otherAccount] = await ethers.getSigners();

    const transactionCount = await owner.getNonce();

    // gets the address of the governor before it is deployed (deployed at nonce+1)
    const futureGovernorAddress = ethers.getCreateAddress({
      from: owner.address,
      nonce: transactionCount + 1,
    });

    // Deploy token first (at nonce+0) with the governor's future address
    const MyToken = await ethers.getContractFactory("MyToken");
    const token = await MyToken.deploy(futureGovernorAddress);

    // Deploy governor second (at nonce+1) with the already-deployed token
    const MyGovernor = await ethers.getContractFactory("MyGovernor");
    const governor = await MyGovernor.deploy(token.target);

    const delegate = await token.delegate(owner.address);
    // console.log({ delegate });

    return { governor, token, owner, otherAccount };
  }

  it("should provide the owner with a starting balance", async () => {
    const { token, owner } = await loadFixture(deployFixture);

    const balance = await token.balanceOf(owner.address);
    assert.equal(balance.toString(), parseEther("10000").toString());
  });

  describe("after proposing", () => {
    async function afterProposingFixture() {
      const deployValues = await deployFixture();
      const { governor, token, owner } = deployValues;

      const tx = await governor.propose(
        [token.target],
        [0],
        [
          token.interface.encodeFunctionData("mint", [
            owner.address,
            parseEther("25000"),
          ]),
        ],
        "Give the owner more tokens!"
      );
      const receipt = await tx.wait();
      const event = receipt.logs
        .map((log) => {
          try {
            return governor.interface.parseLog(log);
          } catch {
            return null;
          }
        })
        .find((e) => e && e.name === "ProposalCreated");
      const { proposalId } = event.args;

      // wait for the voting delay to pass (votingDelay = 4 blocks)
      await mine(4);

      return { ...deployValues, proposalId };
    }

    it("should set the initial state of the proposal", async () => {
      const { governor, proposalId } = await loadFixture(afterProposingFixture);

      const state = await governor.state(proposalId);
      assert.equal(state, 0);
    });

    describe("after voting", () => {
      async function afterVotingFixture() {
        const proposingValues = await afterProposingFixture();
        const { governor, proposalId } = proposingValues;

        const tx = await governor.castVote(proposalId, 1);
        const receipt = await tx.wait();
        const voteCastEvent = receipt.logs
          .map((log) => {
            try {
              return governor.interface.parseLog(log);
            } catch {
              return null;
            }
          })
          .find((e) => e && e.name === "VoteCast");

        // wait for the voting period to end (votingPeriod = 240 blocks)
        await mine(240);

        return { ...proposingValues, voteCastEvent };
      }

      it("should have set the vote", async () => {
        const { voteCastEvent, owner } = await loadFixture(afterVotingFixture);

        assert.equal(voteCastEvent.args.voter, owner.address);
        assert.equal(
          voteCastEvent.args.weight.toString(),
          parseEther("10000").toString()
        );
      });

      it("should allow executing the proposal", async () => {
        const { governor, token, owner } = await loadFixture(
          afterVotingFixture
        );

        await governor.execute(
          [token.target],
          [0],
          [
            token.interface.encodeFunctionData("mint", [
              owner.address,
              parseEther("25000"),
            ]),
          ],
          keccak256(toUtf8Bytes("Give the owner more tokens!"))
        );

        const balance = await token.balanceOf(owner.address);
        assert.equal(balance.toString(), parseEther("35000").toString());
      });
    });
  });
});
