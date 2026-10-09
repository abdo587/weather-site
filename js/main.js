const DEFAULT_LOCATION = Object.freeze({
  name: "دمشق",
  latitude: 33.5138,
  longitude: 36.2765,
});

const LOCATION_STORAGE_KEY = "weather-site-location";
const UNITS_STORAGE_KEY = "weather-site-units";
const REFRESH_INTERVAL_MS = 15 * 60 * 1000;

let citySearchRequestId = 0;
let weatherRequestId = 0;
let activeLocation = DEFAULT_LOCATION;
let units = { temperature: "C", windSpeed: "kmh" };
let latestWeather = null;

function readStoredValue(key) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    console.warn(`تعذر قراءة الإعداد المحفوظ (${key}).`, error);
    return null;
  }
}

function saveStoredValue(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn(`تعذر حفظ الإعداد (${key}).`, error);
  }
}

function getSavedLocation() {
  const location = readStoredValue(LOCATION_STORAGE_KEY);
  if (location
    && typeof location.name === "string"
    && location.name.trim()
    && Number.isFinite(location.latitude)
    && location.latitude >= -90
    && location.latitude <= 90
    && Number.isFinite(location.longitude)
    && location.longitude >= -180
    && location.longitude <= 180) {
    return location;
  }

  return DEFAULT_LOCATION;
}

function restoreUnits() {
  const savedUnits = readStoredValue(UNITS_STORAGE_KEY);
  if (savedUnits && (savedUnits.temperature === "C" || savedUnits.temperature === "F")) {
    units.temperature = savedUnits.temperature;
  }
  if (savedUnits && (savedUnits.windSpeed === "kmh" || savedUnits.windSpeed === "mph")) {
    units.windSpeed = savedUnits.windSpeed;
  }
}

function saveUnits() {
  saveStoredValue(UNITS_STORAGE_KEY, units);
}

function updateUnitButtons() {
  const temperatureButton = document.querySelector("#temperature-unit-button");
  const windButton = document.querySelector("#wind-unit-button");
  temperatureButton.textContent = units.temperature === "C" ? "°م" : "°ف";
  windButton.textContent = units.windSpeed === "kmh" ? "كم/س" : "ميل/س";
  temperatureButton.setAttribute(
    "aria-label",
    `وحدة الحرارة الحالية ${units.temperature === "C" ? "مئوية" : "فهرنهايت"}، اضغط للتبديل`,
  );
  windButton.setAttribute(
    "aria-label",
    `وحدة سرعة الرياح الحالية ${units.windSpeed === "kmh" ? "كيلومتر في الساعة" : "ميل في الساعة"}، اضغط للتبديل`,
  );
  temperatureButton.setAttribute("aria-pressed", String(units.temperature === "C"));
  windButton.setAttribute("aria-pressed", String(units.windSpeed === "kmh"));
}

function renderLatestWeather() {
  if (!latestWeather) return;
  renderCurrent(activeLocation.name, latestWeather.current, units);
  renderHourly(latestWeather.hourly, units);
  drawTemperatureChart(
    document.querySelector("#hourly-temperature-chart"),
    latestWeather.hourly,
    units.temperature,
  );
  renderForecast(latestWeather.daily, units);
  drawPrecipitationChart(
    document.querySelector("#precipitation-chart"),
    latestWeather.daily,
  );
}

