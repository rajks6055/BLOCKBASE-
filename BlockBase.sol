// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title ExpenseTracker
 * @dev On-chain expense tracker for splitting costs among registered users.
 */
contract ExpenseTracker {
    struct Person {
        string name;
        address walletAddress;
    }

    struct Expense {
        uint256 id;
        string label;
        uint256 timestamp;
        mapping(address => uint256) amountPaid;
        mapping(address => uint256) amountOwed;
        address[] participants;
    }

    mapping(uint256 => Expense) private expenses;
    mapping(address => Person) private people;
    address[] private registeredPeople;
    uint256 public expenseCount;

    // Events
    event PersonRegistered(address indexed walletAddress, string name);
    event ExpenseAdded(uint256 indexed expenseId, string label);
    event DebtSettled(address indexed from, address indexed to, uint256 amount);
    event NameUpdated(address indexed walletAddress, string newName);

    // ===== Solidity Feature: Choose 1 =====
    // 1. Get your own name
    function getName() public view returns (string memory) {
        require(isRegistered(msg.sender), "Not registered");
        return people[msg.sender].name;
    }

    // 2. Check if a user is registered
    function isRegistered(address _addr) public view returns (bool) {
        return people[_addr].walletAddress != address(0);
    }

    // 3. Get total registered users
    function getRegisteredCount() public view returns (uint256) {
        return registeredPeople.length;
    }

    // 4. Get label of the last expense
    function getLastExpenseLabel() public view returns (string memory) {
        require(expenseCount > 0, "No expenses yet");
        return expenses[expenseCount - 1].label;
    }

    // 5. Update your name
    function updateName(string memory _newName) public {
        require(bytes(_newName).length > 0, "Name cannot be empty");
        require(isRegistered(msg.sender), "Not registered");
        people[msg.sender].name = _newName;
        emit NameUpdated(msg.sender, _newName);
    }

    // ===== Core Functions (Existing) =====
    function registerPerson(string memory _name) public {
        require(bytes(_name).length > 0, "Name cannot be empty");
        require(!isRegistered(msg.sender), "Already registered");
        people[msg.sender] = Person(_name, msg.sender);
        registeredPeople.push(msg.sender);
        emit PersonRegistered(msg.sender, _name);
    }

    function addExpense(
        string memory _label,
        address[] memory _participants,
        uint256[] memory _amountsPaid,
        uint256[] memory _amountsOwed
    ) public {
        require(bytes(_label).length > 0, "Label cannot be empty");
        require(_participants.length > 0, "No participants");
        require(_participants.length == _amountsPaid.length, "Invalid input");
        require(_participants.length == _amountsOwed.length, "Invalid input");

        uint256 expenseId = expenseCount++;
        Expense storage newExpense = expenses[expenseId];
        newExpense.id = expenseId;
        newExpense.label = _label;
        newExpense.timestamp = block.timestamp;

        for (uint256 i = 0; i < _participants.length; i++) {
            require(_participants[i] != address(0), "Invalid address");
            newExpense.participants.push(_participants[i]);
            newExpense.amountPaid[_participants[i]] = _amountsPaid[i];
            newExpense.amountOwed[_participants[i]] = _amountsOwed[i];
        }
        emit ExpenseAdded(expenseId, _label);
    }

    // ===== Helper Functions (For JavaScript Features) =====
    function getPerson(address _addr) public view returns (string memory, address) {
        require(isRegistered(_addr), "Not registered");
        Person storage p = people[_addr];
        return (p.name, p.walletAddress);
    }

    function getAllRegisteredPeople() public view returns (address[] memory) {
        return registeredPeople;
    }

    function getNetBalance(address _person) public view returns (int256) {
        int256 balance = 0;
        for (uint256 i = 0; i < expenseCount; i++) {
            balance += int256(expenses[i].amountPaid[_person]) - int256(expenses[i].amountOwed[_person]);
        }
        return balance;
    }
}
