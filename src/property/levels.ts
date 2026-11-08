import type { AreaId, GameSave } from '../progress/Progress';
import type { LevelDef, PropDef, StationDef } from '../world/LevelTypes';
import { HOME_BASE, LEVELS } from '../world/levels';
import { BIKES, BIKE_SIZE, CARS } from './catalogue';
import { compPrize } from './casino';
import { buildHomeLevel } from './home';
import { DRIVEWAY } from './state';
import { buildBasementLevel } from '../business/basement';

/**
 * Areas as they are for this save: the house with your furniture, your car
 * on the drive, your bike wherever you left it, this week's prize on the
 * casino podium. Everything else is the fixed level data.
 */
export function resolveLevel(area: AreaId, save: GameSave): LevelDef {
  const prop = save.property;
  let level: LevelDef = area === 'home' ? buildHomeLevel(HOME_BASE, prop, save.gym) : area === 'basement' ? buildBasementLevel(save.basement) : LEVELS[area];
  const props: PropDef[] = [];
  const stations: StationDef[] = [];

  if (area === 'estate') {
    const car = prop.cars.find((c) => c.uid === prop.activeCar);
    if (car) {
      const def = CARS[car.id];
      props.push({ kind: 'vehicle', item: car.id, colour: car.colour, x: DRIVEWAY.x, z: DRIVEWAY.z, size: def.size });
      stations.push({ id: 'car', x: DRIVEWAY.x, z: DRIVEWAY.z + def.size[1] + 0.4, label: `Your ${def.name}: drive somewhere, swap cars` });
    }
  }

  const out = prop.bikeOut;
  if (out && !prop.riding && out.area === area && area !== 'home') {
    const bike = prop.bikes.find((b) => b.uid === out.uid);
    if (bike) {
      // Parked bikes don't block you (you might be stood where you got off).
      props.push({ kind: 'vehicle', item: bike.id, colour: bike.colour, x: out.x, z: out.z, size: BIKE_SIZE, solid: false });
      stations.push({ id: 'bike', x: out.x, z: out.z + 0.2, label: `Your ${BIKES[bike.id].name}: get on` });
    }
  }

  if (area === 'casino') {
    const prize = compPrize(save.trips);
    const podium = level.props.find((p) => p.kind === 'prize_podium');
    if (podium) {
      const size: [number, number] = prize.kind === 'car' ? CARS[prize.id].size : BIKE_SIZE;
      props.push({ kind: 'vehicle', item: prize.id, colour: prize.colour, x: podium.x, z: podium.z, size, solid: false, label: 'podium' });
    }
  }

  if (props.length || stations.length) level = { ...level, props: [...level.props, ...props], stations: [...(level.stations ?? []), ...stations] };
  return level;
}
