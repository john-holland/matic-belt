import axios from 'axios';
import { config } from '../config';

export interface WeatherInfo {
    temperature: number;
    description: string;
    humidity: number;
    windSpeed: number;
    city: string;
    timestamp: number;
}

export interface TimeInfo {
    currentTime: string;
    timezone: string;
    timestamp: number;
}

export class WeatherTimeService {
    private weatherCache: Map<string, { data: WeatherInfo; timestamp: number }> = new Map();
    private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

    public async getWeather(location?: { lat: number; lon: number; city: string }): Promise<WeatherInfo> {
        const loc = location || config.DEFAULT_LOCATION;
        const cacheKey = `${loc.lat},${loc.lon}`;
        
        // Check cache
        const cached = this.weatherCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
            return cached.data;
        }

        try {
            const response = await axios.get(`${config.WEATHER_API_URL}/weather`, {
                params: {
                    lat: loc.lat,
                    lon: loc.lon,
                    appid: config.WEATHER_API_KEY,
                    units: 'metric'
                }
            });

            const weatherData: WeatherInfo = {
                temperature: response.data.main.temp,
                description: response.data.weather[0].description,
                humidity: response.data.main.humidity,
                windSpeed: response.data.wind.speed,
                city: loc.city,
                timestamp: Date.now()
            };

            // Update cache
            this.weatherCache.set(cacheKey, {
                data: weatherData,
                timestamp: Date.now()
            });

            return weatherData;
        } catch (error) {
            console.error('Error fetching weather:', error);
            throw new Error('Failed to fetch weather data');
        }
    }

    public getTime(timezone: string = 'UTC'): TimeInfo {
        const now = new Date();
        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: timezone,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        });

        return {
            currentTime: formatter.format(now),
            timezone,
            timestamp: now.getTime()
        };
    }

    public getTimeForLocation(location?: { lat: number; lon: number }): TimeInfo {
        // This is a simplified version. In a real application, you would use a geocoding service
        // to get the timezone based on coordinates
        const timezone = 'America/New_York'; // Default to EST
        return this.getTime(timezone);
    }
} 