/**
 * Who gives out jobs, where they stand, and each one's chain of special jobs. Data only (no levels), so the level
 * files can put them in their places without a cycle.
 */
import type { AreaId } from '../progress/Progress';
import type { StationDef } from '../world/LevelTypes';
import type { ContactDef, ContactId, JobKind } from './save';

export const CONTACTS: Record<ContactId, ContactDef> = {
  terry: {
    id: 'terry', name: 'Terry Walsh', role: 'Fixer', area: 'pub', where: 'Weatherspoons, by the door',
    kinds: ['sort', 'recover'],
    line: 'Sit down, son. I’ve always got something for someone who can handle himself.',
    look: { seed: 7301, body: 'male', top: 'shirt', topColour: '#3a3f4a' },
    rewards: ['w_baseball_bat', 'w_crowbar', 'w_hammer', 'first_aid', 'ring_signet'],
  },
  bev: {
    id: 'bev', name: 'Bev Okafor', role: 'Money lender', area: 'high_street', where: 'Outside the bookies, High Street',
    kinds: ['debt'],
    line: 'Everybody pays Bev in the end, love. Some of them just need reminding.',
    look: { seed: 7302, body: 'female', top: 'leather', topColour: '#5a1a2a' },
    rewards: ['chain_silver', 'watch_silver', 'plasters', 'first_aid'],
  },
  kez: {
    id: 'kez', name: 'Kez', role: 'Dealer', area: 'residential', where: 'By the garages, Hollins',
    kinds: ['deal', 'deliver'],
    line: 'You buying or you working? Either way, keep your voice down.',
    look: { seed: 7303, body: 'male', top: 'hoodie', topColour: '#1b1d22' },
    rewards: ['energy_drink', 'chain_cheap', 'watch_cheap', 'plasters'],
  },
  del: {
    id: 'del', name: 'Dodgy Del', role: 'Market trader', area: 'alleys', where: 'Round the back of the far terraces, Back Alleys',
    kinds: ['deliver', 'recover'], requires: 'boss_sully',
    line: 'Del’s the name, quality’s the game. Fell off a lorry? Never heard of it.',
    look: { seed: 7304, body: 'male', top: 'gilet', topColour: '#2d4a2a' },
    rewards: ['fry_up', 'meal_deal', 'watch_cheap', 'w_wrench', 'first_aid'],
  },
  nails: {
    id: 'nails', name: 'Nails', role: 'Enforcer', area: 'alleys', where: 'By the bins at the top of the Back Alleys',
    kinds: ['sort', 'debt'], requires: 'boss_gaffer',
    line: 'Gaffer’s gone. Somebody’s got to keep these streets in line. Might as well be us.',
    look: { seed: 7305, body: 'male', top: 'bomber', topColour: '#202a1e' },
    rewards: ['w_metal_bar', 'w_chain', 'first_aid', 'ring_signet'],
  },
};

// ---- the chains: each contact's own story, three jobs long ----------------------------------------------------

export interface ChainStep {
  kind: JobKind;
  title: string;
  brief: string;
  /** Where it happens (they're all on streets you can reach by the time the contact will see you). */
  area: AreaId;
  target: string;
  body?: 'male' | 'female';
  mates: number;
  /** Standing needed before they'll offer it. */
  needs: number;
  /** Pay, times an ordinary job's. */
  mult: number;
  /** What you get on top. */
  reward: string;
  /** The thing you carry (deliveries, deals, getting something back). */
  item?: string;
  fights?: boolean;
}

