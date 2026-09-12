import { BigInt } from "@graphprotocol/graph-ts";
import {
  AgentLaunched,
  ConsentChanged,
  Hired,
  Blessed,
  Delisted,
} from "../generated/AgentLaunchRegistry/AgentLaunchRegistry";
import {
  Agent,
  LaunchEvent,
  ConsentEvent,
  HireEvent,
  BlessEvent,
  DelistEvent,
  PulseStats,
} from "../generated/schema";

// Standing Consent Window canon — contract enum: 0=Active, 1=Paused, 2=Withdrawn
function statusName(s: i32): string {
  if (s == 1) return "paused";
  if (s == 2) return "withdrawn";
  return "active";
}

function eventId(txHash: string, logIndex: BigInt): string {
  return txHash + "-" + logIndex.toString();
}

function loadStats(): PulseStats {
  let stats = PulseStats.load("pulse");
  if (stats == null) {
    stats = new PulseStats("pulse");
    stats.totalAgents = 0;
    stats.totalHires = 0;
    stats.totalConsentChanges = 0;
    stats.totalBlessings = 0;
    stats.totalDelists = 0;
    stats.totalHiredAmount = BigInt.zero();
    stats.lastEventAt = BigInt.zero();
  }
  return stats;
}

export function handleAgentLaunched(event: AgentLaunched): void {
  const agentId = event.params.agentId.toString();

  let agent = Agent.load(agentId);
  if (agent == null) {
    agent = new Agent(agentId);
    agent.agentId = event.params.agentId;
    agent.consentStatus = "active";
    agent.delisted = false;
    agent.blessed = false;
    agent.blessCount = 0;
    agent.hireCount = 0;
    agent.totalHiredAmount = BigInt.zero();
  }
  agent.name = event.params.name;
  agent.ticker = event.params.ticker;
  agent.ensName = event.params.ensName;
  agent.operator = event.params.operator;
  agent.launchedAt = event.block.timestamp;
  agent.launchedTx = event.transaction.hash;
  agent.lastEventAt = event.block.timestamp;
  agent.save();

  const launch = new LaunchEvent(
    eventId(event.transaction.hash.toHexString(), event.logIndex)
  );
  launch.agent = agentId;
  launch.operator = event.params.operator;
  launch.name = event.params.name;
  launch.ticker = event.params.ticker;
  launch.ensName = event.params.ensName;
  launch.timestamp = event.block.timestamp;
  launch.blockNumber = event.block.number;
  launch.txHash = event.transaction.hash;
  launch.save();

  const stats = loadStats();
  stats.totalAgents += 1;
  stats.lastEventAt = event.block.timestamp;
  stats.save();
}

export function handleConsentChanged(event: ConsentChanged): void {
  const agentId = event.params.agentId.toString();
  const newStatus = statusName(event.params.newStatus);

  const agent = Agent.load(agentId);
  if (agent != null) {
    agent.consentStatus = newStatus;
    agent.lastEventAt = event.block.timestamp;
    agent.save();
  }

  const consent = new ConsentEvent(
    eventId(event.transaction.hash.toHexString(), event.logIndex)
  );
  consent.agent = agentId;
  consent.oldStatus = statusName(event.params.oldStatus);
  consent.newStatus = newStatus;
  consent.timestamp = event.block.timestamp;
  consent.blockNumber = event.block.number;
  consent.txHash = event.transaction.hash;
  consent.save();

  const stats = loadStats();
  stats.totalConsentChanges += 1;
  stats.lastEventAt = event.block.timestamp;
  stats.save();
}

export function handleHired(event: Hired): void {
  const agentId = event.params.agentId.toString();

  const agent = Agent.load(agentId);
  if (agent != null) {
    agent.hireCount += 1;
    agent.totalHiredAmount = agent.totalHiredAmount.plus(event.params.amount);
    agent.lastEventAt = event.block.timestamp;
    agent.save();
  }

  const hire = new HireEvent(
    eventId(event.transaction.hash.toHexString(), event.logIndex)
  );
  hire.agent = agentId;
  hire.hirer = event.params.hirer;
  hire.amount = event.params.amount;
  hire.jobRef = event.params.jobRef;
  hire.timestamp = event.block.timestamp;
  hire.blockNumber = event.block.number;
  hire.txHash = event.transaction.hash;
  hire.save();

  const stats = loadStats();
  stats.totalHires += 1;
  stats.totalHiredAmount = stats.totalHiredAmount.plus(event.params.amount);
  stats.lastEventAt = event.block.timestamp;
  stats.save();
}

export function handleBlessed(event: Blessed): void {
  const agentId = event.params.agentId.toString();

  const agent = Agent.load(agentId);
  if (agent != null) {
    agent.blessed = true;
    agent.blessCount += 1;
    agent.lastEventAt = event.block.timestamp;
    agent.save();
  }

  const bless = new BlessEvent(
    eventId(event.transaction.hash.toHexString(), event.logIndex)
  );
  bless.agent = agentId;
  bless.blesser = event.params.blesser;
  bless.timestamp = event.block.timestamp;
  bless.blockNumber = event.block.number;
  bless.txHash = event.transaction.hash;
  bless.save();

  const stats = loadStats();
  stats.totalBlessings += 1;
  stats.lastEventAt = event.block.timestamp;
  stats.save();
}

export function handleDelisted(event: Delisted): void {
  const agentId = event.params.agentId.toString();

  const agent = Agent.load(agentId);
  if (agent != null) {
    agent.delisted = true;
    agent.lastEventAt = event.block.timestamp;
    agent.save();
  }

  const delist = new DelistEvent(
    eventId(event.transaction.hash.toHexString(), event.logIndex)
  );
  delist.agent = agentId;
  delist.reason = event.params.reason;
  delist.timestamp = event.block.timestamp;
  delist.blockNumber = event.block.number;
  delist.txHash = event.transaction.hash;
  delist.save();

  const stats = loadStats();
  stats.totalDelists += 1;
  stats.lastEventAt = event.block.timestamp;
  stats.save();
}
