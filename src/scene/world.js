import { Vector3 } from 'three';

/** World layout. Units are metres. The top of the roof ridge (where the couple stands) is y = 0. */
export const WORLD = {
  groundY: -60, // street level far below the rooftop
  // Pitched (gabled) roof on top of the tower. Ridge runs along x.
  roof: {
    halfLength: 4.8, // ridge half-length incl. overhang
    halfDepth: 4.6, // ridge → eave, horizontal
    drop: 3.1, // ridge → eave, vertical
    ridgeDepth: 0.78, // flat-topped ridge cap the couple stands on
  },
  cityRadius: 470,
  fog: { color: '#170f2c', density: 0.0021 },
  moonDir: new Vector3(-0.55, 0.29, -0.78).normalize(),
};
