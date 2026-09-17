<script setup>
import Chevron from '@/components/icons/Chevron.vue'

function handleCardClick() {
    const card = document.querySelector('.card')
    card.classList.toggle('open')
}

</script>

<template>
    <article class="card" @click="handleCardClick">
        <div class="left">
            <div class="day-date">
               <p class="day">Today</p>
               <p class="date">17 Sep</p>
            </div>
            <div class="weather">
                <p>☀️</p>
                <p class="description">Sunny</p>
            </div>
        </div>

        <div class="right">
            <div class="daily-temps">
                <p class="max">25°</p>
                <p class="min">15°</p>
            </div>
            <Chevron class="card-chevron"/>
        </div>
    </article>
</template>

<style scoped>
    .card {
        display: flex;
        border: 2px solid var(--color-border);
        border-radius: var(--border-radius);
        padding: 1rem;
        cursor: pointer;
        align-items: center;
        width: 100%;
    }
    .card:hover {
        border-color: var(--color-border-hover);
    }
    .card.open .card-chevron {
        transform: rotate(-180deg);
    }
    .day-date {
        display: flex;
        flex-direction: column;
    }
    .day {
        font-size: 1.2rem;
        font-weight: bold;
        color: #ffffff;
    }
    .left {
        display: flex;
        gap: 3rem;
    }
    .weather {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }
    .weather .description {
        font-size: 1.5rem;
        color: #ffffff;
    }
    .right {
        display: flex;
        margin-left: auto;
        align-items: center;
        justify-content: space-between;
        gap: 0.7rem;
    }
    .daily-temps {
        display: flex;
        flex-direction: row;
        align-items: baseline;
        gap: 0.5rem;
    }
    .daily-temps .max {
        font-size: 1.5rem;
        font-weight: bold;
        color: #ffffff;
    }
    .daily-temps .min {
        font-size: 1rem;
        color: #ffffff;
    }
</style>
