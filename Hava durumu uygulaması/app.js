
const url = 'https://api.openweathermap.org/data/2.5/';
const key = 'aee9368ab4b3e538bec75d39005eccf3';

// Splash screen logic
window.addEventListener('load', () => {
    const splash = document.getElementById('splash-screen');
    const app = document.querySelector('.app');

    // Try to play startup sound as soon as the splash appears (if initApp prepared the audio)
    if (typeof window.attemptPlayStartupSound === 'function') {
        try { window.attemptPlayStartupSound(); } catch (e) { /* ignore */ }
    }

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

// getResults accepts either a city name string, or an object { lat, lon, name }
const getResults = (query) => {
    let weatherQuery;
    let forecastQuery;

    if (!query) {
        alert("Şehir adı boş bırakılamaz");
        return;
    }

    if (typeof query === 'string') {
        const cityName = query;
        weatherQuery = `${url}weather?q=${encodeURIComponent(cityName)}&appid=${key}&units=metric&lang=tr`;
        forecastQuery = `${url}forecast?q=${encodeURIComponent(cityName)}&appid=${key}&units=metric&lang=tr`;
        lastQuery = cityName;
    } else if (typeof query === 'object' && query.lat != null && query.lon != null) {
        const { lat, lon } = query;
        weatherQuery = `${url}weather?lat=${lat}&lon=${lon}&appid=${key}&units=metric&lang=tr`;
        forecastQuery = `${url}forecast?lat=${lat}&lon=${lon}&appid=${key}&units=metric&lang=tr`;
        // store lastQuery as coordinates so auto-updates can reuse
        lastQuery = { lat, lon };
    } else {
        console.error('Geçersiz sorgu tipi getResults için:', query);
        return;
    }

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
    // store last weather for background decisions
    lastWeather = result;
    let city = document.querySelector('.city');
    city.innerText = `${result.name}, ${result.sys.country}`;

    let temp = document.querySelector('.temp');
    temp.innerText = `${Math.round(result.main.temp)}°C`;

    let desc = document.querySelector('.desc');
    desc.innerText = result.weather[0].description;

    let minmax = document.querySelector('.minmax');
    minmax.innerText = `Min: ${Math.round(result.main.temp_min)}°C / Maks: ${Math.round(result.main.temp_max)}°C`;
    // Wind info (speed m/s -> km/h) and direction
    const windEl = document.querySelector('.wind');
    if (result.wind) {
        const speedMs = result.wind.speed || 0;
        const speedKmh = Math.round(speedMs * 3.6);
        const deg = result.wind.deg;
        const dir = typeof deg === 'number' ? degToCardinal(deg) : '';
        windEl.innerText = `${dir} ${speedKmh} km/saat`;
    } else {
        windEl.innerText = '';
    }
    // humidity and pressure
    const humEl = document.querySelector('.humidity');
    const presEl = document.querySelector('.pressure');
    if (result.main) {
        humEl.innerText = `${result.main.humidity}%`;
        presEl.innerText = `${result.main.pressure} hPa`;
    }
    // large icon
    const iconLarge = document.querySelector('.icon-large');
    if (result.weather && result.weather[0]) {
        const icon = result.weather[0].icon;
        iconLarge.style.backgroundImage = `url(http://openweathermap.org/img/wn/${icon}@2x.png)`;
    }
    // Set background based on searched city's local time using timezone offset from API
    if (typeof result.timezone !== 'undefined') {
        setBackgroundForTimezone(result.timezone);
    }
};

// Convert degrees to cardinal direction (8-point)
const degToCardinal = (deg) => {
    if (deg == null) return '';
    // Turkish abbreviations: K (Kuzey), KD (Kuzeydoğu), D (Doğu), GD (Güneydoğu), G (Güney), GB (Güneybatı), B (Batı), KB (Kuzeybatı)
    const directions = ['K', 'KD', 'D', 'GD', 'G', 'GB', 'B', 'KB'];
    const normalized = ((deg % 360) + 360) % 360; // ensure 0-359
    const index = Math.round(normalized / 45) % 8;
    return directions[index];
};

/**
 * Set page background image based on city's local time.
 * timezoneSec: shift in seconds from UTC (provided by OpenWeatherMap `timezone` field)
 * Logic: if local time is between 17:30 and 05:59 (inclusive) -> night background.png
 *        otherwise -> sabah arka planı.png
 */
const setBackgroundForTimezone = (timezoneSec) => {
    // Get current UTC time in milliseconds
    const now = new Date();
    const utcMs = now.getTime() + (now.getTimezoneOffset() * 60000);

    // City's local time in ms
    const cityLocalMs = utcMs + (timezoneSec * 1000);
    const cityDate = new Date(cityLocalMs);
    const hour = cityDate.getHours();
    const minute = cityDate.getMinutes();

    // Determine night: 17:30 <= time OR time < 6:00
    const isNight = (hour > 17) || (hour === 17 && minute >= 30) || (hour < 6);

    const body = document.body;
    // Use CSS classes so we can transition/fade backgrounds in CSS
    body.classList.remove('bg-sabah', 'bg-night');
    if (isNight) {
        body.classList.add('bg-night');
    } else {
        body.classList.add('bg-sabah');
    }
    // Start or update the city clock shown in the top-right
    startCityClock(timezoneSec);
    // also update background video based on last fetched weather if available
    if (lastWeather) {
        setBackgroundVideo(lastWeather);
    }
};

// Set background video according to weather conditions
let lastWeather = null; // store last weather object
let videoSoundEnabled = false;
let videoVolumeValue = 0.6;
// Click sound global state and audio object
let clickSoundEnabled = true;
let clickSound = null;
// Startup sound state and audio
let startupSoundEnabled = true;
let startupSound = null;
// Create startup audio early so it's ready by the time the splash appears
try {
    startupSound = new Audio('Başlatma.mp3');
    startupSound.preload = 'auto';
    startupSound.volume = 0.9;
} catch (e) {
    console.warn('Could not create startup audio at script load:', e);
    startupSound = null;
}
// Error sound (Hata.mp3) - play on failures/offline
let errorSound = null;
try {
    errorSound = new Audio('Hata.mp3');
    errorSound.preload = 'auto';
    errorSound.volume = 0.9;
} catch (e) {
    console.warn('Could not create error audio at script load:', e);
    errorSound = null;
}

const playErrorSound = () => {
    if (!errorSound) return;
    try {
        // Try play; modern browsers may block autoplay but this is typically in response to a user gesture.
        errorSound.currentTime = 0;
        const p = errorSound.play();
        if (p !== undefined) p.catch(()=>{});
    } catch (e) {
        // ignore
    }
};
const setBackgroundVideo = (weatherObj) => {
    if (!weatherObj || !weatherObj.weather || !Array.isArray(weatherObj.weather)) return hideBgVideo();
    const w = weatherObj.weather[0];
    const main = (w.main || '').toLowerCase();
    const id = w.id || 0;
    const videoEl = document.getElementById('bg-video');
    if (!videoEl) return;

    // choose video: rain -> 1.mp4, clouds -> 2.mp4, snow -> 3.mp4
    let src = '';
    if (main.includes('rain') || main.includes('drizzle') || (id >= 500 && id < 600)) {
        src = './1.mp4';
    } else if (main.includes('snow') || (id >= 600 && id < 700)) {
        src = './3.mp4';
    } else if (main.includes('cloud')) {
        src = './2.mp4';
    }

    if (src) {
        // ensure video sound/muted and volume set before playing
        videoEl.muted = !videoSoundEnabled;
        videoEl.volume = typeof videoVolumeValue === 'number' ? videoVolumeValue : 0.6;

        if (videoEl.getAttribute('src') !== src) {
            // set new source and try to play
            videoEl.setAttribute('src', src);
            // reload to apply new source
            videoEl.load();
            // attempt to play (may be muted or unmuted depending on setting)
            const playPromise = videoEl.play();
            if (playPromise !== undefined) {
                playPromise.catch(err => {
                    // autoplay might be blocked when unmuted; inform user in console
                    console.warn('Video play prevented (may be autoplay restriction):', err);
                });
            }
        } else {
            // same source, ensure it's playing
            videoEl.play().catch(err => {
                console.warn('Video play prevented (same src):', err);
            });
        }
        videoEl.classList.add('visible');
        // optionally hide the pseudo-image so video is foreground (pseudo element behind video has z-index -1)
        document.body.classList.add('using-video');
    } else {
        hideBgVideo();
    }
};

const hideBgVideo = () => {
    const videoEl = document.getElementById('bg-video');
    if (!videoEl) return;
    videoEl.classList.remove('visible');
    try { videoEl.pause(); } catch (e) {}
    document.body.classList.remove('using-video');
};

// Interval handle for city clock so we can clear previous timers
let cityClockInterval = null;

const startCityClock = (timezoneSec) => {
    const el = document.getElementById('city-time');
    if (!el) return;
    if (cityClockInterval) {
        clearInterval(cityClockInterval);
        cityClockInterval = null;
    }

    const updateClock = () => {
        const now = new Date();
        const utcMs = now.getTime() + (now.getTimezoneOffset() * 60000);
        const cityMs = utcMs + (timezoneSec * 1000);
        const cityDate = new Date(cityMs);
        const hh = String(cityDate.getHours()).padStart(2, '0');
        const mm = String(cityDate.getMinutes()).padStart(2, '0');
        el.textContent = `${hh}:${mm}`;
    };

    updateClock();
    // Update every second so minutes change exactly when needed
    cityClockInterval = setInterval(updateClock, 1000);
};

const displayForecast = (result) => {
    // result is forecast JSON (3-hour steps)
    const hourlyContainer = document.querySelector('.hourly-container');
    const dailyContainer = document.querySelector('.daily-container');
    hourlyContainer.innerHTML = '';
    dailyContainer.innerHTML = '';
    // Build approximately 4-hourly forecast entries for the next 24 hours
    // hourly: pick next 8 items (approx 24h since OWM is 3h steps)
    const nextItems = result.list.slice(0, 8);
    nextItems.forEach(it => {
        const date = new Date(it.dt * 1000);
        const timeLabel = date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
        const el = document.createElement('div');
        el.className = 'hourly-item';
        const icon = it.weather && it.weather[0] ? it.weather[0].icon : '01d';
        const temp = Math.round(it.main.temp);
        el.innerHTML = `
            <div class="time">${timeLabel}</div>
            <img src="http://openweathermap.org/img/wn/${icon}.png" alt="icon">
            <div class="temp">${temp}°C</div>
            <div class="wind-brief">${it.wind ? degToCardinal(it.wind.deg) + ' ' + Math.round(it.wind.speed*3.6) + ' km/saat' : ''}</div>
        `;
        hourlyContainer.appendChild(el);
    });

    // daily: group by date, compute min/max and choose an icon
    const days = {};
    result.list.forEach(it => {
        const d = new Date(it.dt * 1000);
        const key = d.toISOString().split('T')[0];
        if (!days[key]) days[key] = [];
        days[key].push(it);
    });
    // show 5 days in the daily forecast
    const keys = Object.keys(days).slice(0, 5);
    keys.forEach(k => {
        const arr = days[k];
        let min = Infinity, max = -Infinity, icon = null;
        arr.forEach(it => {
            if (it.main.temp_min < min) min = it.main.temp_min;
            if (it.main.temp_max > max) max = it.main.temp_max;
            if (!icon && it.weather && it.weather[0]) icon = it.weather[0].icon;
        });
        const date = new Date(k + 'T00:00:00');
        const dayLabel = date.toLocaleDateString('tr-TR', { weekday: 'long' });
        const di = document.createElement('div');
        di.className = 'daily-item';
        di.innerHTML = `
            <div class="day">${dayLabel}</div>
            <div class="range"><img src="http://openweathermap.org/img/wn/${icon}.png" alt="icon"> ${Math.round(min)}° / ${Math.round(max)}°</div>
        `;
        dailyContainer.appendChild(di);
    });
};

/**
 * Build a forecast array by picking the closest available forecast item to each 4-hour step.
 * list: forecast.list from OWM (3-hour steps)
 * hoursAhead: how far ahead to build (24)
 * stepHours: step between desired points (4)
 */
const buildFourHourlyForecast = (list, hoursAhead = 24, stepHours = 4) => {
    if (!Array.isArray(list) || list.length === 0) return [];
    const now = Date.now(); // ms
    const results = [];

    for (let h = stepHours; h <= hoursAhead; h += stepHours) {
        const targetMs = now + h * 3600000;
        // find item with minimal time difference to target
        let closest = null;
        let bestDiff = Infinity;
        for (const it of list) {
            const itemMs = it.dt * 1000;
            const diff = Math.abs(itemMs - targetMs);
            if (diff < bestDiff) {
                bestDiff = diff;
                closest = it;
            }
        }
        if (closest) results.push(closest);
    }

    // remove duplicates (same dt) while preserving order
    const uniq = [];
    const seen = new Set();
    for (const r of results) {
        if (!seen.has(r.dt)) {
            uniq.push(r);
            seen.add(r.dt);
        }
    }
    return uniq;
};

const searchBar = document.querySelector('#searchBar');
searchBar.addEventListener('keypress', setQuery);

// --- Auto-update & settings support ---
let lastQuery = null; // string or {lat,lon}
let autoUpdateIntervalId = null;
const DEFAULT_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4 hours

const startAutoUpdates = (intervalMs = DEFAULT_INTERVAL_MS) => {
    if (!lastQuery) return;
    stopAutoUpdates();
    autoUpdateIntervalId = setInterval(() => {
        getResults(lastQuery);
    }, intervalMs);
};

const stopAutoUpdates = () => {
    if (autoUpdateIntervalId) {
        clearInterval(autoUpdateIntervalId);
        autoUpdateIntervalId = null;
    }
};

// Initialize settings UI and geolocation
const initApp = () => {
    // Settings elements
    const settingsBtn = document.getElementById('settings-btn');
    const settingsModal = document.getElementById('settings-modal');
    const closeSettings = document.getElementById('close-settings');
    const autoToggle = document.getElementById('auto-update-toggle');
    const intervalInput = document.getElementById('update-interval');
    const videoToggle = document.getElementById('video-sound-toggle');
    const volumeInput = document.getElementById('video-volume');
    const videoEl = document.getElementById('bg-video');

    // Load saved settings
    const savedAuto = localStorage.getItem('autoUpdate');
    const savedInterval = localStorage.getItem('updateIntervalHours');
    if (savedAuto !== null) {
        autoToggle.checked = savedAuto === 'true';
    } else {
        // default: enable auto-updates
        autoToggle.checked = true;
        localStorage.setItem('autoUpdate', 'true');
    }
    if (savedInterval !== null) {
        intervalInput.value = Number(savedInterval);
    }
    // video sound settings
    const savedVideoSound = localStorage.getItem('videoSound');
    const savedVideoVolume = localStorage.getItem('videoVolume');
    if (savedVideoSound !== null) {
        videoToggle.checked = savedVideoSound === 'true';
        videoSoundEnabled = savedVideoSound === 'true';
    } else {
        // default: enable video sound
        videoToggle.checked = true;
        videoSoundEnabled = true;
        localStorage.setItem('videoSound', 'true');
    }
    if (savedVideoVolume !== null) {
        volumeInput.value = Number(savedVideoVolume);
        videoVolumeValue = Number(savedVideoVolume);
    } else {
        volumeInput.value = videoVolumeValue;
        localStorage.setItem('videoVolume', String(videoVolumeValue));
    }

    // apply video sound state to video element
    if (videoEl) {
        videoEl.muted = !videoSoundEnabled;
        videoEl.volume = videoVolumeValue;
    }

    // --- Click sound settings and setup ---
    const clickToggle = document.getElementById('click-sound-toggle');
    const savedClickSound = localStorage.getItem('clickSound');
    if (clickToggle) {
        if (savedClickSound !== null) {
            clickToggle.checked = savedClickSound === 'true';
            clickSoundEnabled = savedClickSound === 'true';
        } else {
            // default: enable click sound
            clickToggle.checked = true;
            clickSoundEnabled = true;
            localStorage.setItem('clickSound', 'true');
        }

        // prepare audio element for clicks
        try {
            clickSound = new Audio('Button.mp3');
            clickSound.preload = 'auto';
            clickSound.volume = 0.8;
        } catch (e) {
            console.warn('Click sound could not be created:', e);
            clickSound = null;
        }

        clickToggle.addEventListener('change', () => {
            clickSoundEnabled = clickToggle.checked;
            localStorage.setItem('clickSound', clickSoundEnabled ? 'true' : 'false');
        });
    }

    // --- Startup sound settings and setup ---
    const startupToggle = document.getElementById('startup-sound-toggle');
    const savedStartup = localStorage.getItem('startupSound');
    if (startupToggle) {
        if (savedStartup !== null) {
            startupToggle.checked = savedStartup === 'true';
            startupSoundEnabled = savedStartup === 'true';
        } else {
            // default: enable startup sound
            startupToggle.checked = true;
            startupSoundEnabled = true;
            localStorage.setItem('startupSound', 'true');
        }

        // `startupSound` is created at script load. If it failed there, we keep it null.

        startupToggle.addEventListener('change', () => {
            startupSoundEnabled = startupToggle.checked;
            localStorage.setItem('startupSound', startupSoundEnabled ? 'true' : 'false');
        });
    }

    settingsBtn.addEventListener('click', () => {
        settingsModal.style.display = 'flex';
    });
    closeSettings.addEventListener('click', () => {
        settingsModal.style.display = 'none';
    });

    autoToggle.addEventListener('change', () => {
        localStorage.setItem('autoUpdate', autoToggle.checked);
        if (autoToggle.checked) {
            const hours = Number(intervalInput.value) || 4;
            startAutoUpdates(hours * 60 * 60 * 1000);
        } else {
            stopAutoUpdates();
        }
    });

    intervalInput.addEventListener('change', () => {
        const hours = Number(intervalInput.value) || 4;
        localStorage.setItem('updateIntervalHours', hours);
        if (autoToggle.checked) {
            startAutoUpdates(hours * 60 * 60 * 1000);
        }
    });

    // Video sound toggles
    videoToggle.addEventListener('change', () => {
        videoSoundEnabled = videoToggle.checked;
        localStorage.setItem('videoSound', videoSoundEnabled ? 'true' : 'false');
        if (videoEl) {
            videoEl.muted = !videoSoundEnabled;
            // try playing if enabling sound
            if (videoSoundEnabled) {
                const p = videoEl.play();
                if (p !== undefined) {
                    p.catch(err => {
                        console.warn('Autoplay with sound blocked:', err);
                        alert('Tarayıcı otomatik olarak sesli oynatmayı engelliyor. Sesi açmak için sayfaya tıklayın veya Ayarlar üzerinden tekrar deneyin.');
                        // add a one-time click handler to try enabling sound on user gesture
                        const tryOnClick = () => {
                            videoEl.muted = false;
                            videoEl.play().catch(()=>{});
                            document.removeEventListener('click', tryOnClick);
                        };
                        document.addEventListener('click', tryOnClick);
                    });
                }
            }
        }
    });

    volumeInput.addEventListener('input', () => {
        const v = Number(volumeInput.value);
        videoVolumeValue = v;
        localStorage.setItem('videoVolume', String(v));
        if (videoEl) videoEl.volume = v;
    });

    // Delegated click listener that plays the click sound for button clicks (or elements marked data-sound="true").
    document.addEventListener('click', (e) => {
        if (!clickSoundEnabled) return;
        if (!clickSound) return;
        const t = e.target;
        // If the clicked element is a button or inside a button, or explicitly marked with data-sound
        if (t.closest && (t.closest('button') || t.tagName === 'BUTTON' || t.dataset && t.dataset.sound === 'true')) {
            try {
                clickSound.currentTime = 0;
                clickSound.play().catch(() => {});
            } catch (err) {
                // ignore play errors (autoplay restrictions or missing file)
            }
        }
    });

    // Request geolocation permission and load weather for current location if allowed
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition((pos) => {
            const lat = pos.coords.latitude;
            const lon = pos.coords.longitude;
            // fetch results for current location
            getResults({ lat, lon });
            // start auto-updates if enabled
            if (autoToggle.checked) {
                const hours = Number(intervalInput.value) || 4;
                startAutoUpdates(hours * 60 * 60 * 1000);
            }
        }, (err) => {
            console.warn('Geolocation denied or failed:', err);
            // fallback to default city
            getResults('İstanbul');
            if (autoToggle.checked) {
                const hours = Number(intervalInput.value) || 4;
                startAutoUpdates(hours * 60 * 60 * 1000);
            }
        });
    } else {
        // No geolocation support
        getResults('İstanbul');
        if (autoToggle.checked) {
            const hours = Number(intervalInput.value) || 4;
            startAutoUpdates(hours * 60 * 60 * 1000);
        }
    }

    // Try to play the startup sound now; if blocked by autoplay policy, fall back to a user gesture
    // but only listen on the splash element (so opening settings doesn't trigger the startup sound).
    window.attemptPlayStartupSound = function() {
        if (!startupSoundEnabled) {
            console.log('Startup sound disabled by settings.');
            return;
        }
        if (!startupSound) {
            console.warn('Startup sound audio object is not available.');
            return;
        }
        console.log('Attempting to play startup sound...');
        const p = startupSound.play();
        if (p !== undefined) {
            p.then(() => {
                console.log('Startup sound played successfully.');
            }).catch((err) => {
                console.warn('Startup sound autoplay blocked or failed:', err);
                // Autoplay likely blocked; attach fallback listeners only to the splash image
                const splashEl = document.getElementById('splash-screen');
                const tryPlayOnSplash = () => {
                    try {
                        startupSound.play().then(() => {
                            console.log('Startup sound played after user gesture on splash.');
                        }).catch(()=>{});
                    } catch (e) {}
                };
                if (splashEl) {
                    splashEl.addEventListener('click', tryPlayOnSplash, { once: true });
                    splashEl.addEventListener('touchstart', tryPlayOnSplash, { once: true });
                    console.log('Attached fallback listeners to splash element for startup sound.');
                } else {
                    console.log('Splash element not found; no fallback listeners attached.');
                }
                // If splash not available (rare), we intentionally do not attach a document-wide listener
                // to avoid playing the startup sound when users interact with other UI (like settings).
            });
        }
    };
};

document.addEventListener('DOMContentLoaded', initApp);

// Restart app function: show splash, attempt startup sound, then hide splash and show app
const restartApp = () => {
    const splash = document.getElementById('splash-screen');
    const app = document.querySelector('.app');
    if (!splash || !app) return;

    // Show splash again
    splash.style.display = '';
    // force reflow then set opacity to 1 to show it (in case it was display:none)
    void splash.offsetWidth;
    splash.style.opacity = 1;
    // hide app while splash visible
    app.style.opacity = 0;

    // Try to play startup sound now. If blocked, our attemptPlayStartupSound fallback attaches to splash.
    try {
        if (typeof window.attemptPlayStartupSound === 'function') {
            window.attemptPlayStartupSound();
        } else {
            // fallback: try direct play
            if (startupSoundEnabled && startupSound) {
                startupSound.play().catch(()=>{});
            }
        }
    } catch (e) {
        console.warn('Error while attempting startup sound on restart:', e);
    }

    // After same delay as initial splash, hide splash and show app
    setTimeout(() => {
        splash.style.opacity = 0;
        splash.addEventListener('transitionend', function onEnd() {
            splash.removeEventListener('transitionend', onEnd);
            splash.style.display = 'none';
            app.style.display = 'flex';
            setTimeout(() => { app.style.opacity = 1; }, 50);
        });
    }, 2000);
};

// Hook restart button
const restartBtn = document.getElementById('restart-btn');
if (restartBtn) {
    restartBtn.addEventListener('click', (e) => {
        e.preventDefault();
        // Play a short click sound if enabled
        try { if (clickSoundEnabled && clickSound) { clickSound.currentTime = 0; clickSound.play().catch(()=>{}); } } catch (e) {}
        restartApp();
    });
}

// Note: background is now set when a city's weather is loaded (using its timezone).
// The previous DOMContentLoaded local-time check was removed so backgrounds follow the searched city's local time.