const { expect } = require("chai");
const { constants } = require("@openzeppelin/test-helpers");

describe("L1Bridge", function () {
  before(async function () {
    const accounts = await ethers.getSigners();
    this.owner = accounts[0];
    this.account1 = accounts[1];
    // code on L1 is not callable directly, so we take just random address
    this.l2Token = accounts[2];
    this.oracle = accounts[3];
    this.l1holder = accounts[4];
    this.minterAdmin = accounts[5];
    this.l2bridge = accounts[6];

    this.L1TokenArtifact = await ethers.getContractFactory("L1Token");
    this.L1BridgeArtifact = await ethers.getContractFactory("L1Bridge");
    this.DeBridgeGateArtifact = await ethers.getContractFactory(
      "DeBridgeGateMock"
    );
  });

  it("revert then trying finalizeInboundTransfer to zero address", async function () {
    await expect(
      this.L1BridgeArtifact.deploy(
        constants.ZERO_ADDRESS,
        this.account1.address,
        this.account1.address,
        this.account1.address
      )
    ).to.be.revertedWith("ZERO_TOKEN");
  });

  it("revert then trying finalizeInboundTransfer to zero address", async function () {
    await expect(
      this.L1BridgeArtifact.deploy(
        this.account1.address,
        this.account1.address,
        constants.ZERO_ADDRESS,
        this.account1.address
      )
    ).to.be.revertedWith("ZERO_TOKEN");
  });

  beforeEach(async function () {
    this.l1token = await this.L1TokenArtifact.deploy();
    this.l1debridgeGate = await this.DeBridgeGateArtifact.deploy();
    this.l1bridge = await this.L1BridgeArtifact.deploy(
      this.l1token.address,
      this.l1debridgeGate.address,
      this.l2Token.address,
      this.l2bridge.address
    );
    const ORACLE_ROLE = await this.l1bridge.ORACLE_ROLE();
    await this.l1bridge.grantRole(ORACLE_ROLE, this.oracle.address);
    await this.l1token.grantRole(
      await this.l1token.MINTER_ROLE(),
      this.minterAdmin.address
    );
    await this.l1token.grantRole(
      await this.l1token.DEFAULT_ADMIN_ROLE(),
      this.minterAdmin.address
    );
  });

  it("l1 token has proper name and symbol", async function () {
    expect(await this.l1token.name()).to.equal("Grizzly");
    expect(await this.l1token.symbol()).to.equal("GRZL");
  });

  it("should be deployed", async function () {
    expect(await this.l1bridge.deployed(), true);
    expect(await this.l1token.deployed(), true);
  });

  it("bridge has zero balance", async function () {
    expect(await this.l1token.balanceOf(this.l1bridge.address)).to.equal("0");
  });

  describe("after token deposited(first holder)", function () {
    beforeEach(async function () {
      await this.l1token
        .connect(this.minterAdmin)
        .mint(this.l1holder.address, 100);
    });

    it("token balance moved from holder to bridge", async function () {
      expect(await this.l1token.balanceOf(this.l1holder.address)).to.equal("1");
    });

    describe("l1holder transfer 100 token to l1bridge", function () {
      beforeEach(async function () {
        await this.l1token
          .connect(this.l1holder)
          .approve(this.l1bridge.address, 100);
        this.outboundTransferTx = await this.l1bridge
          .connect(this.l1holder)
          .outboundTransfer(this.l1holder.address, 100, { value: 123456 });
      });

      it("check events of outboundTransferTx transacted deBridgeGate", async function () {
        const PROXY_WITH_SENDER_POSITION = 2;
        const REVERT_IF_EXTERNAL_FAIL_POSITION = 1;
        const executionFee = "30000000000000000";
        const flags =
          2 ** REVERT_IF_EXTERNAL_FAIL_POSITION +
          2 ** PROXY_WITH_SENDER_POSITION;
        const fallbackAddress = this.l2bridge.address.toLowerCase();
        //todo: use l2 bridge interface to be consistent
        const data = this.l1bridge.interface.encodeFunctionData(
          "finalizeInboundTransfer",
          [this.l1holder.address, "", 100]
        );
        await expect(this.outboundTransferTx).to.emit(
          this.l1debridgeGate,
          "Sent"
        );
        await expect(this.outboundTransferTx)
          .to.emit(this.l1debridgeGate, "Log")
          .withArgs([executionFee, flags, fallbackAddress, data]);
      });

      it("l1bridge is ownerOf 100 token", async function () {
        expect(await this.l1token.ownerOf(100)).to.equal(this.l1bridge.address);
        expect(await this.l1token.balanceOf(this.l1bridge.address)).to.equal(
          "1"
        );
      });

      describe("l1holder transfer 100 token to l1bridge", function () {
        beforeEach(async function () {
          const l2Tx =
            "0x117ddadadc7b8d342cf48513fef06a2cba15dfb9c488dc51aefc998abcefb52b";
          await this.l1bridge
            .connect(this.oracle)
            .finalizeInboundTransfer(this.l1holder.address, l2Tx, 100);
        });

        it("l1holder is 100 token owner", async function () {
          expect(await this.l1token.ownerOf(100)).to.equal(
            this.l1holder.address
          );
          expect(await this.l1token.balanceOf(this.l1bridge.address)).to.equal(
            "0"
          );
          expect(await this.l1token.balanceOf(this.l1holder.address)).to.equal(
            "1"
          );
        });
      });
    });
  });
});
