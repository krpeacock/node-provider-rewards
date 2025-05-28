import { Actor, HttpAgent } from '@dfinity/agent';
import { AccountIdentifier } from '@dfinity/ledger-icp';
import { Principal } from '@dfinity/principal';
import { idlFactory } from './governance.did';

// Constants
const GOVERNANCE_CANISTER_ID = 'rrkah-fqaaa-aaaaa-aaaaq-cai';
const IC_HOST = 'https://ic0.app';

// DOM Elements
const fetchHistoricalRewardsBtn = document.getElementById('fetchHistoricalRewards');
const fetchSimulatedRewardsBtn = document.getElementById('fetchSimulatedRewards');
const loadingEl = document.getElementById('loading');
const errorEl = document.getElementById('error');
const dataSourceEl = document.getElementById('dataSource');
const summaryEl = document.getElementById('summary');
const rewardsDetailsEl = document.getElementById('rewardsDetails');
const csvPreviewEl = document.getElementById('csvPreview');
const timestampEl = document.getElementById('timestamp');
const providerCountEl = document.getElementById('providerCount');
const totalRewardsEl = document.getElementById('totalRewards');
const registryVersionEl = document.getElementById('registryVersion');
const maxRewardsEl = document.getElementById('maxRewards');
const rewardsListEl = document.getElementById('rewardsList');
const downloadCsvBtn = document.getElementById('downloadCsv');
const copyTableCsvBtn = document.getElementById('copyTableCsv');
const copySuccessEl = document.getElementById('copySuccess');
const csvTableBodyEl = document.getElementById('csvTableBody');

// Track current source mode for filename prefix
let currentDataMode = 'historical';

// Store the rewards data globally for CSV generation
let currentRewardsData = null;

// Create an agent to talk to the Internet Computer
const agent = new HttpAgent({ host: IC_HOST });

// Create an actor to interact with the governance canister
const governanceActor = Actor.createActor(idlFactory, {
  agent,
  canisterId: GOVERNANCE_CANISTER_ID,
});

// Format timestamp to human-readable date
function formatTimestamp(timestamp) {
  const date = new Date(Number(timestamp) * 1000);
  return date.toLocaleString();
}

// Format e8s (100 million e8s = 1 ICP)
function formatE8s(e8s) {
  if (!e8s) return 'N/A';
  const icp = Number(e8s) / 100000000;
  return `${icp.toLocaleString()} ICP`;
}

// Format e8s for CSV (without "ICP" suffix)
function formatE8sForCsv(e8s) {
  if (!e8s) return '';
  const icp = Number(e8s) / 100000000;
  return icp.toString();
}

// Convert principal ID to string
function principalToString(principal) {
  if (!principal) return 'Unknown';
  return principal.toString();
}

// CRC32 hash implementation for account ID calculation
function crc32(bytes) {
  const polynomial = 0xedb88320;
  let crc = 0xffffffff;
  
  for (let i = 0; i < bytes.length; i++) {
    crc ^= bytes[i];
    for (let j = 0; j < 8; j++) {
      crc = ((crc & 1) ? polynomial : 0) ^ (crc >>> 1);
    }
  }
  
  return (crc ^ 0xffffffff) >>> 0;
}

// Get default account ID from principal
function getDefaultAccountId(principal) {
  try {
    if (!principal) return null;
    
    // Use the AccountIdentifier from @dfinity/ledger-icp
    const accountIdentifier = AccountIdentifier.fromPrincipal({
      principal: principal,
      // Using default subaccount (all zeros)
      subAccount: undefined
    });
    
    // Return the bytes in a format compatible with our existing code
    return { hash: accountIdentifier.bytes };
  } catch (error) {
    console.warn('Error calculating default account ID:', error);
    return null;
  }
}

// Convert account identifier to string
function accountIdentifierToString(accountId) {
  try {
    // Ensure the accountId exists and has a valid hash property
    if (!accountId || !accountId.hash || accountId.hash.length === 0) {
      return 'No Account';
    }
    
    // Create an AccountIdentifier from the bytes
    const accountIdentifier = new AccountIdentifier(accountId.hash);
    
    // Return the hex representation
    return accountIdentifier.toHex();
  } catch (error) {
    console.warn('Error converting account identifier to string:', error);
    return 'Invalid Account Format';
  }
}

// Helper function to check if reward_account is valid
function isValidRewardAccount(rewardAccount) {
  try {
    // Check if reward_account exists
    if (!rewardAccount) return false;
    
    // Check if reward_account[0] exists (many are empty arrays)
    if (Array.isArray(rewardAccount) && rewardAccount.length === 0) return false;
    
    // Check if reward_account[0] exists
    if (!rewardAccount[0]) return false;
    
    // Check if reward_account[0].hash exists and is an array/Uint8Array with content
    if (!rewardAccount[0].hash || !rewardAccount[0].hash.length) return false;
    
    return true;
  } catch (error) {
    console.warn('Error validating reward account:', error);
    return false;
  }
}

