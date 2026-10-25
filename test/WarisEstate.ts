
import { expect } from "chai";
import { network } from "hardhat";

describe("WarisEstate", function () {
  async function deployWarisEstate() {
    const { ethers } = await network.create();

    const [owner, beneficiary, anotherWallet] =
      await ethers.getSigners();

    const factory = await ethers.getContractFactory("WarisEstate");
    const waris = await factory.deploy();

    await waris.waitForDeployment();

    return {
      waris,
      owner,
      beneficiary,
      anotherWallet,
      ethers,
    };
  }

  // 1. Create an estate
  it("should create an estate for the connected owner", async function () {
    const { waris, owner } = await deployWarisEstate();

    await waris.createEstate(30 * 24 * 60 * 60);

    const estate = await waris.getEstate(1);

    expect(estate[0]).to.equal(owner.address);
    expect(estate[3]).to.equal(0n);
  });

  // 2. Add a beneficiary
  it("should add a beneficiary with a valid share", async function () {
    const { waris, beneficiary } = await deployWarisEstate();

    await waris.createEstate(30 * 24 * 60 * 60);
    await waris.addBeneficiary(1, beneficiary.address, 50);

    const result = await waris.getBeneficiary(1, 0);

    expect(result[0]).to.equal(beneficiary.address);
    expect(result[1]).to.equal(50n);
  });

  // 3. Prevent beneficiary shares from exceeding 100%
  it("should reject beneficiary shares above 100 percent", async function () {
    const { waris, beneficiary, anotherWallet } =
      await deployWarisEstate();

    await waris.createEstate(30 * 24 * 60 * 60);
    await waris.addBeneficiary(1, beneficiary.address, 60);

    await expect(
      waris.addBeneficiary(1, anotherWallet.address, 50)
    ).to.be.revertedWith("Total shares exceed 100");
  });

  // 4. Prevent unauthorized check-ins
  it("should reject changes from a non-owner", async function () {
    const { waris, anotherWallet } = await deployWarisEstate();

    await waris.createEstate(30 * 24 * 60 * 60);

    await expect(
      waris.connect(anotherWallet).checkIn(1)
    ).to.be.revertedWith("Only estate owner");
  });

  // 5. Allow the owner to check in
  it("should allow the owner to check in", async function () {
    const { waris } = await deployWarisEstate();

    await waris.createEstate(30 * 24 * 60 * 60);
    await waris.checkIn(1);

    const estate = await waris.getEstate(1);

    expect(estate[1]).to.be.greaterThan(0n);
  });

  // 6. Prevent duplicate beneficiaries
  it("should reject duplicate beneficiaries", async function () {
    const { waris, beneficiary } = await deployWarisEstate();

    await waris.createEstate(30 * 24 * 60 * 60);
    await waris.addBeneficiary(1, beneficiary.address, 40);

    await expect(
      waris.addBeneficiary(1, beneficiary.address, 20)
    ).to.be.revertedWith("Beneficiary already exists");
  });

  // 7. Require an inactivity period of at least one day
  it("should reject an inactivity period shorter than one day", async function () {
    const { waris } = await deployWarisEstate();

    await expect(
      waris.createEstate(60 * 60)
    ).to.be.revertedWith("Period must be at least one day");
  });

  // 8. Deposit 1 ETH into an estate
  it("should accept a deposit of 1 ETH and record the balance", async function () {
    const { waris, ethers } = await deployWarisEstate();

    await waris.createEstate(30 * 24 * 60 * 60);

    await waris.depositToEstate(1, {
      value: ethers.parseEther("1"),
    });

    const balance = await waris.getEstateBalance(1);

    expect(balance).to.equal(ethers.parseEther("1"));

    const contractBalance = await ethers.provider.getBalance(
      await waris.getAddress()
    );

    expect(contractBalance).to.equal(ethers.parseEther("1"));
  });

  // 9. Add multiple deposits together
  it("should add multiple deposits to the estate balance", async function () {
    const { waris, ethers } = await deployWarisEstate();

    await waris.createEstate(30 * 24 * 60 * 60);

    await waris.depositToEstate(1, {
      value: ethers.parseEther("1"),
    });

    await waris.depositToEstate(1, {
      value: ethers.parseEther("0.5"),
    });

    expect(await waris.getEstateBalance(1)).to.equal(
      ethers.parseEther("1.5")
    );
  });

  // 10. Reject zero-value deposits
  it("should reject a zero-value deposit", async function () {
    const { waris } = await deployWarisEstate();

    await waris.createEstate(30 * 24 * 60 * 60);

    await expect(
      waris.depositToEstate(1, { value: 0n })
    ).to.be.revertedWith("Deposit must be greater than zero");
  });

  // 11. Reject deposits from non-owners
  it("should reject a deposit from a non-owner", async function () {
    const { waris, anotherWallet, ethers } =
      await deployWarisEstate();

    await waris.createEstate(30 * 24 * 60 * 60);

    await expect(
      waris.connect(anotherWallet).depositToEstate(1, {
        value: ethers.parseEther("1"),
      })
    ).to.be.revertedWith("Only estate owner");
  });
});
