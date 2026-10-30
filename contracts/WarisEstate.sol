// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title WARIS digital estate registry
/// @notice Each wallet can open one estate. The estate records its owner, the
///         time it was created, the owner's last check-in, an inactivity
///         (check-in) period in seconds, beneficiary wallets with percentage
///         shares, and an ETH balance the owner can deposit and withdraw.
/// @dev Built for Ethereum Sepolia testing. This contract does not transfer
///      funds to beneficiaries; it only records the plan and owner activity.
contract WarisEstate {
    // ---------------------------------------------------------------------
    // Constants
    // ---------------------------------------------------------------------

    /// Shortest allowed check-in period: one day, in seconds.
    uint256 public constant MIN_INACTIVITY_PERIOD = 1 days;

    /// Longest allowed check-in period: about ten years, in seconds.
    uint256 public constant MAX_INACTIVITY_PERIOD = 3650 days;

    /// Upper limit that keeps beneficiary loops cheap.
    uint256 public constant MAX_BENEFICIARIES = 20;

    /// Beneficiary shares are whole percentages of this total.
    uint256 public constant TOTAL_SHARE_PERCENT = 100;

    // ---------------------------------------------------------------------
    // Storage
    // ---------------------------------------------------------------------

    struct Beneficiary {
        address wallet;
        uint256 sharePercent;
    }

    struct Estate {
        address owner;
        uint256 createdAt; // block timestamp of creation (seconds)
        uint256 createdAtBlock; // block number of creation, for event lookups
        uint256 lastCheckIn; // block timestamp of the latest owner check-in
        uint256 inactivityPeriod; // seconds allowed between check-ins
        uint256 allocatedShares; // sum of beneficiary shares (0-100)
        uint256 balance; // ETH held for this estate, in wei
        Beneficiary[] beneficiaries;
    }

    /// The id the next estate will receive. Estate ids start at 1.
    uint256 public nextEstateId = 1;

    /// The estate id owned by a wallet, or 0 if the wallet has none.
    mapping(address => uint256) public estateIdOf;

    mapping(uint256 => Estate) private estates;

    /// Position of a beneficiary in its estate's list, plus one (0 = absent).
    mapping(uint256 => mapping(address => uint256)) private beneficiaryPosition;

    // ---------------------------------------------------------------------
    // Events
    // ---------------------------------------------------------------------

    event EstateCreated(
        uint256 indexed estateId,
        address indexed owner,
        uint256 inactivityPeriod,
        uint256 createdAt
    );

    event InactivityPeriodUpdated(
        uint256 indexed estateId,
        uint256 previousPeriod,
        uint256 newPeriod
    );

    event BeneficiaryAdded(
        uint256 indexed estateId,
        address indexed wallet,
        uint256 sharePercent
    );

    event BeneficiaryRemoved(
        uint256 indexed estateId,
        address indexed wallet,
        uint256 sharePercent
    );

    event CheckIn(
        uint256 indexed estateId,
        uint256 timestamp,
        uint256 nextDeadline
    );

    event DepositMade(
        uint256 indexed estateId,
        address indexed depositor,
        uint256 amount
    );

    event WithdrawalMade(
        uint256 indexed estateId,
        address indexed owner,
        uint256 amount
    );

    // ---------------------------------------------------------------------
    // Modifiers
    // ---------------------------------------------------------------------

    modifier estateExists(uint256 estateId) {
        require(estates[estateId].owner != address(0), "Estate does not exist");
        _;
    }

    modifier onlyEstateOwner(uint256 estateId) {
        require(estates[estateId].owner != address(0), "Estate does not exist");
        require(estates[estateId].owner == msg.sender, "Only estate owner");
        _;
    }

    // ---------------------------------------------------------------------
    // Owner actions
    // ---------------------------------------------------------------------

    /// @notice Creates the caller's estate. The creation time is recorded as
    ///         the first check-in.
    /// @param inactivityPeriod Seconds allowed between check-ins.
    /// @return estateId The new estate's id.
    function createEstate(
        uint256 inactivityPeriod
    ) external returns (uint256 estateId) {
        require(estateIdOf[msg.sender] == 0, "Wallet already has an estate");
        _requireValidPeriod(inactivityPeriod);

        estateId = nextEstateId++;

        Estate storage estate = estates[estateId];
        estate.owner = msg.sender;
        estate.createdAt = block.timestamp;
        estate.createdAtBlock = block.number;
        estate.lastCheckIn = block.timestamp;
        estate.inactivityPeriod = inactivityPeriod;

        estateIdOf[msg.sender] = estateId;

        emit EstateCreated(
            estateId,
            msg.sender,
            inactivityPeriod,
            block.timestamp
        );
    }

    /// @notice Changes how long the estate waits between check-ins.
    function updateInactivityPeriod(
        uint256 estateId,
        uint256 newPeriod
    ) external onlyEstateOwner(estateId) {
        _requireValidPeriod(newPeriod);

        Estate storage estate = estates[estateId];
        uint256 previousPeriod = estate.inactivityPeriod;
        estate.inactivityPeriod = newPeriod;

        emit InactivityPeriodUpdated(estateId, previousPeriod, newPeriod);
    }

    /// @notice Adds a beneficiary wallet with a whole-number percentage share.
    function addBeneficiary(
        uint256 estateId,
        address wallet,
        uint256 sharePercent
    ) external onlyEstateOwner(estateId) {
        require(wallet != address(0), "Invalid wallet");
        require(wallet != address(this), "Invalid wallet");
        require(wallet != msg.sender, "Owner cannot be beneficiary");
        require(sharePercent > 0, "Share must be greater than zero");
        require(
            sharePercent <= TOTAL_SHARE_PERCENT,
            "Share cannot exceed 100"
        );
        require(
            beneficiaryPosition[estateId][wallet] == 0,
            "Beneficiary already exists"
        );

        Estate storage estate = estates[estateId];
        require(
            estate.beneficiaries.length < MAX_BENEFICIARIES,
            "Too many beneficiaries"
        );
        require(
            estate.allocatedShares + sharePercent <= TOTAL_SHARE_PERCENT,
            "Total shares exceed 100"
        );

        estate.beneficiaries.push(
            Beneficiary({wallet: wallet, sharePercent: sharePercent})
        );
        estate.allocatedShares += sharePercent;
        beneficiaryPosition[estateId][wallet] = estate.beneficiaries.length;

        emit BeneficiaryAdded(estateId, wallet, sharePercent);
    }

    /// @notice Removes a beneficiary and frees their share.
    function removeBeneficiary(
        uint256 estateId,
        address wallet
    ) external onlyEstateOwner(estateId) {
        uint256 position = beneficiaryPosition[estateId][wallet];
        require(position != 0, "Beneficiary not found");

        Estate storage estate = estates[estateId];
        uint256 index = position - 1;
        uint256 lastIndex = estate.beneficiaries.length - 1;
        uint256 removedShare = estate.beneficiaries[index].sharePercent;

        if (index != lastIndex) {
            Beneficiary memory moved = estate.beneficiaries[lastIndex];
            estate.beneficiaries[index] = moved;
            beneficiaryPosition[estateId][moved.wallet] = position;
        }

        estate.beneficiaries.pop();
        delete beneficiaryPosition[estateId][wallet];
        estate.allocatedShares -= removedShare;

        emit BeneficiaryRemoved(estateId, wallet, removedShare);
    }

    /// @notice Records that the owner is active (proof of life).
    function checkIn(uint256 estateId) external onlyEstateOwner(estateId) {
        Estate storage estate = estates[estateId];
        estate.lastCheckIn = block.timestamp;

        emit CheckIn(
            estateId,
            block.timestamp,
            block.timestamp + estate.inactivityPeriod
        );
    }

    /// @notice Adds ETH to the caller's estate balance.
    function depositToEstate(
        uint256 estateId
    ) external payable onlyEstateOwner(estateId) {
        require(msg.value > 0, "Deposit must be greater than zero");

        estates[estateId].balance += msg.value;

        emit DepositMade(estateId, msg.sender, msg.value);
    }

    /// @notice Sends ETH from the estate balance back to the owner.
    /// @param amount Amount in wei.
    function withdrawFromEstate(
        uint256 estateId,
        uint256 amount
    ) external onlyEstateOwner(estateId) {
        require(amount > 0, "Amount must be greater than zero");

        Estate storage estate = estates[estateId];
        require(amount <= estate.balance, "Insufficient estate balance");

        // Update the balance before sending ETH (checks-effects-interactions).
        estate.balance -= amount;

        (bool sent, ) = payable(msg.sender).call{value: amount}("");
        require(sent, "ETH transfer failed");

        emit WithdrawalMade(estateId, msg.sender, amount);
    }

    // ---------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------

    /// @notice Returns the main estate record.
    function getEstate(
        uint256 estateId
    )
        external
        view
        estateExists(estateId)
        returns (
            address owner,
            uint256 createdAt,
            uint256 createdAtBlock,
            uint256 lastCheckIn,
            uint256 inactivityPeriod,
            uint256 beneficiaryCount,
            uint256 allocatedShares,
            uint256 balance
        )
    {
        Estate storage estate = estates[estateId];

        return (
            estate.owner,
            estate.createdAt,
            estate.createdAtBlock,
            estate.lastCheckIn,
            estate.inactivityPeriod,
            estate.beneficiaries.length,
            estate.allocatedShares,
            estate.balance
        );
    }

    /// @notice Returns one beneficiary by list position.
    function getBeneficiary(
        uint256 estateId,
        uint256 index
    )
        external
        view
        estateExists(estateId)
        returns (address wallet, uint256 sharePercent)
    {
        require(
            index < estates[estateId].beneficiaries.length,
            "Invalid beneficiary index"
        );

        Beneficiary storage beneficiary = estates[estateId].beneficiaries[index];

        return (beneficiary.wallet, beneficiary.sharePercent);
    }

    /// @notice Returns every beneficiary in one call.
    function getBeneficiaries(
        uint256 estateId
    )
        external
        view
        estateExists(estateId)
        returns (address[] memory wallets, uint256[] memory shares)
    {
        Beneficiary[] storage list = estates[estateId].beneficiaries;
        wallets = new address[](list.length);
        shares = new uint256[](list.length);

        for (uint256 i = 0; i < list.length; i++) {
            wallets[i] = list[i].wallet;
            shares[i] = list[i].sharePercent;
        }
    }

    /// @notice ETH held for the estate, in wei.
    function getEstateBalance(
        uint256 estateId
    ) external view estateExists(estateId) returns (uint256) {
        return estates[estateId].balance;
    }

    /// @notice Time after which the estate counts as inactive.
    function checkInDeadline(
        uint256 estateId
    ) public view estateExists(estateId) returns (uint256) {
        Estate storage estate = estates[estateId];
        return estate.lastCheckIn + estate.inactivityPeriod;
    }

    /// @notice True once the owner has missed the check-in deadline.
    function isInactive(
        uint256 estateId
    ) external view returns (bool) {
        return block.timestamp >= checkInDeadline(estateId);
    }

    // ---------------------------------------------------------------------
    // Internal helpers
    // ---------------------------------------------------------------------

    function _requireValidPeriod(uint256 period) private pure {
        require(
            period >= MIN_INACTIVITY_PERIOD,
            "Period must be at least one day"
        );
        require(
            period <= MAX_INACTIVITY_PERIOD,
            "Period cannot exceed 3650 days"
        );
    }
}
