const { loadFixture, mine } = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { toUtf8Bytes, keccak256, parseEther } = ethers.utils;

describe("MyToken", function () {
  async function deployTokenFixture() {
    const [owner, addr1, addr2] = await ethers.getSigners();

    const MyToken = await ethers.getContractFactory("MyToken");
    const token = await MyToken.deploy();

    return { token, owner, addr1, addr2 };
  }

  describe("Deployment", () => {
    it("should set the correct name and symbol", async () => {
      const { token } = await loadFixture(deployTokenFixture);
      expect(await token.name()).to.equal("EMO-Governor");
      expect(await token.symbol()).to.equal("EMO-G");
    });

    it("should mint initial supply to the deployer", async () => {
      const { token, owner } = await loadFixture(deployTokenFixture);
      expect(await token.balanceOf(owner.address)).to.equal(parseEther("10000"));
    });

    it("should set total supply to 10000 tokens", async () => {
      const { token } = await loadFixture(deployTokenFixture);
      expect(await token.totalSupply()).to.equal(parseEther("10000"));
    });

    it("should have 18 decimals", async () => {
      const { token } = await loadFixture(deployTokenFixture);
      expect(await token.decimals()).to.equal(18);
    });
  });

  describe("setGovernor", () => {
    it("should allow the owner to set the governor", async () => {
      const { token, addr1 } = await loadFixture(deployTokenFixture);
      await token.setGovernor(addr1.address);
      expect(await token.governor()).to.equal(addr1.address);
    });

    it("should revert when non-owner calls setGovernor", async () => {
      const { token, addr1 } = await loadFixture(deployTokenFixture);
      await expect(
        token.connect(addr1).setGovernor(addr1.address)
      ).to.be.revertedWith("Only owner");
    });

    it("should revert when governor is already set", async () => {
      const { token, addr1, addr2 } = await loadFixture(deployTokenFixture);
      await token.setGovernor(addr1.address);
      await expect(
        token.setGovernor(addr2.address)
      ).to.be.revertedWith("Governor already set");
    });
  });

  describe("mint", () => {
    it("should allow the governor to mint tokens", async () => {
      const { token, addr1, addr2 } = await loadFixture(deployTokenFixture);
      await token.setGovernor(addr1.address);
      await token.connect(addr1).mint(addr2.address, parseEther("500"));
      expect(await token.balanceOf(addr2.address)).to.equal(parseEther("500"));
    });

    it("should revert when non-governor calls mint", async () => {
      const { token, addr1, addr2 } = await loadFixture(deployTokenFixture);
      await token.setGovernor(addr1.address);
      await expect(
        token.connect(addr2).mint(addr2.address, parseEther("500"))
      ).to.be.reverted;
    });

    it("should revert when no governor is set and anyone calls mint", async () => {
      const { token, owner } = await loadFixture(deployTokenFixture);
      await expect(
        token.mint(owner.address, parseEther("500"))
      ).to.be.reverted;
    });
  });

  describe("ERC20 functionality", () => {
    it("should transfer tokens between accounts", async () => {
      const { token, owner, addr1 } = await loadFixture(deployTokenFixture);
      await token.transfer(addr1.address, parseEther("100"));
      expect(await token.balanceOf(addr1.address)).to.equal(parseEther("100"));
      expect(await token.balanceOf(owner.address)).to.equal(parseEther("9900"));
    });

    it("should approve and transferFrom", async () => {
      const { token, owner, addr1, addr2 } = await loadFixture(deployTokenFixture);
      await token.approve(addr1.address, parseEther("200"));
      expect(await token.allowance(owner.address, addr1.address)).to.equal(parseEther("200"));
      await token.connect(addr1).transferFrom(owner.address, addr2.address, parseEther("150"));
      expect(await token.balanceOf(addr2.address)).to.equal(parseEther("150"));
    });

    it("should fail transfer when insufficient balance", async () => {
      const { token, addr1, addr2 } = await loadFixture(deployTokenFixture);
      await expect(
        token.connect(addr1).transfer(addr2.address, parseEther("1"))
      ).to.be.revertedWith("ERC20: transfer amount exceeds balance");
    });
  });

  describe("ERC20Votes delegation", () => {
    it("should have zero voting power before delegation", async () => {
      const { token, owner } = await loadFixture(deployTokenFixture);
      expect(await token.getVotes(owner.address)).to.equal(0);
    });

    it("should track voting power after self-delegation", async () => {
      const { token, owner } = await loadFixture(deployTokenFixture);
      await token.delegate(owner.address);
      expect(await token.getVotes(owner.address)).to.equal(parseEther("10000"));
    });

    it("should allow delegating to another account", async () => {
      const { token, owner, addr1 } = await loadFixture(deployTokenFixture);
      await token.delegate(addr1.address);
      expect(await token.getVotes(addr1.address)).to.equal(parseEther("10000"));
      expect(await token.getVotes(owner.address)).to.equal(0);
    });

    it("should update voting power on transfer after delegation", async () => {
      const { token, owner, addr1 } = await loadFixture(deployTokenFixture);
      await token.delegate(owner.address);
      await token.transfer(addr1.address, parseEther("3000"));
      expect(await token.getVotes(owner.address)).to.equal(parseEther("7000"));
    });
  });
});