// Generate CSV data
function generateCsvData(rewards) {
  // CSV header
  let csvContent = 'Principal ID,Wallet Address,Monthly Rewards (ICP)\n';
  
  // Map rewards to node providers by creating a lookup
  const rewardsByProvider = {};
  rewards.rewards.forEach(reward => {
    if (reward.node_provider && reward.node_provider[0] && reward.node_provider[0].id && reward.node_provider[0].id[0]) {
      const providerId = reward.node_provider[0].id[0].toString();
      rewardsByProvider[providerId] = reward.amount_e8s;
    }
  });
  
  // Generate rows for each node provider
  rewards.node_providers.forEach(provider => {
    const principalId = provider.id && provider.id[0] ? principalToString(provider.id[0]) : 'Unknown';
    
    let walletAddress;
    
    // Check for explicit reward account
    if (isValidRewardAccount(provider.reward_account)) {
      walletAddress = accountIdentifierToString(provider.reward_account[0]);
    } else {
      // No explicit reward account - calculate the default account from principal ID
      if (provider.id && provider.id[0]) {
        // Get default account for this principal
        const defaultAccount = getDefaultAccountId(provider.id[0]);
        walletAddress = defaultAccount ? 
          `${accountIdentifierToString(defaultAccount)} (Default)` : 
          'No Account';
      } else {
        walletAddress = 'No Account';
      }
    }
    
    // Find reward amount for this provider or use 0
    const rewardAmount = rewardsByProvider[principalId] || 0;
    const rewardIcp = formatE8sForCsv(rewardAmount);
    
    // Add row to CSV
    csvContent += `${principalId},${walletAddress},${rewardIcp}\n`;
  });
  
  return csvContent;
}

// Add diagnostic function to analyze reward accounts data
function analyzeRewardAccounts(rewards) {
  // Summary statistics
  const stats = {
    totalProviders: rewards.node_providers.length,
    validAccounts: 0,
    missingRewardAccount: 0,
    emptyArray: 0,
    noHashProperty: 0,
    emptyHash: 0,
    otherIssues: 0,
    validPercentage: 0
  };
  
  // Count different cases
  rewards.node_providers.forEach(provider => {
    try {
      if (!provider.reward_account) {
        stats.missingRewardAccount++;
      } else if (!Array.isArray(provider.reward_account) || provider.reward_account.length === 0) {
        stats.emptyArray++;
      } else if (!provider.reward_account[0] || !provider.reward_account[0].hash) {
        stats.noHashProperty++;
      } else if (!provider.reward_account[0].hash.length) {
        stats.emptyHash++;
      } else {
        // Valid account
        stats.validAccounts++;
      }
    } catch (error) {
      stats.otherIssues++;
      console.error('Error analyzing reward account:', error);
    }
  });
  
  // Calculate percentage of valid accounts
  stats.validPercentage = Math.round((stats.validAccounts / stats.totalProviders) * 100);
  
  // Log summary
  console.log('======= REWARD ACCOUNTS ANALYSIS =======');
  console.log(`Total providers: ${stats.totalProviders}`);
  console.log(`Valid accounts: ${stats.validAccounts} (${stats.validPercentage}%)`);
  console.log(`Missing reward_account: ${stats.missingRewardAccount}`);
  console.log(`Empty arrays: ${stats.emptyArray}`);
  console.log(`Missing hash property: ${stats.noHashProperty}`);
  console.log(`Empty hash: ${stats.emptyHash}`);
  console.log(`Other issues: ${stats.otherIssues}`);
  console.log('======================================');
  
  return stats;
}

// Copy table data to clipboard as CSV
function copyTableToClipboard() {
  if (!currentRewardsData) return;

  const csvData = generateCsvData(currentRewardsData);
  
  // Copy to clipboard
  navigator.clipboard.writeText(csvData)
    .then(() => {
      // Show success message
      copySuccessEl.classList.remove('hidden');
      
      // Hide success message after animation completes
      setTimeout(() => {
        copySuccessEl.classList.add('hidden');
      }, 3500);
    })
    .catch(err => {
      console.error('Failed to copy CSV data: ', err);
      alert('Failed to copy to clipboard. Please try again or use the download option instead.');
    });
}

