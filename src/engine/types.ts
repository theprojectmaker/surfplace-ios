export type Skill = 'beginner' | 'intermediate' | 'advanced';
export type Units = 'us' | 'metric';

export type Spot = {
  id: string;
  name: string;
  region: string;
  lat: number;
  lon: number;
  /** compass direction the beach faces out to sea, or null for a custom spot */
  facing: number | null;
  top?: boolean;
  custom?: boolean;
};
