import { BigInt, Bytes } from "@graphprotocol/graph-ts";
import {
  Registered,
  AgentLaunched,
  ConsentChanged,
  Delisted,
  Relisted,
  SubnameAssigned,
  Hired,
  Blessed,
} from "../generated/AgentLaunchRegistry/AgentLaunchRegistry";
import {
  Agent,
  LaunchEvent,
  ConsentEvent,
  HireEvent,
  BlessEvent,
  DelistEvent,
  RelistEvent,
  SubnameEvent,
  PulseStats,
} from "../generated/schema";

// Standing Consent Window canon — contract enum Consent: 0=Active, 1=Paused, 2=Withdrawn
function statusName(s: i32): string {
  if (s == 1) return "paused";
  if (s == 2) return "withdrawn";
  return "active";
}

function eventId(txHash: string, logIndex: BigInt): string {
  return txHash + "-" + logIndex.toString();
}

const ZERO_BYTES = Bytes.fromHexString(
  "0x0000000000000000000000000000000000000000000000000000000000000000"
);

function loadStats(): PulseStats {
  let stats = PulseStats.load("pulse");
  if (stats == null) {
    stats = new PulseStats("pulse");
    stats.totalAgents = 0;
    stats.totalRegistered = 0;
    stats.totalHires = 0;
    stats.totalConsentChanges = 0;
    stats.totalBlessings = 0;
    stats.totalDelists = 0;
    stats.totalRelists = 0;
    stats.totalHiredAmount = BigInt.zero();
    stats.lastEventAt = BigInt.zero();
  }
  return stats;
}

function touch(stats: PulseStats, ts: BigInt): void {
  stats.lastEventAt = ts;
  stats.save();
}

function newAgent(agentId: BigInt): Agent {
  const agent = new Agent(agentId.toString());
  agent.agentId = agentId;
  agent.label = "";
  agent.operator = Bytes.empty();
  agent.manifestURI = "";
  agent.manifestHash = ZERO_BYTES;
  agent.serviceEndpoint = "";
  agent.consentStatus = "paused";
  agent.listed = false;
  agent.blessed = false;
  agent.blessCount = 0;
  agent.hireCount = 0;
  agent.totalHiredAmount = BigInt.zero();
  agent.ensNode = ZERO_BYTES;
  agent.ensTokenId = BigInt.zero();
  agent.expiry = BigInt.zero();
  agent.registeredOnly = true;
  agent.launchedAt = BigInt.zero();
  agent.launchedTx = Bytes.empty();
  agent.lastEventAt = BigInt.zero();
  return agent;
}

/// ERC-8004 base registration — fires on BOTH bare register() and launchAgent()
/// (launch fires Registered first, AgentLaunched right after, same tx).
export function handleRegistered(event: Registered): void {
  const id = event.params.agentId.toString();
  let agent = Agent.load(id);
  if (agent == null) {
    agent = newAgent(event.params.agentId);
    agent.operator = event.params.owner;
    agent.manifestURI = event.params.agentURI;
    agent.launchedAt = event.block.timestamp;
    agent.launchedTx = event.transaction.hash;
    agent.lastEventAt = event.block.timestamp;
    agent.save();

    const stats = loadStats();
    stats.totalRegistered += 1;
    touch(stats, event.block.timestamp);
  }
}

export function handleAgentLaunched(event: AgentLaunched): void {
  const id = event.params.agentId.toString();
  // handleRegistered ran first in the same tx — load, don't create
  let agent = Agent.load(id);
  if (agent == null) agent = newAgent(event.params.agentId);

  agent.label = event.params.label;
  agent.operator = event.params.operator;
  agent.manifestURI = event.params.manifestURI;
  agent.manifestHash = event.params.manifestHash;
  agent.serviceEndpoint = event.params.serviceEndpoint;
  agent.expiry = event.params.expiry;
  agent.consentStatus = "active";
  agent.listed = true;
  agent.registeredOnly = false;
  agent.launchedAt = event.block.timestamp;
  agent.launchedTx = event.transaction.hash;
  agent.lastEventAt = event.block.timestamp;
  agent.save();

  const launch = new LaunchEvent(
    eventId(event.transaction.hash.toHexString(), event.logIndex)
  );
  launch.agent = id;
  launch.operator = event.params.operator;
  launch.manifestHash = event.params.manifestHash;
  launch.manifestURI = event.params.manifestURI;
  launch.serviceEndpoint = event.params.serviceEndpoint;
  launch.label = event.params.label;
  launch.expiry = event.params.expiry;
  launch.timestamp = event.block.timestamp;
  launch.blockNumber = event.block.number;
  launch.txHash = event.transaction.hash;
  launch.save();

  const stats = loadStats();
  stats.totalAgents += 1;
  touch(stats, event.block.timestamp);
}

