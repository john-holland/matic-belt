export interface ProcessInfo {
  pid: number;
  name: string;
  cpu: number;
  memory: number;
  command: string;
  isDaemon: boolean;
}

export interface PortInfo {
  port: number;
  protocol: string;
  state: string;
  process: string;
  pid?: number;
}

export interface SystemInfo {
  cpuUsage: number;
  memoryUsage: number;
  uptime: number;
  platform: string;
  arch: string;
  hostname: string;
}

export interface EnvironmentInfo {
  variables: Record<string, string>;
  currentDirectory: string;
  user: string;
  shell: string;
}

export interface AnalysisOptions {
  verbose?: boolean;
  ports?: boolean;
  daemons?: boolean;
  environment?: boolean;
}

export interface AnalysisResult {
  system: SystemInfo;
  processes: ProcessInfo[];
  ports: PortInfo[];
  environment: EnvironmentInfo;
  timestamp: Date;
}

export interface Suggestion {
  type: 'command' | 'warning' | 'info' | 'optimization';
  message: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
} 