// Download CSV file
function downloadCsv() {
  if (!currentRewardsData) return;
  
  const csvData = generateCsvData(currentRewardsData);
  const encodedUri = encodeURI('data:text/csv;charset=utf-8,' + csvData);
  const link = document.createElement('a');
  
  // Format date for filename
  const date = new Date(Number(currentRewardsData.timestamp) * 1000);
  const formattedDate = date.toISOString().split('T')[0];
  
  // Add prefix based on mode
  const filePrefix = currentDataMode === 'historical' ? 'historical' : 'simulated';
  
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `${filePrefix}-node-provider-rewards-${formattedDate}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Display CSV preview table
function displayCsvPreview(rewards) {
  csvTableBodyEl.innerHTML = '';
  
  // Map rewards to node providers by creating a lookup
  const rewardsByProvider = {};
  rewards.rewards.forEach(reward => {
    if (reward.node_provider && reward.node_provider[0] && reward.node_provider[0].id && reward.node_provider[0].id[0]) {
      const providerId = reward.node_provider[0].id[0].toString();
      rewardsByProvider[providerId] = reward.amount_e8s;
    }
  });
  
  // Generate rows for each node provider
  rewards.node_providers.forEach(provider => {
    const principalId = provider.id && provider.id[0] ? principalToString(provider.id[0]) : 'Unknown';
    
    let walletAddress;
    
    // Check for explicit reward account
    if (isValidRewardAccount(provider.reward_account)) {
      walletAddress = accountIdentifierToString(provider.reward_account[0]);
    } else {
      // No explicit reward account - calculate the default account from principal ID
      if (provider.id && provider.id[0]) {
        // Get default account for this principal
        const defaultAccount = getDefaultAccountId(provider.id[0]);
        walletAddress = defaultAccount ? 
          `${accountIdentifierToString(defaultAccount)} (Default)` : 
          'No Account';
      } else {
        walletAddress = 'No Account';
      }
    }
    
    // Find reward amount for this provider or use 0
    const rewardAmount = rewardsByProvider[principalId] || 0;
    
    // Create table row
    const row = document.createElement('tr');
    
    // Principal ID cell
    const principalCell = document.createElement('td');
    principalCell.textContent = principalId;
    row.appendChild(principalCell);
    
    // Wallet address cell
    const walletCell = document.createElement('td');
    walletCell.textContent = walletAddress;
    row.appendChild(walletCell);
    
    // Reward amount cell
    const rewardCell = document.createElement('td');
    rewardCell.textContent = formatE8s(rewardAmount);
    row.appendChild(rewardCell);
    
    csvTableBodyEl.appendChild(row);
  });
  
  // Show CSV preview
  csvPreviewEl.classList.remove('hidden');
  
  // Show download button
  downloadCsvBtn.classList.remove('hidden');
}

// Display rewards data
function displayRewards(rewards, dataMode) {
  console.log(`${dataMode} rewards data:`, rewards);
  
  // Store rewards data globally
  currentRewardsData = rewards;
  currentDataMode = dataMode;
  
  // Run diagnostics on reward accounts and display stats
  const stats = analyzeRewardAccounts(rewards);
  displayAccountStats(stats);
  
  // Set data source message
  if (dataMode === 'historical') {
    dataSourceEl.textContent = 'Showing HISTORICAL rewards from the most recent completed distribution';
  } else {
    dataSourceEl.textContent = 'Showing SIMULATED rewards based on current conditions (not yet minted)';
  }
  dataSourceEl.classList.remove('hidden');
  
  // Show summary
  timestampEl.textContent = formatTimestamp(rewards.timestamp);
  providerCountEl.textContent = rewards.node_providers.length;
  
  // Calculate total rewards
  const totalRewards = rewards.rewards.reduce(
    (sum, reward) => sum + BigInt(reward.amount_e8s), 
    BigInt(0)
  );
  totalRewardsEl.textContent = formatE8s(totalRewards);
  
  // Registry version and max rewards
  registryVersionEl.textContent = rewards.registry_version ? 
    rewards.registry_version[0].toString() : 'N/A';
  maxRewardsEl.textContent = rewards.maximum_node_provider_rewards_e8s ? 
    formatE8s(rewards.maximum_node_provider_rewards_e8s[0]) : 'N/A';
  
  // Display rewards list
  rewardsListEl.innerHTML = '';
  rewards.rewards.forEach((reward, index) => {
    const rewardItem = document.createElement('div');
    rewardItem.className = 'reward-item';
    
    const providerInfo = reward.node_provider && reward.node_provider[0] && 
      reward.node_provider[0].id && reward.node_provider[0].id[0] ? 
      `Provider ID: ${reward.node_provider[0].id[0].toString()}` : 
      `Provider #${index + 1}`;
    
    rewardItem.innerHTML = `
      <p>${providerInfo}</p>
      <p>Amount: <span class="reward-amount">${formatE8s(reward.amount_e8s)}</span></p>
      <p>Reward Mode: ${reward.reward_mode ? 
        (reward.reward_mode[0].RewardToNeuron ? 'To Neuron' : 'To Account') : 
        'Not specified'}</p>
    `;
    
    rewardsListEl.appendChild(rewardItem);
  });
  
  // Display CSV preview
  displayCsvPreview(rewards);
  
  // Show sections
  summaryEl.classList.remove('hidden');
  rewardsDetailsEl.classList.remove('hidden');
}

