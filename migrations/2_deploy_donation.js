const DonationContract = artifacts.require("DonationContract");

module.exports = function (deployer) {
  // Развертывание контракта без параметров (конструктор не требует аргументов)
  deployer.deploy(DonationContract);
};


