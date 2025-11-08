
const url = 'https://api.openweathermap.org/data/2.5/';
const key = 'aee9368ab4b3e538bec75d39005eccf3';

// Splash screen logic
window.addEventListener('load', () => {
    const splash = document.getElementById('splash-screen');
    const app = document.querySelector('.app');

    setTimeout(() => {
        splash.style.opacity = 0;
        splash.addEventListener('transitionend', () => {
            splash.style.display = 'none';
            app.style.display = 'flex';
            setTimeout(() => {
                app.style.opacity = 1;
            }, 50); // Small delay to ensure display:flex is applied before opacity transition
        });
    }, 2000); // Show splash screen for 2 seconds
});

const setQuery = (e) => {
    if (e.keyCode == '13') {
        getResults(searchBar.value);
    }
};

const getResults = (cityName) => {
    if (cityName === "") {
        alert("Şehir adı boş bırakılamaz");
        return;
    }

    let weatherQuery = `${url}weather?q=${cityName}&appid=${key}&units=metric&lang=tr`;
    let forecastQuery = `${url}forecast?q=${cityName}&appid=${key}&units=metric&lang=tr`;

    Promise.all([fetch(weatherQuery), fetch(forecastQuery)])
        .then(async ([weatherResponse, forecastResponse]) => {
            const weather = await weatherResponse.json();
            const forecast = await forecastResponse.json();
            displayResults(weather, forecast);
        })
        .catch(err => console.error(err));
};

const displayResults = (weather, forecast) => {
    displayCurrentWeather(weather);
    displayForecast(forecast);
};

const displayCurrentWeather = (result) => {
    let city = document.querySelector('.city');
    city.innerText = `${result.name}, ${result.sys.country}`;

    let temp = document.querySelector('.temp');
    temp.innerText = `${Math.round(result.main.temp)}°C`;

    let desc = document.querySelector('.desc');
    desc.innerText = result.weather[0].description;

    let minmax = document.querySelector('.minmax');
    minmax.innerText = `Min: ${Math.round(result.main.temp_min)}°C / Maks: ${Math.round(result.main.temp_max)}°C`;
};

const displayForecast = (result) => {
    const forecastContainer = document.querySelector('.forecast-container');
    forecastContainer.innerHTML = ''; // Clear previous forecast

    const dailyForecasts = result.list.filter(item => item.dt_txt.includes("12:00:00"));

    dailyForecasts.forEach(day => {
        const date = new Date(day.dt_txt);
        const dayName = date.toLocaleDateString('tr-TR', { weekday: 'long' });

        const forecastElement = document.createElement('div');
        forecastElement.classList.add('forecast-day');

        forecastElement.innerHTML = `
            <div class="forecast-date">${dayName}</div>
            <img src="http://openweathermap.org/img/wn/${day.weather[0].icon}.png" alt="weather icon">
            <div class="forecast-temp">${Math.round(day.main.temp)}°C</div>
        `;
        forecastContainer.appendChild(forecastElement);
    });
};

const searchBar = document.querySelector('#searchBar');
searchBar.addEventListener('keypress', setQuery);

// Load default city on startup
getResults("İstanbul");
