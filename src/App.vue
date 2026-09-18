<script setup>
import DailyWeatherCard from '@/components/DailyWeatherCard.vue'
import DeltaTChart from '@/components/DeltaTChart.vue';
import DailyCardList from '@/components/DailyCardList.vue'
</script>

<template>
  <DailyCardList />
  <DailyWeatherCard />
  <DeltaTChart />
</template>

<style scoped></style>
