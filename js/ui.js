function renderCurrent(cityName, current, units = {}) {
  if (!current) {
    throw new Error("بيانات الطقس الحالي غير متوفرة للعرض.");
  }

  const temperatureUnit = units.temperature ?? "C";
  const windUnit = units.windSpeed ?? "kmh";
  const toTemperature = (value) => temperatureUnit === "F" ? (value * 9) / 5 + 32 : value;
  const windSpeed = windUnit === "mph" ? current.windSpeed / 1.609344 : current.windSpeed;
  const windSpeedText = new Intl.NumberFormat("ar", { maximumFractionDigits: 1 }).format(windSpeed);
  const today = new Date();
  const dateString = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-");
  const weatherInfo = weatherCodeToInfo(current.code);

  document.querySelector("#city-name").textContent = cityName;

  const dateElement = document.querySelector("#weather-date");
  dateElement.textContent = formatDate(dateString);
  dateElement.dateTime = dateString;

  const temperatureSuffix = temperatureUnit === "F" ? "°ف" : "°م";
  document.querySelector("#temperature").textContent = `${formatTemp(toTemperature(current.temperature))}${temperatureSuffix}`;
  document.querySelector("#weather-description").textContent = weatherInfo.description;
  document.querySelector("#apparent-temperature").textContent = `${formatTemp(toTemperature(current.apparentTemperature))}${temperatureSuffix}`;
  document.querySelector("#humidity").textContent = `${current.humidity}٪`;
  document.querySelector("#wind-speed").textContent = `${windSpeedText} ${windUnit === "mph" ? "ميل/س" : "كم/س"}`;
}

function renderForecast(daily, units = {}) {
  if (!Array.isArray(daily)) {
    throw new Error("بيانات توقعات الطقس غير صالحة للعرض.");
  }

  const temperatureUnit = units.temperature ?? "C";
  const temperatureSuffix = temperatureUnit === "F" ? "°ف" : "°م";
  const toTemperature = (value) => temperatureUnit === "F" ? (value * 9) / 5 + 32 : value;
  const forecastContainer = document.querySelector("#forecast-days");
  const cards = daily.map((day, index) => {
    const weatherInfo = weatherCodeToInfo(day.code);
    const precipitation = precipitationInfo(day);
    const card = document.createElement("article");
    card.className = "forecast-card";
    card.setAttribute("role", "listitem");

    const heading = document.createElement("h3");
    heading.className = "forecast-day";
    heading.textContent = index === 0 ? "اليوم" : formatDate(day.date);

    const icon = document.createElement("span");
    icon.className = "forecast-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = weatherInfo.icon;

    const description = document.createElement("p");
    description.className = "forecast-description";
    description.textContent = weatherInfo.description;

    const temperatures = document.createElement("p");
    temperatures.className = "forecast-temperatures";
    temperatures.textContent = `${formatTemp(toTemperature(day.max))}${temperatureSuffix} / ${formatTemp(toTemperature(day.min))}${temperatureSuffix}`;

    const precipitationSummary = document.createElement("div");
    precipitationSummary.className = "forecast-precipitation-summary";

    const chance = document.createElement("p");
    chance.className = "forecast-precipitation-chance";
    const chanceText = Number.isFinite(day.rainChance) ? `${Math.round(day.rainChance)}٪` : "—";
    chance.textContent = chanceText;

    const precipitationIcon = document.createElement("span");
    precipitationIcon.className = "forecast-precipitation-icon";
    precipitationIcon.setAttribute("aria-hidden", "true");
    precipitationIcon.textContent = precipitation.icon;
    precipitationSummary.append(chance, precipitationIcon);

    const progress = document.createElement("div");
    progress.className = "forecast-precipitation-progress";
    progress.setAttribute("role", "meter");
    progress.setAttribute("aria-label", "احتمال الهطول");
    progress.setAttribute("aria-valuemin", "0");
    progress.setAttribute("aria-valuemax", "100");
    if (Number.isFinite(day.rainChance)) {
      const boundedChance = Math.max(0, Math.min(100, day.rainChance));
      progress.setAttribute("aria-valuenow", String(Math.round(boundedChance)));
      progress.dataset.level = boundedChance >= 60 ? "high" : boundedChance >= 30 ? "medium" : "low";
      const fill = document.createElement("span");
      fill.className = "forecast-precipitation-fill";
      fill.style.width = `${boundedChance}%`;
      progress.append(fill);
    } else {
      progress.setAttribute("aria-valuetext", "البيانات غير متوفرة");
      progress.dataset.level = "unavailable";
    }

    const amount = document.createElement("p");
    amount.className = "forecast-precipitation-amount";
    if (precipitation.type === "ثلج") {
      amount.textContent = day.snowCm === null ? "الكمية: —" : `الثلوج: ${day.snowCm} سم`;
    } else if (precipitation.type === "مطر") {
      amount.textContent = day.rainMm === null ? "الكمية: —" : `الأمطار: ${day.rainMm} ملم`;
    } else if (day.snowCm === null || day.rainMm === null) {
      amount.textContent = "الكمية: —";
    } else {
      amount.textContent = "لا هطول";
    }

    const dayLabel = new Intl.DateTimeFormat("ar", { weekday: "long" })
      .format(new Date(`${day.date}T12:00:00`));
    const chanceLabel = Number.isFinite(day.rainChance)
      ? `احتمال ${precipitation.type === "ثلج" ? "الثلج" : precipitation.type === "مطر" ? "المطر" : "الهطول"} ${Math.round(day.rainChance)}٪`
      : "احتمال الهطول غير متوفر";
    card.setAttribute("aria-label", `${dayLabel}، ${chanceLabel}، ${amount.textContent.replace(/^(الأمطار|الثلوج): /, "")}`);

    card.append(heading, icon, description, temperatures, precipitationSummary, progress, amount);
    return card;
  });

  forecastContainer.replaceChildren(...cards);
}