describe("MyGovernor", function () {
  async function deployFixture() {
    const [owner, otherAccount, voter2] = await ethers.getSigners();

    const MyToken = await ethers.getContractFactory("MyToken");
    const token = await MyToken.deploy();

    const MyGovernor = await ethers.getContractFactory("MyGovernor");
    const governor = await MyGovernor.deploy(token.address);

    await token.setGovernor(governor.address);
    await token.delegate(owner.address);

    return { governor, token, owner, otherAccount, voter2 };
  }

  describe("Configuration", () => {
    it("should have the correct name", async () => {
      const { governor } = await loadFixture(deployFixture);
      expect(await governor.name()).to.equal("MyGovernor");
    });

    it("should have a voting delay of 4 blocks", async () => {
      const { governor } = await loadFixture(deployFixture);
      expect(await governor.votingDelay()).to.equal(4);
    });

    it("should have a voting period of 240 blocks", async () => {
      const { governor } = await loadFixture(deployFixture);
      expect(await governor.votingPeriod()).to.equal(240);
    });

    it("should have a proposal threshold of 0", async () => {
      const { governor } = await loadFixture(deployFixture);
      expect(await governor.proposalThreshold()).to.equal(0);
    });

    it("should have a quorum numerator of 4", async () => {
      const { governor } = await loadFixture(deployFixture);
      expect(await governor["quorumNumerator()"]()).to.equal(4);
    });

    it("should have a quorum denominator of 100", async () => {
      const { governor } = await loadFixture(deployFixture);
      expect(await governor.quorumDenominator()).to.equal(100);
    });
  });

  describe("Token integration", () => {
    it("should provide the owner with a starting balance", async () => {
      const { token, owner } = await loadFixture(deployFixture);
      const balance = await token.balanceOf(owner.address);
      expect(balance).to.equal(parseEther("10000"));
    });

    it("should have the correct token reference", async () => {
      const { governor, token } = await loadFixture(deployFixture);
      expect(await governor.token()).to.equal(token.address);
    });
  });

  describe("Proposal lifecycle", () => {
    function getProposalParams(token, ownerAddress) {
      return {
        targets: [token.address],
        values: [0],
        calldatas: [
          token.interface.encodeFunctionData("mint", [
            ownerAddress,
            parseEther("25000"),
          ]),
        ],
        description: "Give the owner more tokens!",
      };
    }

    async function afterProposingFixture() {
      const deployValues = await deployFixture();
      const { governor, token, owner } = deployValues;

      const params = getProposalParams(token, owner.address);
      const tx = await governor.propose(
        params.targets,
        params.values,
        params.calldatas,
        params.description
      );
      const receipt = await tx.wait();
      const event = receipt.events.find((x) => x.event === "ProposalCreated");
      const { proposalId } = event.args;

      return { ...deployValues, proposalId, params };
    }

    async function activeProposalFixture() {
      const values = await afterProposingFixture();
      // Mine past the voting delay (4 blocks + 1 for state read)
      await mine(5);
      return values;
    }

    async function afterVotingFixture() {
      const proposingValues = await activeProposalFixture();
      const { governor, proposalId } = proposingValues;

      const tx = await governor.castVote(proposalId, 1); // Vote For
      const receipt = await tx.wait();
      const voteCastEvent = receipt.events.find(
        (x) => x.event === "VoteCast"
      );

      // Mine past the voting period (240 blocks)
      await mine(240);

      return { ...proposingValues, voteCastEvent };
    }

    it("should emit ProposalCreated event", async () => {
      const { governor, token, owner } = await loadFixture(deployFixture);
      const params = getProposalParams(token, owner.address);
      await expect(
        governor.propose(params.targets, params.values, params.calldatas, params.description)
      ).to.emit(governor, "ProposalCreated");
    });

    it("should set the proposal to Pending state initially", async () => {
      const { governor, proposalId } = await loadFixture(afterProposingFixture);
      // 0 = Pending
      expect(await governor.state(proposalId)).to.equal(0);
    });

    it("should transition to Active state after voting delay", async () => {
      const { governor, proposalId } = await loadFixture(activeProposalFixture);
      // 1 = Active
      expect(await governor.state(proposalId)).to.equal(1);
    });

    it("should revert voting before the voting delay passes", async () => {
      const { governor, proposalId } = await loadFixture(afterProposingFixture);
      await expect(
        governor.castVote(proposalId, 1)
      ).to.be.revertedWith("Governor: vote not currently active");
    });

    describe("Voting", () => {
      it("should record a For vote correctly", async () => {
        const { governor, proposalId } = await loadFixture(activeProposalFixture);
        await governor.castVote(proposalId, 1);
        const { forVotes } = await governor.proposalVotes(proposalId);
        expect(forVotes).to.equal(parseEther("10000"));
      });

      it("should record an Against vote correctly", async () => {
        const { governor, proposalId } = await loadFixture(activeProposalFixture);
        await governor.castVote(proposalId, 0);
        const { againstVotes } = await governor.proposalVotes(proposalId);
        expect(againstVotes).to.equal(parseEther("10000"));
      });

      it("should record an Abstain vote correctly", async () => {
        const { governor, proposalId } = await loadFixture(activeProposalFixture);
        await governor.castVote(proposalId, 2);
        const { abstainVotes } = await governor.proposalVotes(proposalId);
        expect(abstainVotes).to.equal(parseEther("10000"));
      });

      it("should emit VoteCast event with correct weight", async () => {
        const { governor, proposalId, owner } = await loadFixture(activeProposalFixture);
        await expect(governor.castVote(proposalId, 1))
          .to.emit(governor, "VoteCast")
          .withArgs(owner.address, proposalId, 1, parseEther("10000"), "");
      });

      it("should prevent double voting", async () => {
        const { governor, proposalId } = await loadFixture(activeProposalFixture);
        await governor.castVote(proposalId, 1);
        await expect(
          governor.castVote(proposalId, 1)
        ).to.be.revertedWith("GovernorVotingSimple: vote already cast");
      });

      it("should allow casting vote with reason", async () => {
        const { governor, proposalId } = await loadFixture(activeProposalFixture);
        await expect(
          governor.castVoteWithReason(proposalId, 1, "I support this")
        ).to.emit(governor, "VoteCast");
      });
    });

    describe("Proposal outcome", () => {
      it("should set the vote and weight correctly", async () => {
        const { voteCastEvent, owner } = await loadFixture(afterVotingFixture);
        expect(voteCastEvent.args.voter).to.equal(owner.address);
        expect(voteCastEvent.args.weight).to.equal(parseEther("10000"));
      });

      it("should mark proposal as Succeeded after voting period", async () => {
        const { governor, proposalId } = await loadFixture(afterVotingFixture);
        // 4 = Succeeded
        expect(await governor.state(proposalId)).to.equal(4);
      });

      it("should mark proposal as Defeated if voted Against", async () => {
        const values = await activeProposalFixture();
        const { governor, proposalId } = values;

        await governor.castVote(proposalId, 0); // Against
        await mine(240);

        // 3 = Defeated
        expect(await governor.state(proposalId)).to.equal(3);
      });

      it("should mark proposal as Defeated if quorum not met", async () => {
        const [, , , smallHolder] = await ethers.getSigners();
        const values = await deployFixture();
        const { governor, token, owner } = values;

        // Transfer most tokens away (don't delegate them)
        await token.transfer(smallHolder.address, parseEther("9999"));

        const params = getProposalParams(token, owner.address);
        const tx = await governor.propose(
          params.targets, params.values, params.calldatas, params.description
        );
        const receipt = await tx.wait();
        const event = receipt.events.find((x) => x.event === "ProposalCreated");
        const { proposalId } = event.args;

        await mine(4);
        // Owner votes with only 1 token (delegated)
        await governor.castVote(proposalId, 1);
        await mine(240);

        // Quorum is 4% of 10000 = 400 tokens, owner only has 1
        // 3 = Defeated
        expect(await governor.state(proposalId)).to.equal(3);
      });
    });

    describe("Execution", () => {
      it("should allow executing a succeeded proposal", async () => {
        const { governor, token, owner, params } = await loadFixture(afterVotingFixture);

        await governor.execute(
          params.targets,
          params.values,
          params.calldatas,
          keccak256(toUtf8Bytes(params.description))
        );

        const balance = await token.balanceOf(owner.address);
        expect(balance).to.equal(parseEther("35000"));
      });

      it("should emit ProposalExecuted event", async () => {
        const { governor, params } = await loadFixture(afterVotingFixture);

        await expect(
          governor.execute(
            params.targets,
            params.values,
            params.calldatas,
            keccak256(toUtf8Bytes(params.description))
          )
        ).to.emit(governor, "ProposalExecuted");
      });

      it("should set state to Executed after execution", async () => {
        const { governor, proposalId, params } = await loadFixture(afterVotingFixture);

        await governor.execute(
          params.targets,
          params.values,
          params.calldatas,
          keccak256(toUtf8Bytes(params.description))
        );

        // 7 = Executed
        expect(await governor.state(proposalId)).to.equal(7);
      });

      it("should revert execution of a non-succeeded proposal", async () => {
        const { governor, params } = await loadFixture(afterProposingFixture);

        await expect(
          governor.execute(
            params.targets,
            params.values,
            params.calldatas,
            keccak256(toUtf8Bytes(params.description))
          )
        ).to.be.revertedWith("Governor: proposal not successful");
      });
    });
  });
});
