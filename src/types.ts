export type TaskCategory = 'Personal' | 'Work';
export type TaskStatus = 'Active' | 'Completed' | 'Caution' | 'EarlyFinish';

export interface Task {
  id: string;
  title: string;
  description?: string;
  category: TaskCategory;
  status: TaskStatus;
  startTime: Date; // Start time within the year
  endTime: Date;   // End time within the year
  earlyFinishTime?: Date;
  color?: string;
}

export interface OrbitState {
  zoom: number; // 1 for annual, higher for granular
  rotation: number; // Rotation of the ring
  centerDate: Date;
}
