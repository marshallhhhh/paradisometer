const LATITUDE = -43.2
const LONGITUDE = 147.8

const hourlyWeatherVariables = [
    'temperature_2m',
    'wet_bulb_temperature_2m'
]

const dailyWeatherVariables = [
    'weather_code',
    'temperature_2m_max',
    'temperature_2m_min'
]

let url = new URL('https://api.open-meteo.com/v1/forecast')
url.searchParams.append('latitude', LATITUDE)
url.searchParams.append('longitude', LONGITUDE)
url.searchParams.append('hourly', hourlyWeatherVariables.join(','))
url.searchParams.append('daily', dailyWeatherVariables.join(','))
url.searchParams.append('past_days', 1)
url.searchParams.append('forecast_days', 3)
url.searchParams.append('timezone', 'Australia/Hobart')

//https://api.open-meteo.com/v1/forecast?latitude=-43.2&longitude=147.8&daily=weather_code,temperature_2m_max,temperature_2m_min&hourly=temperature_2m,wet_bulb_temperature_2m&past_days=1&forecast_days=3
export async function fetchForecast() {
    const response = await fetch(url)
    const data = await response.json();

    var { time, ...fields } = data.daily;
    const daily = time.map((date, index) => ({
        date,
        ...Object.fromEntries(
            Object.entries(fields).map(([key, values]) => [
                key,
                values[index]
            ])
        )
    }))

    const deltaT = data.hourly.temperature_2m.map((temperature, index) => 
        temperature - data.hourly.wet_bulb_temperature_2m[index]
    )

    return {
        hourly: {
            ...data.hourly,
            deltaT
        },
        daily
    }
}