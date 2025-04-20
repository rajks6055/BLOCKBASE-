import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import './App.css';
import ExpenseTrackerABI from './ExpenseTrackerABI.json';

function App() {
  // State variables
  const [provider, setProvider] = useState(null);
  const [contract, setContract] = useState(null);
  const [account, setAccount] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);
  const [name, setName] = useState('');
  const [newName, setNewName] = useState('');
  const [expenses, setExpenses] = useState([]);
  const [people, setPeople] = useState([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [lastExpenseLabel, setLastExpenseLabel] = useState('');
  const [loading, setLoading] = useState(false);
  const [expenseLabel, setExpenseLabel] = useState('');
  const [participants, setParticipants] = useState([{ address: '', amountPaid: 0, amountOwed: 0 }]);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const contractAddress = "0xd9145CCE52D386f254917e481eB44e9943F39138";

  // Initialize connection
  useEffect(() => {
    const init = async () => {
      if (window.ethereum) {
        try {
          await window.ethereum.request({ method: 'eth_requestAccounts' });
          const provider = new ethers.providers.Web3Provider(window.ethereum);
          setProvider(provider);

          const network = await provider.getNetwork();
          if (network.chainId !== 11155111) {
            alert("Please connect to Sepolia testnet.");
            return;
          }

          const signer = provider.getSigner();
          const address = await signer.getAddress();
          setAccount(address);
          setIsConnected(true);

          const contract = new ethers.Contract(contractAddress, ExpenseTrackerABI, signer);
          setContract(contract);

          window.ethereum.on('accountsChanged', (accounts) => {
            setAccount(accounts[0] || '');
            setIsConnected(accounts.length > 0);
          });

        } catch (error) {
          console.error("Initialization error:", error);
        }
      } else {
        alert("Please install MetaMask.");
      }
    };

    init();
    return () => window.ethereum?.removeAllListeners('accountsChanged');
  }, []);

  // Load data when contract/account changes
  useEffect(() => {
    const loadData = async () => {
      if (!contract || !account) return;
      try {
        const [person, count, lastLabel] = await Promise.all([
          contract.getPerson(account),
          contract.getRegisteredCount(),
          contract.expenseCount() > 0 ? contract.getLastExpenseLabel() : Promise.resolve("")
        ]);

        setIsRegistered(person.walletAddress !== ethers.constants.AddressZero);
        if (isRegistered) {
          setName(person.name);
          setTotalUsers(count.toNumber());
          setLastExpenseLabel(lastLabel);
          await loadExpenses();
          await loadPeople();
        }
      } catch (error) {
        console.error("Error loading data:", error);
      }
    };
    loadData();
  }, [contract, account]);

  // Load expenses
  const loadExpenses = async () => {
    setLoading(true);
    try {
      const count = await contract.expenseCount();
      const loaded = [];
      for (let i = 0; i < count; i++) {
        const [id, label, timestamp] = await contract.getExpenseBasicInfo(i);
        const participants = await contract.getExpenseParticipants(i);
        const participantsData = await Promise.all(
          participants.map(async (address) => ({
            address,
            amountPaid: ethers.utils.formatEther(await contract.getAmountPaid(i, address)),
            amountOwed: ethers.utils.formatEther(await contract.getAmountOwed(i, address))
          }))
        );
        loaded.push({
          id: id.toNumber(),
          label,
          timestamp: new Date(timestamp.toNumber() * 1000).toLocaleString(),
          participants: participantsData
        });
      }
      setExpenses(loaded);
    } catch (error) {
      console.error("Error loading expenses:", error);
    } finally {
      setLoading(false);
    }
  };

  // Load people
  const loadPeople = async () => {
    try {
      const addresses = await contract.getAllRegisteredPeople();
      const peopleData = await Promise.all(
        addresses.map(async (address) => ({
          address,
          name: (await contract.getPerson(address)).name,
          netBalance: ethers.utils.formatEther(await contract.getNetBalance(address))
        }))
      );
      setPeople(peopleData);
    } catch (error) {
      console.error("Error loading people:", error);
    }
  };

  // Register user
  const registerUser = async () => {
    if (!name.trim()) return;
    try {
      const tx = await contract.registerPerson(name.trim());
      await tx.wait();
      setIsRegistered(true);
      await loadPeople();
    } catch (error) {
      alert(`Registration failed: ${error.message}`);
    }
  };

  // Update name
  const updateName = async () => {
    if (!newName.trim()) return;
    try {
      const tx = await contract.updateName(newName.trim());
      await tx.wait();
      setName(newName);
      setNewName('');
      alert("Name updated!");
    } catch (error) {
      alert(`Error: ${error.message}`);
    }
  };

  // Add expense
  const addExpense = async () => {
    if (!expenseLabel.trim() || participants.length === 0) return;
    try {
      const addresses = participants.map(p => p.address.trim());
      const paid = participants.map(p => ethers.utils.parseEther(p.amountPaid.toString()));
      const owed = participants.map(p => ethers.utils.parseEther(p.amountOwed.toString()));

      const tx = await contract.addExpense(expenseLabel, addresses, paid, owed);
      await tx.wait();
      setExpenseLabel('');
      setParticipants([{ address: '', amountPaid: 0, amountOwed: 0 }]);
      setShowAddExpense(false);
      await loadExpenses();
    } catch (error) {
      alert(`Error: ${error.message}`);
    }
  };

  // Participant helpers
  const updateParticipant = (index, field, value) => {
    const updated = [...participants];
    updated[index][field] = value;
    setParticipants(updated);
  };

  const addParticipant = () => {
    setParticipants([...participants, { address: '', amountPaid: 0, amountOwed: 0 }]);
  };

  const removeParticipant = (index) => {
    if (participants.length > 1) {
      setParticipants(participants.filter((_, i) => i !== index));
    }
  };

  // UI
  return (
    <div className="App">
      <header className="App-header">
        <h1>On-Chain Expense Tracker</h1>
        
        {!isConnected ? (
          <button onClick={() => window.ethereum.request({ method: 'eth_requestAccounts' })}>
            Connect Wallet
          </button>
        ) : !isRegistered ? (
          <div>
            <h2>Register</h2>
            <input
              type="text"
              placeholder="Your Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <button onClick={registerUser}>Register</button>
          </div>
        ) : (
          <div>
            <h2>Welcome, {name}</h2>
            <p>Account: {account}</p>
            <p>Total Registered Users: {totalUsers}</p>
            <p>Last Expense: {lastExpenseLabel || "None"}</p>

            <div>
              <input
                type="text"
                placeholder="New name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
              <button onClick={updateName}>Update Name</button>
            </div>

            <button onClick={() => setShowAddExpense(!showAddExpense)}>
              {showAddExpense ? "Cancel" : "Add Expense"}
            </button>
            <button onClick={loadExpenses} disabled={loading}>
              {loading ? "Loading..." : "Refresh Expenses"}
            </button>

            {showAddExpense && (
              <div>
                <h3>New Expense</h3>
                <input
                  type="text"
                  placeholder="Expense Label"
                  value={expenseLabel}
                  onChange={(e) => setExpenseLabel(e.target.value)}
                />
                {participants.map((p, idx) => (
                  <div key={idx}>
                    <input
                      placeholder="Address"
                      value={p.address}
                      onChange={(e) => updateParticipant(idx, 'address', e.target.value)}
                    />
                    <input
                      type="number"
                      placeholder="Paid (ETH)"
                      value={p.amountPaid}
                      onChange={(e) => updateParticipant(idx, 'amountPaid', e.target.value)}
                    />
                    <input
                      type="number"
                      placeholder="Owed (ETH)"
                      value={p.amountOwed}
                      onChange={(e) => updateParticipant(idx, 'amountOwed', e.target.value)}
                    />
                    <button onClick={() => removeParticipant(idx)}>Remove</button>
                  </div>
                ))}
                <button onClick={addParticipant}>Add Participant</button>
                <button onClick={addExpense}>Save Expense</button>
              </div>
            )}

            <h3>People</h3>
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Address</th>
                  <th>Net Balance</th>
                </tr>
              </thead>
              <tbody>
                {people.map((p, idx) => (
                  <tr key={idx}>
                    <td>{p.name}</td>
                    <td>{p.address.substring(0, 8)}...</td>
                    <td style={{ color: parseFloat(p.netBalance) < 0 ? 'red' : 'green' }}>
                      {parseFloat(p.netBalance).toFixed(5)} ETH
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <h3>Expense History</h3>
            {expenses.map(expense => (
              <div key={expense.id}>
                <h4>{expense.label}</h4>
                <p>{expense.timestamp}</p>
                <table>
                  <thead>
                    <tr>
                      <th>Participant</th>
                      <th>Paid</th>
                      <th>Owes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expense.participants.map((p, idx) => (
                      <tr key={idx}>
                        <td>{people.find(u => u.address === p.address)?.name || p.address.substring(0, 8)}...</td>
                        <td>{p.amountPaid} ETH</td>
                        <td>{p.amountOwed} ETH</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
      </header>
    </div>
  );
}

export default App;
