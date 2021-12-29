module.exports = async function ({ getNamedAccounts, deployments }) {
  const { deployer } = await getNamedAccounts();
  const { deploy } = deployments;

  // const L1Token = await ethers.getContract("L1Token")
  const L1Token = "0x3C7c906791B4055013d08e5Fb210224fC4cA4EBd";
  // const L2Token = await ethers.getContract("L2Token")
  const L2Token = "0x49d25DD6a5BC2993c1A4762F826065940909Ee5F";

  console.log("deploying L1Bridge");

  await deploy("L1Bridge", {
    from: deployer,
    log: true,
    args: [L1Token, L2Token],
    skipIfAlreadyDeployed: true,
  });
};

module.exports.tags = ["L1Bridge"];
// module.exports.dependencies = ["L1Token", "L2Token"]