function renderHourly(hourly, units = {}) {
  if (!Array.isArray(hourly)) {
    throw new Error("بيانات توقعات الساعات غير صالحة للعرض.");
  }

  const temperatureUnit = units.temperature ?? "C";
  const temperatureSuffix = temperatureUnit === "F" ? "°ف" : "°م";
  const toTemperature = (value) => temperatureUnit === "F" ? (value * 9) / 5 + 32 : value;
  const hourFormatter = new Intl.NumberFormat("ar", {
    minimumIntegerDigits: 2,
    useGrouping: false,
  });
  const forecastContainer = document.querySelector("#forecast-hours");
  const cards = hourly.map((hour, index) => {
    const weatherInfo = weatherCodeToInfo(hour.code);
    const card = document.createElement("article");
    card.className = "hourly-card";
    card.setAttribute("role", "listitem");

    const heading = document.createElement("h3");
    heading.className = "hourly-time";
    const timeMatch = typeof hour.time === "string" ? hour.time.match(/T(\d{2}):(\d{2})/) : null;
    heading.textContent = index === 0
      ? "الآن"
      : timeMatch
        ? `${hourFormatter.format(Number(timeMatch[1]))}:${hourFormatter.format(Number(timeMatch[2]))}`
        : hour.time;

    const icon = document.createElement("span");
    icon.className = "hourly-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = weatherInfo.icon;

    const temperature = document.createElement("p");
    temperature.className = "hourly-temperature";
    temperature.textContent = `${formatTemp(toTemperature(hour.temp))}${temperatureSuffix}`;

    const description = document.createElement("p");
    description.className = "hourly-description";
    description.textContent = weatherInfo.description;

    const rainChance = document.createElement("p");
    rainChance.className = "hourly-rain-chance";
    rainChance.textContent = `احتمال المطر: ${hour.rainChance}٪`;

    if (index === 0) card.classList.add("is-current-hour");
    card.append(heading, icon, temperature, description, rainChance);
    return card;
  });

  forecastContainer.replaceChildren(...cards);
}

function renderAirQuality(data) {
  const card = document.querySelector("#air-quality-card");
  card.replaceChildren();
  card.className = "air-quality-card";

  if (!data || !Number.isFinite(data.aqi)) {
    const unavailable = document.createElement("p");
    unavailable.className = "air-quality-unavailable";
    unavailable.textContent = "البيانات غير متوفرة لهذه المنطقة";
    card.append(unavailable);
    return;
  }

  const info = aqiToInfo(data.aqi);
  const summary = document.createElement("div");
  summary.className = "air-quality-summary";

  const score = document.createElement("p");
  score.className = "air-quality-score";
  score.textContent = new Intl.NumberFormat("ar", { maximumFractionDigits: 0 }).format(data.aqi);
  score.setAttribute("aria-label", `مؤشر جودة الهواء ${Math.round(data.aqi)}`);
  score.dataset.aqiLevel = info.level;

  const category = document.createElement("p");
  category.className = "air-quality-category";
  category.textContent = info.category;
  category.dataset.aqiLevel = info.level;

  summary.append(score, category);

  const meterLabel = document.createElement("p");
  meterLabel.className = "air-quality-meter-label";
  meterLabel.textContent = "مستوى مؤشر جودة الهواء";

  const meter = document.createElement("div");
  meter.className = "air-quality-meter";
  meter.setAttribute("role", "meter");
  meter.setAttribute("aria-label", "مؤشر جودة الهواء");
  meter.setAttribute("aria-valuemin", "0");
  meter.setAttribute("aria-valuemax", "500");
  meter.setAttribute("aria-valuenow", String(Math.min(500, Math.round(data.aqi))));
  meter.setAttribute("aria-valuetext", `${Math.round(data.aqi)}، ${info.category}`);

  const indicator = document.createElement("span");
  indicator.className = "air-quality-indicator";
  indicator.style.left = `${Math.max(2, Math.min(data.aqi, 500) / 5)}%`;
  indicator.style.backgroundColor = info.color;
  meter.append(indicator);

  const advice = document.createElement("p");
  advice.className = "air-quality-advice";
  advice.textContent = info.advice;

  const pollutants = document.createElement("dl");
  pollutants.className = "air-quality-pollutants";
  [
    ["PM2.5", data.pm25],
    ["PM10", data.pm10],
    ["O₃", data.ozone],
    ["NO₂", data.nitrogenDioxide],
  ].forEach(([name, value]) => {
    const group = document.createElement("div");
    const term = document.createElement("dt");
    term.textContent = name;
    const description = document.createElement("dd");
    const formattedValue = Number.isFinite(value)
      ? new Intl.NumberFormat("ar", { maximumFractionDigits: 1 }).format(value)
      : "—";
    description.textContent = `${formattedValue} µg/m³`;
    group.append(term, description);
    pollutants.append(group);
  });

  card.append(summary, meterLabel, meter, advice, pollutants);
}

function showLoading(isLoading) {
  document.querySelector("#loading-message").hidden = !isLoading;
  if (isLoading) hideError();
}

function showError(message) {
  const errorElement = document.querySelector("#error-message");
  errorElement.textContent = message;
  errorElement.hidden = false;
  showLoading(false);
}

function hideError() {
  const errorElement = document.querySelector("#error-message");
  errorElement.hidden = true;
  errorElement.textContent = "";
}