// Display account statistics in the UI
function displayAccountStats(stats) {
  // Get DOM elements
  const accountStatsEl = document.getElementById('accountStats');
  const validAccountsPercentageEl = document.getElementById('validAccountsPercentage');
  const validAccountsEl = document.getElementById('validAccounts');
  const emptyAccountsEl = document.getElementById('emptyAccounts');
  const totalAccountsEl = document.getElementById('totalAccounts');
  
  // Set values
  validAccountsPercentageEl.textContent = stats.validPercentage;
  validAccountsEl.textContent = stats.validAccounts;
  emptyAccountsEl.textContent = (stats.emptyArray + stats.missingRewardAccount + stats.noHashProperty + stats.emptyHash);
  totalAccountsEl.textContent = stats.totalProviders;
  
  // Add warning if low percentage of valid accounts
  if (stats.validPercentage < 50) {
    // Create warning element if it doesn't exist
    let warningEl = document.querySelector('.empty-account-warning');
    if (!warningEl) {
      warningEl = document.createElement('div');
      warningEl.className = 'empty-account-warning';
      warningEl.innerHTML = `
        <strong>Note:</strong> Many node providers have empty reward accounts. 
        This is normal in the IC system when providers haven't registered their wallet addresses yet.
        Rewards for these providers will stay in the governance canister until they register a valid account.
      `;
      accountStatsEl.appendChild(warningEl);
    }
  }
  
  // Show the stats section
  accountStatsEl.classList.remove('hidden');
}

// Utility to hide/reset UI elements before fetching
function prepareUIForFetch() {
  loadingEl.classList.remove('hidden');
  errorEl.classList.add('hidden');
  dataSourceEl.classList.add('hidden');
  summaryEl.classList.add('hidden');
  rewardsDetailsEl.classList.add('hidden');
  csvPreviewEl.classList.add('hidden');
  downloadCsvBtn.classList.add('hidden');
  copySuccessEl.classList.add('hidden');
  fetchHistoricalRewardsBtn.disabled = true;
  fetchSimulatedRewardsBtn.disabled = true;
}

// Utility to reset UI elements after fetching
function resetUIAfterFetch() {
  loadingEl.classList.add('hidden');
  fetchHistoricalRewardsBtn.disabled = false;
  fetchSimulatedRewardsBtn.disabled = false;
}

// Fetch historical rewards from the governance canister
async function fetchHistoricalRewards() {
  try {
    // Prepare UI
    prepareUIForFetch();
    
    // Fetch data from the governance canister
    const rewardsOpt = await governanceActor.get_most_recent_monthly_node_provider_rewards();
    
    // Reset UI
    resetUIAfterFetch();
    
    // Check if we got rewards data
    if (rewardsOpt && rewardsOpt.length > 0) {
      displayRewards(rewardsOpt[0], 'historical');
    } else {
      throw new Error('No historical rewards data available');
    }
  } catch (error) {
    console.error('Error fetching historical rewards:', error);
    handleFetchError(error);
  }
}

// Fetch simulated current rewards from the governance canister
async function fetchSimulatedRewards() {
  try {
    // Prepare UI
    prepareUIForFetch();
    
    // Fetch data from the governance canister
    const result = await governanceActor.get_monthly_node_provider_rewards();
    
    // Reset UI
    resetUIAfterFetch();
    
    // Check if we got successful result
    if (result && result.Ok) {
      displayRewards(result.Ok, 'simulated');
    } else if (result && result.Err) {
      // Handle error returned by the canister
      throw new Error(`Canister error: ${result.Err.error_message}`);
    } else {
      throw new Error('No simulated rewards data available');
    }
  } catch (error) {
    console.error('Error fetching simulated rewards:', error);
    handleFetchError(error);
  }
}

// Handle fetch errors
function handleFetchError(error) {
  loadingEl.classList.add('hidden');
  errorEl.classList.remove('hidden');
  errorEl.textContent = `Error: ${error.message || 'Failed to fetch rewards data'}`;
  fetchHistoricalRewardsBtn.disabled = false;
  fetchSimulatedRewardsBtn.disabled = false;
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
  fetchHistoricalRewardsBtn.addEventListener('click', fetchHistoricalRewards);
  fetchSimulatedRewardsBtn.addEventListener('click', fetchSimulatedRewards);
  downloadCsvBtn.addEventListener('click', downloadCsv);
  copyTableCsvBtn.addEventListener('click', copyTableToClipboard);
});