export function handleConsentChanged(event: ConsentChanged): void {
  const id = event.params.agentId.toString();
  const newStatus = statusName(event.params.status);

  const agent = Agent.load(id);
  // the contract emits only the NEW status — derive the old one from the store
  const oldStatus = agent != null ? agent.consentStatus : "unknown";
  if (agent != null) {
    agent.consentStatus = newStatus;
    agent.lastEventAt = event.block.timestamp;
    agent.save();
  }

  const consent = new ConsentEvent(
    eventId(event.transaction.hash.toHexString(), event.logIndex)
  );
  consent.agent = id;
  consent.oldStatus = oldStatus;
  consent.newStatus = newStatus;
  consent.changedBy = event.params.changedBy;
  consent.consentContact = event.params.consentContact;
  consent.pitPointer = event.params.pitPointer;
  consent.timestamp = event.block.timestamp;
  consent.blockNumber = event.block.number;
  consent.txHash = event.transaction.hash;
  consent.save();

  const stats = loadStats();
  stats.totalConsentChanges += 1;
  touch(stats, event.block.timestamp);
}

export function handleDelisted(event: Delisted): void {
  const id = event.params.agentId.toString();

  const agent = Agent.load(id);
  if (agent != null) {
    agent.listed = false;
    agent.lastEventAt = event.block.timestamp;
    agent.save();
  }

  const delist = new DelistEvent(
    eventId(event.transaction.hash.toHexString(), event.logIndex)
  );
  delist.agent = id;
  delist.delistedBy = event.params.delistedBy;
  delist.reason = event.params.reason;
  delist.timestamp = event.block.timestamp;
  delist.blockNumber = event.block.number;
  delist.txHash = event.transaction.hash;
  delist.save();

  const stats = loadStats();
  stats.totalDelists += 1;
  touch(stats, event.block.timestamp);
}

export function handleRelisted(event: Relisted): void {
  const id = event.params.agentId.toString();

  const agent = Agent.load(id);
  if (agent != null) {
    agent.listed = true;
    agent.lastEventAt = event.block.timestamp;
    agent.save();
  }

  const relist = new RelistEvent(
    eventId(event.transaction.hash.toHexString(), event.logIndex)
  );
  relist.agent = id;
  relist.relistedBy = event.params.relistedBy;
  relist.timestamp = event.block.timestamp;
  relist.blockNumber = event.block.number;
  relist.txHash = event.transaction.hash;
  relist.save();

  const stats = loadStats();
  stats.totalRelists += 1;
  touch(stats, event.block.timestamp);
}

export function handleSubnameAssigned(event: SubnameAssigned): void {
  const id = event.params.agentId.toString();

  const agent = Agent.load(id);
  if (agent != null) {
    agent.ensNode = event.params.node;
    agent.ensTokenId = event.params.ensTokenId;
    agent.lastEventAt = event.block.timestamp;
    agent.save();
  }

  const sub = new SubnameEvent(
    eventId(event.transaction.hash.toHexString(), event.logIndex)
  );
  sub.agent = id;
  sub.label = event.params.label;
  sub.node = event.params.node;
  sub.ensTokenId = event.params.ensTokenId;
  sub.timestamp = event.block.timestamp;
  sub.blockNumber = event.block.number;
  sub.txHash = event.transaction.hash;
  sub.save();

  const stats = loadStats();
  touch(stats, event.block.timestamp);
}

export function handleHired(event: Hired): void {
  const id = event.params.agentId.toString();

  const agent = Agent.load(id);
  if (agent != null) {
    agent.hireCount += 1;
    agent.totalHiredAmount = agent.totalHiredAmount.plus(event.params.amount);
    agent.lastEventAt = event.block.timestamp;
    agent.save();
  }

  const hire = new HireEvent(
    eventId(event.transaction.hash.toHexString(), event.logIndex)
  );
  hire.agent = id;
  hire.client = event.params.client;
  hire.amount = event.params.amount;
  hire.rail = event.params.rail;
  hire.receiptRef = event.params.receiptRef;
  hire.timestamp = event.block.timestamp;
  hire.blockNumber = event.block.number;
  hire.txHash = event.transaction.hash;
  hire.save();

  const stats = loadStats();
  stats.totalHires += 1;
  stats.totalHiredAmount = stats.totalHiredAmount.plus(event.params.amount);
  touch(stats, event.block.timestamp);
}

export function handleBlessed(event: Blessed): void {
  const id = event.params.agentId.toString();

  const agent = Agent.load(id);
  if (agent != null) {
    agent.blessed = true;
    agent.blessCount += 1;
    agent.lastEventAt = event.block.timestamp;
    agent.save();
  }

  const bless = new BlessEvent(
    eventId(event.transaction.hash.toHexString(), event.logIndex)
  );
  bless.agent = id;
  bless.operator = event.params.operator;
  bless.verifier = event.params.verifier;
  bless.proofRef = event.params.proofRef;
  bless.timestamp = event.block.timestamp;
  bless.blockNumber = event.block.number;
  bless.txHash = event.transaction.hash;
  bless.save();

  const stats = loadStats();
  stats.totalBlessings += 1;
  touch(stats, event.block.timestamp);
}
