import { expect } from "chai";
import { network } from "hardhat";
import { anyValue } from "@nomicfoundation/hardhat-ethers-chai-matchers/withArgs";

const { ethers, networkHelpers } = await network.create();

const ONE_DAY = 24n * 60n * 60n;
const THIRTY_DAYS = 30n * ONE_DAY; // 2,592,000 seconds

describe("WarisEstate", function () {
  async function deployWarisEstate() {
    const [owner, beneficiary, anotherWallet, thirdWallet] =
      await ethers.getSigners();

    const waris = await ethers.deployContract("WarisEstate");
    await waris.waitForDeployment();

    return { waris, owner, beneficiary, anotherWallet, thirdWallet };
  }

  async function deployWithEstate() {
    const deployed = await deployWarisEstate();
    await (await deployed.waris.createEstate(THIRTY_DAYS)).wait();
    return deployed;
  }

  describe("Deployment", function () {
    it("starts with estate id 1 and the expected limits", async function () {
      const { waris } = await networkHelpers.loadFixture(deployWarisEstate);

      expect(await waris.nextEstateId()).to.equal(1n);
      expect(await waris.MIN_INACTIVITY_PERIOD()).to.equal(ONE_DAY);
      expect(await waris.MAX_INACTIVITY_PERIOD()).to.equal(3650n * ONE_DAY);
      expect(await waris.MAX_BENEFICIARIES()).to.equal(20n);
      expect(await waris.TOTAL_SHARE_PERCENT()).to.equal(100n);
    });
  });

  describe("The 4-step estate creation flow", function () {
    it("connect wallet → 30 days → estate record → confirmed transaction", async function () {
      const { waris, owner } =
        await networkHelpers.loadFixture(deployWarisEstate);

      // Step 1: the connected wallet exposes only its public address.
      const ownerAddress = await owner.getAddress();
      const balanceBefore = await ethers.provider.getBalance(ownerAddress);

      // Step 2: the frontend converts 30 days into seconds.
      const days = 30n;
      const periodInSeconds = days * ONE_DAY;
      expect(periodInSeconds).to.equal(2_592_000n);

      // Step 4: the wallet submits the transaction and it is confirmed.
      const tx = await waris.createEstate(periodInSeconds);
      const receipt = await tx.wait();
      expect(receipt).to.not.equal(null);
      expect(receipt!.status).to.equal(1);

      // The estate id comes from the EstateCreated event in the receipt.
      const created = receipt!.logs
        .map((log) => waris.interface.parseLog(log))
        .find((parsed) => parsed?.name === "EstateCreated");
      expect(created).to.not.equal(undefined);
      const estateId = created!.args.estateId as bigint;
      expect(estateId).to.equal(1n);

      // Step 3: the contract stored owner, creation time and period.
      const block = await ethers.provider.getBlock(receipt!.blockNumber);
      const estate = await waris.getEstate(estateId);

      expect(estate.owner).to.equal(ownerAddress);
      expect(estate.createdAt).to.equal(BigInt(block!.timestamp));
      expect(estate.createdAtBlock).to.equal(BigInt(receipt!.blockNumber));
      expect(estate.lastCheckIn).to.equal(estate.createdAt);
      expect(estate.inactivityPeriod).to.equal(2_592_000n);
      expect(estate.beneficiaryCount).to.equal(0n);
      expect(estate.allocatedShares).to.equal(0n);
      expect(estate.balance).to.equal(0n);
      expect(await waris.estateIdOf(ownerAddress)).to.equal(estateId);

      // Gas was paid in (test) ETH: the balance dropped by exactly the fee.
      const fee = receipt!.gasUsed * receipt!.gasPrice;
      expect(fee > 0n).to.equal(true);
      expect(await ethers.provider.getBalance(ownerAddress)).to.equal(
        balanceBefore - fee
      );
    });

    it("emits EstateCreated with the owner, period and creation time", async function () {
      const { waris, owner } =
        await networkHelpers.loadFixture(deployWarisEstate);

      await expect(waris.createEstate(THIRTY_DAYS))
        .to.emit(waris, "EstateCreated")
        .withArgs(1n, owner.address, THIRTY_DAYS, anyValue);
    });
  });

  describe("createEstate", function () {
    it("accepts the minimum (1 day) and maximum (3650 days) periods", async function () {
      const { waris, beneficiary } =
        await networkHelpers.loadFixture(deployWarisEstate);

      await waris.createEstate(ONE_DAY);
      await waris.connect(beneficiary).createEstate(3650n * ONE_DAY);

      expect((await waris.getEstate(1)).inactivityPeriod).to.equal(ONE_DAY);
      expect((await waris.getEstate(2)).inactivityPeriod).to.equal(
        3650n * ONE_DAY
      );
    });

    it("rejects a period shorter than one day", async function () {
      const { waris } = await networkHelpers.loadFixture(deployWarisEstate);

      await expect(waris.createEstate(ONE_DAY - 1n)).to.be.revertedWith(
        "Period must be at least one day"
      );
    });

    it("rejects a period longer than 3650 days", async function () {
      const { waris } = await networkHelpers.loadFixture(deployWarisEstate);

      await expect(
        waris.createEstate(3650n * ONE_DAY + 1n)
      ).to.be.revertedWith("Period cannot exceed 3650 days");
    });

    it("allows only one estate per wallet", async function () {
      const { waris } = await networkHelpers.loadFixture(deployWithEstate);

      await expect(waris.createEstate(THIRTY_DAYS)).to.be.revertedWith(
        "Wallet already has an estate"
      );
    });

    it("gives each wallet its own estate id", async function () {
      const { waris, owner, beneficiary, anotherWallet } =
        await networkHelpers.loadFixture(deployWithEstate);

      await waris.connect(beneficiary).createEstate(THIRTY_DAYS);

      expect(await waris.estateIdOf(owner.address)).to.equal(1n);
      expect(await waris.estateIdOf(beneficiary.address)).to.equal(2n);
      expect(await waris.estateIdOf(anotherWallet.address)).to.equal(0n);
      expect(await waris.nextEstateId()).to.equal(3n);
      expect((await waris.getEstate(2)).owner).to.equal(beneficiary.address);
    });
  });

  describe("Beneficiaries", function () {
    it("adds a beneficiary with a valid share", async function () {
      const { waris, beneficiary } =
        await networkHelpers.loadFixture(deployWithEstate);

      await expect(waris.addBeneficiary(1, beneficiary.address, 50))
        .to.emit(waris, "BeneficiaryAdded")
        .withArgs(1n, beneficiary.address, 50n);

      const [wallet, share] = await waris.getBeneficiary(1, 0);
      expect(wallet).to.equal(beneficiary.address);
      expect(share).to.equal(50n);

      const estate = await waris.getEstate(1);
      expect(estate.beneficiaryCount).to.equal(1n);
      expect(estate.allocatedShares).to.equal(50n);
    });

    it("returns every beneficiary in one call", async function () {
      const { waris, beneficiary, anotherWallet } =
        await networkHelpers.loadFixture(deployWithEstate);

      await waris.addBeneficiary(1, beneficiary.address, 60);
      await waris.addBeneficiary(1, anotherWallet.address, 40);

      const [wallets, shares] = await waris.getBeneficiaries(1);
      expect(wallets).to.deep.equal([
        beneficiary.address,
        anotherWallet.address,
      ]);
      expect(shares).to.deep.equal([60n, 40n]);
      expect((await waris.getEstate(1)).allocatedShares).to.equal(100n);
    });

    it("rejects shares that would total more than 100 percent", async function () {
      const { waris, beneficiary, anotherWallet } =
        await networkHelpers.loadFixture(deployWithEstate);

      await waris.addBeneficiary(1, beneficiary.address, 60);

      await expect(
        waris.addBeneficiary(1, anotherWallet.address, 50)
      ).to.be.revertedWith("Total shares exceed 100");
    });

    it("rejects invalid wallets and shares", async function () {
      const { waris, owner, beneficiary } =
        await networkHelpers.loadFixture(deployWithEstate);

      await expect(
        waris.addBeneficiary(1, ethers.ZeroAddress, 10)
      ).to.be.revertedWith("Invalid wallet");
      await expect(
        waris.addBeneficiary(1, await waris.getAddress(), 10)
      ).to.be.revertedWith("Invalid wallet");
      await expect(
        waris.addBeneficiary(1, owner.address, 10)
      ).to.be.revertedWith("Owner cannot be beneficiary");
      await expect(
        waris.addBeneficiary(1, beneficiary.address, 0)
      ).to.be.revertedWith("Share must be greater than zero");
      await expect(
        waris.addBeneficiary(1, beneficiary.address, 101)
      ).to.be.revertedWith("Share cannot exceed 100");
    });

    it("rejects duplicate beneficiaries", async function () {
      const { waris, beneficiary } =
        await networkHelpers.loadFixture(deployWithEstate);

      await waris.addBeneficiary(1, beneficiary.address, 40);

      await expect(
        waris.addBeneficiary(1, beneficiary.address, 20)
      ).to.be.revertedWith("Beneficiary already exists");
    });

    it("limits an estate to 20 beneficiaries", async function () {
      const { waris } = await networkHelpers.loadFixture(deployWithEstate);

      for (let i = 1; i <= 20; i++) {
        const wallet = ethers.getAddress(
          "0x" + i.toString(16).padStart(40, "0")
        );
        await waris.addBeneficiary(1, wallet, 1);
      }

      await expect(
        waris.addBeneficiary(1, ethers.getAddress("0x" + "ff".repeat(20)), 1)
      ).to.be.revertedWith("Too many beneficiaries");
    });

    it("removes a beneficiary and frees the share", async function () {
      const { waris, beneficiary, anotherWallet, thirdWallet } =
        await networkHelpers.loadFixture(deployWithEstate);

      await waris.addBeneficiary(1, beneficiary.address, 30);
      await waris.addBeneficiary(1, anotherWallet.address, 30);
      await waris.addBeneficiary(1, thirdWallet.address, 40);

      await expect(waris.removeBeneficiary(1, beneficiary.address))
        .to.emit(waris, "BeneficiaryRemoved")
        .withArgs(1n, beneficiary.address, 30n);

      const [wallets, shares] = await waris.getBeneficiaries(1);
      expect(wallets).to.deep.equal([
        thirdWallet.address,
        anotherWallet.address,
      ]);
      expect(shares).to.deep.equal([40n, 30n]);
      expect((await waris.getEstate(1)).allocatedShares).to.equal(70n);

      // The freed wallet and share can be used again.
      await waris.addBeneficiary(1, beneficiary.address, 30);
      expect((await waris.getEstate(1)).allocatedShares).to.equal(100n);
    });

    it("rejects removing a wallet that is not a beneficiary", async function () {
      const { waris, beneficiary } =
        await networkHelpers.loadFixture(deployWithEstate);

      await expect(
        waris.removeBeneficiary(1, beneficiary.address)
      ).to.be.revertedWith("Beneficiary not found");
    });

    it("rejects beneficiary changes from a non-owner", async function () {
      const { waris, beneficiary, anotherWallet } =
        await networkHelpers.loadFixture(deployWithEstate);

      await expect(
        waris.connect(anotherWallet).addBeneficiary(1, beneficiary.address, 10)
      ).to.be.revertedWith("Only estate owner");
      await expect(
        waris.connect(anotherWallet).removeBeneficiary(1, beneficiary.address)
      ).to.be.revertedWith("Only estate owner");
    });
  });

  describe("Check-ins", function () {
    it("lets the owner check in and moves the deadline", async function () {
      const { waris } = await networkHelpers.loadFixture(deployWithEstate);

      const before = await waris.getEstate(1);
      await networkHelpers.time.increase(10 * 24 * 60 * 60);

      await expect(waris.checkIn(1)).to.emit(waris, "CheckIn");

      const after = await waris.getEstate(1);
      const now = BigInt(await networkHelpers.time.latest());

      expect(after.lastCheckIn).to.equal(now);
      expect(after.lastCheckIn > before.lastCheckIn).to.equal(true);
      expect(after.createdAt).to.equal(before.createdAt);
      expect(await waris.checkInDeadline(1)).to.equal(now + THIRTY_DAYS);
    });

    it("rejects check-ins from a non-owner", async function () {
      const { waris, anotherWallet } =
        await networkHelpers.loadFixture(deployWithEstate);

      await expect(
        waris.connect(anotherWallet).checkIn(1)
      ).to.be.revertedWith("Only estate owner");
    });

    it("reports inactivity only after the deadline", async function () {
      const { waris } = await networkHelpers.loadFixture(deployWithEstate);

      const deadline = await waris.checkInDeadline(1);

      expect(await waris.isInactive(1)).to.equal(false);

      await networkHelpers.time.increaseTo(deadline - 1n);
      expect(await waris.isInactive(1)).to.equal(false);

      await networkHelpers.time.increaseTo(deadline);
      expect(await waris.isInactive(1)).to.equal(true);

      await waris.checkIn(1);
      expect(await waris.isInactive(1)).to.equal(false);
    });
  });

  describe("updateInactivityPeriod", function () {
    it("updates the period and emits the change", async function () {
      const { waris } = await networkHelpers.loadFixture(deployWithEstate);

      await expect(waris.updateInactivityPeriod(1, 90n * ONE_DAY))
        .to.emit(waris, "InactivityPeriodUpdated")
        .withArgs(1n, THIRTY_DAYS, 90n * ONE_DAY);

      expect((await waris.getEstate(1)).inactivityPeriod).to.equal(
        90n * ONE_DAY
      );
    });

    it("validates the new period and the caller", async function () {
      const { waris, anotherWallet } =
        await networkHelpers.loadFixture(deployWithEstate);

      await expect(
        waris.updateInactivityPeriod(1, 60n)
      ).to.be.revertedWith("Period must be at least one day");
      await expect(
        waris.connect(anotherWallet).updateInactivityPeriod(1, 90n * ONE_DAY)
      ).to.be.revertedWith("Only estate owner");
    });
  });

  describe("Deposits and withdrawals", function () {
    it("accepts deposits and records the balance", async function () {
      const { waris, owner } =
        await networkHelpers.loadFixture(deployWithEstate);

      await expect(
        waris.depositToEstate(1, { value: ethers.parseEther("1") })
      )
        .to.emit(waris, "DepositMade")
        .withArgs(1n, owner.address, ethers.parseEther("1"));
      await waris.depositToEstate(1, { value: ethers.parseEther("0.5") });

      expect(await waris.getEstateBalance(1)).to.equal(
        ethers.parseEther("1.5")
      );
      expect((await waris.getEstate(1)).balance).to.equal(
        ethers.parseEther("1.5")
      );
      expect(
        await ethers.provider.getBalance(await waris.getAddress())
      ).to.equal(ethers.parseEther("1.5"));
    });

    it("rejects zero deposits and deposits from a non-owner", async function () {
      const { waris, anotherWallet } =
        await networkHelpers.loadFixture(deployWithEstate);

      await expect(
        waris.depositToEstate(1, { value: 0n })
      ).to.be.revertedWith("Deposit must be greater than zero");
      await expect(
        waris
          .connect(anotherWallet)
          .depositToEstate(1, { value: ethers.parseEther("1") })
      ).to.be.revertedWith("Only estate owner");
    });

    it("lets the owner withdraw, so deposited ETH is never stuck", async function () {
      const { waris, owner } =
        await networkHelpers.loadFixture(deployWithEstate);

      await waris.depositToEstate(1, { value: ethers.parseEther("1") });

      await expect(
        waris.withdrawFromEstate(1, ethers.parseEther("0.4"))
      ).to.changeEtherBalances(
        ethers,
        [owner, waris],
        [ethers.parseEther("0.4"), -ethers.parseEther("0.4")]
      );

      expect(await waris.getEstateBalance(1)).to.equal(
        ethers.parseEther("0.6")
      );
    });

    it("rejects invalid withdrawals", async function () {
      const { waris, anotherWallet } =
        await networkHelpers.loadFixture(deployWithEstate);

      await waris.depositToEstate(1, { value: ethers.parseEther("1") });

      await expect(waris.withdrawFromEstate(1, 0n)).to.be.revertedWith(
        "Amount must be greater than zero"
      );
      await expect(
        waris.withdrawFromEstate(1, ethers.parseEther("1.01"))
      ).to.be.revertedWith("Insufficient estate balance");
      await expect(
        waris
          .connect(anotherWallet)
          .withdrawFromEstate(1, ethers.parseEther("0.1"))
      ).to.be.revertedWith("Only estate owner");
    });

    it("rejects plain ETH sent straight to the contract", async function () {
      const { waris, owner } =
        await networkHelpers.loadFixture(deployWithEstate);

      await expect(
        owner.sendTransaction({
          to: await waris.getAddress(),
          value: ethers.parseEther("1"),
        })
      ).to.revert(ethers);
    });
  });

  describe("Views", function () {
    it("reverts for an estate that does not exist", async function () {
      const { waris } = await networkHelpers.loadFixture(deployWarisEstate);

      await expect(waris.getEstate(1)).to.be.revertedWith(
        "Estate does not exist"
      );
      await expect(waris.getBeneficiaries(1)).to.be.revertedWith(
        "Estate does not exist"
      );
      await expect(waris.getEstateBalance(1)).to.be.revertedWith(
        "Estate does not exist"
      );
      await expect(waris.isInactive(1)).to.be.revertedWith(
        "Estate does not exist"
      );
      await expect(waris.checkIn(1)).to.be.revertedWith(
        "Estate does not exist"
      );
    });

    it("rejects an out-of-range beneficiary index", async function () {
      const { waris } = await networkHelpers.loadFixture(deployWithEstate);

      await expect(waris.getBeneficiary(1, 0)).to.be.revertedWith(
        "Invalid beneficiary index"
      );
    });
  });
});