export const CHAINS: Record<ContactId, ChainStep[]> = {
  terry: [
    { kind: 'sort', title: 'Barred for life', brief: 'Some lad called Rhys glassed one of Terry’s regulars and laughed about it. He drinks on the estate. Make sure he stops laughing.', area: 'estate', target: 'Rhys', mates: 1, needs: 0, mult: 2, reward: 'first_aid' },
    { kind: 'recover', title: 'The landlord’s ring', brief: 'Ray’s late dad’s ring went missing the night Shaun Pike was in. Shaun’s been flashing it about on the High Street. Get it back.', area: 'high_street', target: 'Shaun Pike', mates: 2, needs: 15, mult: 2.5, reward: 'ring_signet', item: 'job_ring' },
    { kind: 'sort', title: 'Last orders', brief: 'The Gaffer’s old crew want Weatherspoons. Their top boy, Vinnie Rourke, is on Hollins with his lads. Terry wants it finished.', area: 'residential', target: 'Vinnie Rourke', mates: 3, needs: 35, mult: 3, reward: 'w_baseball_bat' },
  ],
  bev: [
    { kind: 'debt', title: 'The window cleaner', brief: 'Ste borrowed for a new van and bought a holiday instead. He’s on the estate, tanned. He’ll pay.', area: 'estate', target: 'Ste', mates: 0, needs: 0, mult: 2, reward: 'plasters' },
    { kind: 'debt', title: 'Double or nothing', brief: 'Lorraine borrowed to cover a bet and lost that as well. She’s on Hollins with her brothers, and they say she isn’t paying.', area: 'residential', target: 'Lorraine', body: 'female', mates: 2, needs: 15, mult: 2.5, reward: 'chain_silver', fights: true },
    { kind: 'debt', title: 'The big one', brief: 'Martin Hale (no relation, he says) owes Bev more than her house is worth. He’s on the High Street with two minders. Every penny.', area: 'high_street', target: 'Martin Hale', mates: 2, needs: 35, mult: 3, reward: 'watch_silver', fights: true },
  ],
  kez: [
    { kind: 'deliver', title: 'Drop-off', brief: 'A parcel for Tash on the estate. Don’t open it, don’t stop, don’t be late.', area: 'estate', target: 'Tash', body: 'female', mates: 0, needs: 0, mult: 2, reward: 'energy_drink', item: 'job_parcel' },
    { kind: 'deal', title: 'New customer', brief: 'Someone on the High Street wants a lot more than usual. Kez wants you there for it. Watch him.', area: 'high_street', target: 'Big Col', mates: 2, needs: 15, mult: 2.5, reward: 'chain_cheap', item: 'job_package', fights: true },
    { kind: 'deliver', title: 'The re-up', brief: 'Kez’s supplier needs paying, and he only deals face to face. Take the bag to Leon on Hollins. All of it.', area: 'residential', target: 'Leon', mates: 0, needs: 35, mult: 3, reward: 'watch_cheap', item: 'job_parcel' },
  ],
  del: [
    { kind: 'deliver', title: 'Fresh off the lorry', brief: 'A box of ‘genuine’ trainers for a stall in the Back Alleys. Quick, before anyone asks where they came from.', area: 'alleys', target: 'Mandy', body: 'female', mates: 0, needs: 0, mult: 2, reward: 'fry_up', item: 'job_parcel' },
    { kind: 'recover', title: 'Lorry’s gone missing', brief: 'The phones Del was going to sell got nicked off the lorry by Craig Mullen’s lot. They’re in the Industrial Quarter. Del wants his stock.', area: 'industrial', target: 'Craig Mullen', mates: 2, needs: 15, mult: 2.5, reward: 'watch_cheap', item: 'job_phones' },
    { kind: 'recover', title: 'The ledger', brief: 'Del’s book of who owes him (and who he owes) is with a grass called Nicky in the alleys. If the police get it, Del’s finished.', area: 'alleys', target: 'Nicky', mates: 2, needs: 35, mult: 3, reward: 'w_wrench', item: 'job_ledger' },
  ],
  nails: [
    { kind: 'sort', title: 'New management', brief: 'A few of the Gaffer’s lads reckon they’re in charge now. Their mouthy one, Dazza, is on the High Street. Put him right.', area: 'high_street', target: 'Dazza', mates: 2, needs: 0, mult: 2, reward: 'w_chain' },
    { kind: 'debt', title: 'Protection', brief: 'The kebab shop’s owner stopped paying when the Gaffer went. He’s got his cousin with him now. Collect.', area: 'high_street', target: 'Mehmet', mates: 1, needs: 15, mult: 2.5, reward: 'first_aid', fights: true },
    { kind: 'sort', title: 'One firm', brief: 'The last of the Gaffer’s crew are in the Industrial Quarter with their top boy, Clint Varley. After this, the alleys are Nails’.', area: 'industrial', target: 'Clint Varley', mates: 3, needs: 35, mult: 3, reward: 'w_metal_bar' },
  ],
};


/** A contact's station: they stand `dz` behind the spot you use them from. */
export function contactStation(id: ContactId, x: number, z: number, dz: number): StationDef {
  const c = CONTACTS[id];
  return {
    id: 'contact', x, z, tab: id, label: `${c.name}, ${c.role.toLowerCase()}: jobs`,
    npc: { name: c.name, seed: c.look.seed, body: c.look.body, top: c.look.top, topColour: c.look.topColour, dz },
  };
}
