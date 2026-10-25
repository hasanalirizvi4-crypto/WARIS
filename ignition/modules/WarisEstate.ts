
import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const WarisEstateModule = buildModule("WarisEstateModule", (m) => {
  const warisEstate = m.contract("WarisEstate");

  return { warisEstate };
});

export default WarisEstateModule;
