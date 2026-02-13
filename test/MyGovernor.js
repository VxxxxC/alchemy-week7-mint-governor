const { loadFixture, mine } = require("@nomicfoundation/hardhat-network-helpers");
const { assert } = require("chai");
const { ethers } = require("hardhat");
const { toUtf8Bytes, keccak256, parseEther } = ethers.utils;

describe("MyGovernor", function () {
  async function deployFixture() {
    const [owner, otherAccount] = await ethers.getSigners();

    const MyToken = await ethers.getContractFactory("MyToken");
    const token = await MyToken.deploy();

    const MyGovernor = await ethers.getContractFactory("MyGovernor");
    const governor = await MyGovernor.deploy(token.address);

    await token.setGovernor(governor.address);

    const delegate = await token.delegate(owner.address);

    return { governor, token, owner, otherAccount };
  }

  it("should provide the owner with a starting balance", async () => {
    const { token, owner } = await loadFixture(deployFixture);

    const balance = await token.balanceOf(owner.address);
    assert.equal(balance.toString(), parseEther("10000"));
  });

  describe("after proposing", () => {
    async function afterProposingFixture() {
      const deployValues = await deployFixture();
      const { governor, token, owner } = deployValues;

      const tx = await governor.propose(
        [token.address],
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
      const event = receipt.events.find((x) => x.event === "ProposalCreated");
      const { proposalId } = event.args;

      // wait for the voting delay (4 blocks)
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
        const voteCastEvent = receipt.events.find(
          (x) => x.event === "VoteCast"
        );

        // wait for the voting period to end (240 blocks)
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
          [token.address],
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
