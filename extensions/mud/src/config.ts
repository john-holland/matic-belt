export const config = {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || '',
    GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
    GITHUB_TOKEN: process.env.GITHUB_TOKEN || '',
    WEATHER_API_KEY: process.env.WEATHER_API_KEY || '',
    WEATHER_API_URL: 'https://api.openweathermap.org/data/2.5',
    DEFAULT_LOCATION: {
        lat: 40.7128,
        lon: -74.0060,
        city: 'New York'
    },
    PORT: process.env.PORT || 3001,
    NODE_ENV: process.env.NODE_ENV || 'development'
}; 