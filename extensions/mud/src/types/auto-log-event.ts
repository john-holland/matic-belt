export interface AutoLogEvent {
    type: 'weather' | 'time' | 'weather-time';
    data: any;
    timestamp: number;
} 