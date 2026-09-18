import { useQuery } from '@tanstack/vue-query'
import { fetchForecast } from '@/api/forecast'

export function useForecast() {
    return useQuery({
        queryKey: ['forecast'],
        queryFn: fetchForecast,
    })
}