function updateLastUpdated(date) {
  const element = document.querySelector("#last-updated");
  element.textContent = new Intl.DateTimeFormat("ar", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
  element.dateTime = date.toISOString();
}

function selectLocation(location) {
  activeLocation = {
    name: location.name,
    latitude: location.latitude,
    longitude: location.longitude,
  };
  saveStoredValue(LOCATION_STORAGE_KEY, activeLocation);
  loadWeather(activeLocation.latitude, activeLocation.longitude, activeLocation.name);
}

async function loadWeather(lat, lon, name, showSpinner = true) {
  const requestId = ++weatherRequestId;
  if (showSpinner) showLoading(true);

  try {
    const [weatherResult, airQualityResult] = await Promise.allSettled([
      Promise.resolve().then(() => getWeather(lat, lon)),
      Promise.resolve().then(() => getAirQuality(lat, lon)),
    ]);
    if (requestId !== weatherRequestId) return;
    if (weatherResult.status === "rejected") throw weatherResult.reason;

    const weather = weatherResult.value;
    const airQuality = airQualityResult.status === "fulfilled" ? airQualityResult.value : null;
    weather.airQuality = airQuality;
    latestWeather = weather;
    activeLocation = { name, latitude: lat, longitude: lon };
    applyWeatherTheme(weather.current.code, weather.current.isDay);
    renderLatestWeather();
    renderAirQuality(latestWeather.airQuality);
    updateLastUpdated(new Date());
    showLoading(false);
  } catch (error) {
    if (requestId !== weatherRequestId) return;
    const message = error instanceof Error
      ? error.message
      : "حدث خطأ غير متوقع أثناء تحميل بيانات الطقس.";
    showError(message);
  }
}

function handleLocationError(error) {
  if (error.code === 1) {
    showError("تم رفض إذن الموقع. اسمح للمتصفح بالوصول إلى موقعك ثم حاول مرة أخرى.");
  } else if (error.code === 2) {
    showError("تعذر تحديد موقعك. تحقق من إعدادات الموقع وحاول مرة أخرى.");
  } else if (error.code === 3) {
    showError("انتهت مهلة تحديد الموقع. حاول مرة أخرى.");
  } else {
    showError("حدث خطأ أثناء تحديد موقعك. حاول مرة أخرى.");
  }
}

function handleCurrentLocation() {
  citySearchRequestId += 1;
  clearCitySearchResults();

  if (!window.isSecureContext) {
    showError("تحديد الموقع يتطلب اتصالًا آمنًا (HTTPS) أو تشغيل الصفحة عبر localhost.");
    return;
  }

  if (!navigator.geolocation) {
    showError("متصفحك لا يدعم تحديد الموقع. ابحث عن مدينتك بدلًا من ذلك.");
    return;
  }

  const requestId = citySearchRequestId;
  showLoading(true);
  navigator.geolocation.getCurrentPosition(
    (position) => {
      if (requestId !== citySearchRequestId) return;
      selectLocation({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        name: "موقعك الحالي",
      });
    },
    (error) => {
      if (requestId !== citySearchRequestId) return;
      handleLocationError(error);
    },
    { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
  );
}

function clearCitySearchResults() {
  const resultsContainer = document.querySelector("#city-search-results");
  resultsContainer.replaceChildren();
  resultsContainer.hidden = true;
}

function renderCitySearchResults(cities) {
  const resultsContainer = document.querySelector("#city-search-results");
  const items = cities.map((city) => {
    const item = document.createElement("div");
    item.setAttribute("role", "listitem");
    const button = document.createElement("button");
    button.className = "city-result";
    button.type = "button";
    const cityLabel = [city.name, city.admin1, city.country]
      .filter(Boolean)
      .join("، ");
    button.textContent = cityLabel;
    button.setAttribute("aria-label", `عرض الطقس في ${cityLabel}`);
    button.addEventListener("click", () => {
      document.querySelector("#city-search").value = city.name;
      clearCitySearchResults();
      selectLocation(city);
    });
    item.append(button);
    return item;
  });

  resultsContainer.replaceChildren(...items);
  resultsContainer.hidden = false;
}

async function handleCitySearch(event) {
  event.preventDefault();
  const searchInput = document.querySelector("#city-search");
  const cityName = searchInput.value.trim();

  if (!cityName) {
    clearCitySearchResults();
    showError("أدخل اسم مدينة للبحث عنها.");
    searchInput.focus();
    return;
  }

  const requestId = ++citySearchRequestId;
  clearCitySearchResults();
  showLoading(true);

  try {
    const cities = await searchCity(cityName);
    if (requestId !== citySearchRequestId) return;

    showLoading(false);
    if (cities.length === 1) {
      const [city] = cities;
      searchInput.value = city.name;
      selectLocation(city);
      return;
    }

    hideError();
    renderCitySearchResults(cities);
  } catch (error) {
    if (requestId !== citySearchRequestId) return;

    showLoading(false);
    const message = error instanceof Error
      ? error.message.startsWith("لم يتم العثور على نتائج للمدينة")
        ? "لم يتم العثور على المدينة."
        : error.message
      : "حدث خطأ غير متوقع أثناء البحث عن المدينة.";
    showError(message);
  }
}

function init() {
  activeLocation = getSavedLocation();
  restoreUnits();
  updateUnitButtons();

  document.querySelector("#city-search-form").addEventListener("submit", handleCitySearch);
  document.querySelector("#current-location-button").addEventListener("click", handleCurrentLocation);
  document.querySelector("#temperature-unit-button").addEventListener("click", () => {
    units.temperature = units.temperature === "C" ? "F" : "C";
    saveUnits();
    updateUnitButtons();
    renderLatestWeather();
  });
  document.querySelector("#wind-unit-button").addEventListener("click", () => {
    units.windSpeed = units.windSpeed === "kmh" ? "mph" : "kmh";
    saveUnits();
    updateUnitButtons();
    renderLatestWeather();
  });
  document.querySelector("#city-search").addEventListener("input", () => {
    citySearchRequestId += 1;
    clearCitySearchResults();
    showLoading(false);
    hideError();
  });

  loadWeather(activeLocation.latitude, activeLocation.longitude, activeLocation.name);
  window.setInterval(() => {
    loadWeather(activeLocation.latitude, activeLocation.longitude, activeLocation.name, false);
  }, REFRESH_INTERVAL_MS);
}

document.addEventListener("DOMContentLoaded", init);