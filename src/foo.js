export const idlFactory = ({ IDL }) => {
  const XdrConversionRate = IDL.Record({
    'xdr_permyriad_per_icp': IDL.Opt(IDL.Nat64),
    'timestamp_seconds': IDL.Opt(IDL.Nat64),
  });
  
  const AccountIdentifier = IDL.Record({
    'hash': IDL.Vec(IDL.Nat8),
  });
  
  const NodeProvider = IDL.Record({
    'id': IDL.Opt(IDL.Principal),
    'reward_account': IDL.Opt(AccountIdentifier),
  });
  
  const RewardToAccount = IDL.Record({
    'to_account': IDL.Opt(AccountIdentifier),
  });
  
  const RewardToNeuron = IDL.Record({
    'dissolve_delay_seconds': IDL.Nat64,
  });
  
  const RewardMode = IDL.Variant({
    'RewardToNeuron': RewardToNeuron,
    'RewardToAccount': RewardToAccount,
  });
  
  const RewardNodeProvider = IDL.Record({
    'node_provider': IDL.Opt(NodeProvider),
    'reward_mode': IDL.Opt(RewardMode),
    'amount_e8s': IDL.Nat64,
  });
  
  const MonthlyNodeProviderRewards = IDL.Record({
    'minimum_xdr_permyriad_per_icp': IDL.Opt(IDL.Nat64),
    'registry_version': IDL.Opt(IDL.Nat64),
    'node_providers': IDL.Vec(NodeProvider),
    'timestamp': IDL.Nat64,
    'rewards': IDL.Vec(RewardNodeProvider),
    'xdr_conversion_rate': IDL.Opt(XdrConversionRate),
    'maximum_node_provider_rewards_e8s': IDL.Opt(IDL.Nat64),
  });

  const GovernanceError = IDL.Record({
    'error_message': IDL.Text,
    'error_type': IDL.Nat32
  });

  const Result = IDL.Variant({
    'Ok': MonthlyNodeProviderRewards,
    'Err': GovernanceError
  });

  return IDL.Service({
    'get_most_recent_monthly_node_provider_rewards': IDL.Func(
      [],
      [IDL.Opt(MonthlyNodeProviderRewards)],
      ['query'],
    ),
    'get_monthly_node_provider_rewards': IDL.Func(
      [],
      [Result],
      ['query'],
    ),
  });
}; 
