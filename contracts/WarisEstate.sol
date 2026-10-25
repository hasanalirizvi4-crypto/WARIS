
 // SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract WarisEstate {
    struct Beneficiary {
        address wallet;
        uint256 sharePercent;
    }

    struct Estate {
        address owner;
        uint256 lastCheckIn;
        uint256 inactivityPeriod;
        bool exists;
        Beneficiary[] beneficiaries;
    }

    uint256 public nextEstateId = 1;

    mapping(uint256 => Estate) private estates;

    // ETH deposited into each estate, measured in wei.
    mapping(uint256 => uint256) private estateBalances;

    event EstateCreated(
        uint256 indexed estateId,
        address indexed owner,
        uint256 inactivityPeriod
    );

    event BeneficiaryAdded(
        uint256 indexed estateId,
        address indexed wallet,
        uint256 sharePercent
    );

    event CheckIn(
        uint256 indexed estateId,
        uint256 timestamp
    );

    event DepositMade(
        uint256 indexed estateId,
        address indexed depositor,
        uint256 amount
    );

    modifier onlyEstateOwner(uint256 estateId) {
        require(estates[estateId].exists, "Estate does not exist");
        require(
            estates[estateId].owner == msg.sender,
            "Only estate owner"
        );
        _;
    }

    function createEstate(
        uint256 inactivityPeriod
    ) external returns (uint256 estateId) {
        require(
            inactivityPeriod >= 1 days,
            "Period must be at least one day"
        );

        estateId = nextEstateId++;

        Estate storage estate = estates[estateId];
        estate.owner = msg.sender;
        estate.lastCheckIn = block.timestamp;
        estate.inactivityPeriod = inactivityPeriod;
        estate.exists = true;

        emit EstateCreated(
            estateId,
            msg.sender,
            inactivityPeriod
        );
    }

    function addBeneficiary(
        uint256 estateId,
        address wallet,
        uint256 sharePercent
    ) external onlyEstateOwner(estateId) {
        require(wallet != address(0), "Invalid wallet");
        require(wallet != msg.sender, "Owner cannot be beneficiary");
        require(sharePercent > 0, "Share must be greater than zero");
        require(sharePercent <= 100, "Share cannot exceed 100");

        Estate storage estate = estates[estateId];
        uint256 totalShare;

        for (uint256 i = 0; i < estate.beneficiaries.length; i++) {
            require(
                estate.beneficiaries[i].wallet != wallet,
                "Beneficiary already exists"
            );

            totalShare += estate.beneficiaries[i].sharePercent;
        }

        require(
            totalShare + sharePercent <= 100,
            "Total shares exceed 100"
        );

        estate.beneficiaries.push(
            Beneficiary({
                wallet: wallet,
                sharePercent: sharePercent
            })
        );

        emit BeneficiaryAdded(estateId, wallet, sharePercent);
    }

    function checkIn(
        uint256 estateId
    ) external onlyEstateOwner(estateId) {
        Estate storage estate = estates[estateId];
        estate.lastCheckIn = block.timestamp;

        emit CheckIn(estateId, block.timestamp);
    }

    // Deposit ETH into an estate owned by the caller.
    function depositToEstate(
        uint256 estateId
    ) external payable onlyEstateOwner(estateId) {
        require(msg.value > 0, "Deposit must be greater than zero");

        estateBalances[estateId] += msg.value;

        emit DepositMade(estateId, msg.sender, msg.value);
    }

    // Read the amount recorded for this estate, in wei.
    function getEstateBalance(
        uint256 estateId
    ) external view returns (uint256) {
        require(estates[estateId].exists, "Estate does not exist");

        return estateBalances[estateId];
    }

    function getEstate(
        uint256 estateId
    )
        external
        view
        returns (
            address owner,
            uint256 lastCheckIn,
            uint256 inactivityPeriod,
            uint256 beneficiaryCount
        )
    {
        require(estates[estateId].exists, "Estate does not exist");

        Estate storage estate = estates[estateId];

        return (
            estate.owner,
            estate.lastCheckIn,
            estate.inactivityPeriod,
            estate.beneficiaries.length
        );
    }

    function getBeneficiary(
        uint256 estateId,
        uint256 index
    )
        external
        view
        returns (address wallet, uint256 sharePercent)
    {
        require(estates[estateId].exists, "Estate does not exist");
        require(
            index < estates[estateId].beneficiaries.length,
            "Invalid beneficiary index"
        );

        Beneficiary storage beneficiary =
            estates[estateId].beneficiaries[index];

        return (beneficiary.wallet, beneficiary.sharePercent);
    }

    function isInactive(
        uint256 estateId
    ) external view returns (bool) {
        require(estates[estateId].exists, "Estate does not exist");

        Estate storage estate = estates[estateId];

        return block.timestamp >=
            estate.lastCheckIn + estate.inactivityPeriod;
    }
}
