const { ethers } = require("hardhat");
const { mine } = require("@nomicfoundation/hardhat-network-helpers");
require("dotenv").config();

const governorContract = "0x5B297a47Dfb17384cEF3862f105EA4a8BC5a38F0";
const tokenContract = "0x0643a61241161AA3cc3472585FF431086591e3eB";
const owner = process.env.SEPOLIA_WALLET_ADDRESS;

async function main() {
  await propose();
}

async function deployFixture() {
  const governor = await ethers.getContractAt("Governor", governorContract);
  const token = await ethers.getContractAt("MyToken", tokenContract);

  return { governor, token };
}

async function propose() {
  const fixture = await deployFixture();
  const { governor, token } = fixture;
  const tx = await governor.propose(
    [token.address],
    [0],
    [
      token.interface.encodeFunctionData("mint", [
        owner,
        ethers.utils.parseEther("25000"),
      ]),
    ],
    "Give the owner more tokens!"
  );

  const receipt = await tx.wait();
  const events = receipt.events.find((x) => x.event === "ProposalCreated");
  const { proposalId } = events.args;
  console.log({ proposalId });
  const state = await governor.state(proposalId);
  console.log({ state });
  console.log("before balance : ", await token.balanceOf(owner));

  // wait for the 1 block voting delay
  //ISSUE: await ethers.provider.send("evm_mine");
  await vote(proposalId);
}

async function vote(proposalId) {
  const fixture = await deployFixture();
  const { governor, token } = fixture;
  const tx = await governor.castVote(proposalId, 1);
  const receipt = await tx.wait();

  const voteCastEvent = receipt.events.find((x) => x.event === "VoteCast");
  console.log({ voteCastEvent });

  // wait for the 1 block voting period
  //ISSUE: await ethers.provider.send("evm_mine");
  await execute();
}

async function execute() {
  const fixture = await deployFixture();
  const { governor, token } = fixture;

  const tx = await governor.execute(
    [token.address],
    [0],
    [
      token.interface.encodeFunctionData("mint", [
        owner,
        ethers.utils.parseEther("25000"),
      ]),
    ],
    ethers.utils.keccak256(
      ethers.utils.toUtf8Bytes("Give the owner more tokens!")
    )
  );
  console.log("after balance : ", await token.balanceOf(owner));
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
