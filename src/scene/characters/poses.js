/**
 * Joint positions (metres, couple space: feet on the ridge at y = 0, both
 * facing +z = out over the city; she stands in front, he is behind her and
 * his left hand side is +x).
 *
 * REST: his arms wrapped around her waist from behind, both looking out.
 *       (Him: Tanjiro-style. Her: Kanao-style — capelet, skirt, side ponytail.)
 * KISS: she rises onto her toes and turns back over her left shoulder, one
 *       hand on his cheek; he leans down over her shoulder.
 */
export const GUY_REST = {
  pelvis: [0, 0.95, -0.17],
  chest: [0, 1.38, -0.15],
  haoriTop: [0, 1.43, -0.15],
  haoriBottom: [0, 0.72, -0.17],
  neck: [0, 1.56, -0.13],
  head: [0, 1.665, -0.11],
  shoulderL: [0.19, 1.4, -0.15],
  shoulderR: [-0.19, 1.4, -0.15],
  elbowL: [0.25, 1.13, -0.03],
  elbowR: [-0.25, 1.13, -0.03],
  handL: [0.05, 1.0, 0.27],
  handR: [-0.05, 0.99, 0.28],
  hipL: [0.09, 0.95, -0.17],
  hipR: [-0.09, 0.95, -0.17],
  kneeL: [0.1, 0.5, -0.14],
  kneeR: [-0.1, 0.5, -0.14],
  ankleL: [0.1, 0.09, -0.17],
  ankleR: [-0.1, 0.09, -0.17],
  toeL: [0.1, 0.05, -0.02],
  toeR: [-0.1, 0.05, -0.02],
};

export const GUY_KISS = {
  ...GUY_REST,
  chest: [0.02, 1.36, -0.13],
  haoriTop: [0.022, 1.41, -0.13],
  neck: [0.045, 1.53, -0.09],
  head: [0.075, 1.6, -0.06],
  shoulderL: [0.21, 1.38, -0.13],
  shoulderR: [-0.17, 1.39, -0.14],
  elbowL: [0.26, 1.12, -0.01],
  elbowR: [-0.24, 1.12, -0.01],
  handL: [0.05, 1.02, 0.26],
  handR: [-0.05, 1.01, 0.27],
};

export const GIRL_REST = {
  pelvis: [0, 0.86, 0.12],
  chest: [0, 1.24, 0.12],
  neck: [0, 1.4, 0.13],
  head: [0, 1.49, 0.14],
  capeTop: [0, 1.38, 0.12],
  capeBottom: [0, 0.99, 0.12], // drapes over the upper arms
  skirtHem: [0, 0.5, 0.13],
  hipL: [0.075, 0.84, 0.12],
  hipR: [-0.075, 0.84, 0.12],
  kneeL: [0.085, 0.46, 0.14],
  kneeR: [-0.085, 0.46, 0.14],
  shoulderL: [0.16, 1.27, 0.12],
  shoulderR: [-0.16, 1.27, 0.12],
  elbowL: [0.2, 1.04, 0.17],
  elbowR: [-0.2, 1.04, 0.17],
  handL: [0.07, 1.0, 0.31],
  handR: [-0.07, 1.0, 0.31],
  ankleL: [0.085, 0.07, 0.12],
  ankleR: [-0.085, 0.07, 0.12],
  toeL: [0.085, 0.035, 0.24],
  toeR: [-0.085, 0.035, 0.24],
};

export const GIRL_KISS = {
  ...GIRL_REST,
  pelvis: [0.005, 0.885, 0.115],
  chest: [0.012, 1.27, 0.11],
  neck: [0.045, 1.43, 0.11],
  head: [0.095, 1.51, 0.1],
  capeTop: [0.03, 1.41, 0.11],
  capeBottom: [0.01, 1.02, 0.11],
  skirtHem: [0.003, 0.53, 0.125],
  hipL: [0.08, 0.865, 0.115],
  hipR: [-0.07, 0.865, 0.115],
  kneeL: [0.085, 0.49, 0.13],
  kneeR: [-0.085, 0.49, 0.13],
  shoulderL: [0.165, 1.3, 0.1],
  shoulderR: [-0.15, 1.29, 0.12],
  elbowL: [0.29, 1.47, 0.01],
  handL: [0.16, 1.58, -0.04],
  ankleL: [0.085, 0.1, 0.11],
  ankleR: [-0.085, 0.1, 0.11],
};

// Where each head looks
export const GUY_GAZE_REST = [0, 1.45, 2.6]; // out over her head, toward the city
export const GUY_GAZE_KISS = GIRL_KISS.head;
export const GIRL_GAZE_REST = [0, 1.62, 3.0];
export const GIRL_GAZE_KISS = GUY_KISS.head;
